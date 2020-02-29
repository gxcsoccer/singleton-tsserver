'use strict';

const fs = require('fs');
const net = require('net');
const path = require('path');
const Base = require('sdk-base');
const assert = require('assert');
const utils = require('./utils');
const cp = require('child_process');
const { pipeline } = require('stream');
const awaitFirst = require('await-first');
const mkdirp = require('mz-modules/mkdirp');
const rimraf = require('mz-modules/rimraf');
const TsConnection = require('./connection');
const { TsServerDecoder } = require('./protocol');

const defaultOptions = {
  responseTimeout: 60000, // 1分钟没有返回，请求超时
  maxIdleTime: 120000, // 120s 没有请求断开连接
  logger: console,
};

class TsProxyServer extends Base {
  constructor(options = {}) {
    assert(options.tsServerPath, '[TsProxyServer] options.tsServerPath is required');

    super(Object.assign({}, defaultOptions, options, { initMethod: '_init' }));
    const { tsServerPath, args, tsServerForkOptions } = this.options;
    this.sockPath = utils.getSockPath({
      tsServerPath,
      args,
      tsServerForkOptions,
    });
    this.tsServerPath = options.tsServerPath;
    this.args = options.args || [];
    this.tsServerForkOptions = {
      silent: true,
      ...options.tsServerForkOptions,
    };
    this.server = null;
    this.tsProcess = null;
    this.decoder = null;
    this.conns = new Map();
    this.sequenceNumber = 0;
    this.peddingRequests = new Map();
    this.closeTimer = null;
    this.isClosed = false;

    // 日志里面标识用
    this.kind = args.includes('--syntaxOnly') ? 'syntax' : 'semantic';
  }

  get logger() {
    return this.options.logger;
  }

  async _init() {
    // 先尝试连一下，如果连上说明服务已经存在，直接返回
    const connected = await this._tryConnect();
    if (connected) {
      this.logger.info('[TsProxyServer] tsserver is already running, won\'t start again, tsServerPath: %s, args: %j, tsServerForkOptions: %j',
        this.tsServerPath, this.args, this.tsServerForkOptions);
      return;
    }
    this.server = await this._claimServer();
    if (!this.server) return;

    this.logger.info('[TsProxyServer] claim tsserver success, tsServerPath: %s, args: %j, tsServerForkOptions: %j', this.tsServerPath, this.args, this.tsServerForkOptions);

    this.server.once('close', async () => {
      this.isClosed = true;
      if (this.tsProcess) {
        this.tsProcess.kill();
      }
      await rimraf(this.sockPath);
      this.logger.info('[TsProxyServer] server is closed.');
      this.emit('close');
    });
    const { tsServerPath, args, tsServerForkOptions } = this;
    this.decoder = new TsServerDecoder();
    this.decoder.on('message', msg => { this._dispatchMessage(msg); });
    this.tsProcess = cp.fork(tsServerPath, args, tsServerForkOptions);
    this.tsProcess.once('exit', (exitCode, signal) => { this._handleExit(exitCode, signal); });
    this.tsProcess.once('error', err => { this._handleProcessError(err); });

    pipeline(this.tsProcess.stdout, this.decoder, err => {
      if (err) {
        this._handleProcessError(err);
      }
    });

    // 是否支持 cancel 请求，若支持，则初始化目录
    const index = args.indexOf('--cancellationPipeName');
    if (index >= 0) {
      this._cancellationPipeName = args[index + 1].slice(0, -1);
      mkdirp.sync(path.dirname(this._cancellationPipeName));
    }
  }

  async close() {
    if (!this.server || this.isClosed) return;

    this.server.close();
    for (const conn of this.conns.values()) {
      conn.close();
    }
    await this.await('close');
    this.server = null;
  }

  // code 有下面值
  // 00: 请求成功
  // 01: 请求失败
  // 02: 请求取消
  // 03: 请求超时
  _finishReq(seq, code) {
    const handle = this.peddingRequests.get(seq);
    if (!handle) {
      this.logger.warn('[TsProxyServer] not found request:%s', seq);
      return;
    }

    this.peddingRequests.delete(seq);

    const { originSeq, meta, timer } = handle;
    clearTimeout(timer);

    this.logger.info('[TsProxyServer] command trace: %s|%s|%s|%s|%s|%s', meta.command, seq, originSeq, code, meta.start, Date.now() - meta.start);
  }

  _cancel(seq) {
    this._finishReq(seq, '02');

    // 如果传递了这个参数
    if (this._cancellationPipeName) {
      fs.writeFile(this._cancellationPipeName + seq, '', () => {
        // noop
      });
    }
  }

  _write(req, conn) {
    if (!this.tsProcess.stdin) return;

    const originSeq = req.seq;
    const newSeq = this.sequenceNumber++;
    req.seq = newSeq;
    const meta = {
      start: Date.now(),
      command: req.command,
    };
    const timer = setTimeout(() => {
      this._finishReq(newSeq, '03');
      conn.responseTimeout(originSeq);
    }, this.options.responseTimeout);
    this.peddingRequests.set(newSeq, { originSeq, conn, meta, timer });
    this.tsProcess.stdin.write(JSON.stringify(req) + '\r\n', 'utf8');

    this.logger.debug('[TsProxyServer] write request: %j to server<%s>', req, this.kind);
  }

  _dispatchResponse(seq, res) {
    const handle = this.peddingRequests.get(seq);
    if (!handle) {
      this.logger.warn('[TsProxyServer] not found request:%s', seq);
      return;
    }

    let code = '00';
    if (res.type === 'response') {
      res.request_seq = handle.originSeq;
      code = res.success ? '00' : '01';
    } else {
      res.body.request_seq = handle.originSeq;
    }
    handle.conn.writeResponse(handle.originSeq, res);

    this._finishReq(seq, code);
  }

  _dispatchEvent(event) {
    for (const conn of this.conns.values()) {
      conn.writeEvent(event);
    }
    this.logger.debug('[TsProxyServer] received event: %j from tsserver<%s>', event, this.kind);
  }

  _dispatchMessage(msg) {
    this.logger.debug('[TsProxyServer] receive message: %j from tsserver<%s>', msg, this.kind);
    switch (msg.type) {
      case 'response':
        this._dispatchResponse(msg.request_seq, msg);
        break;
      case 'event':
        if (msg.event === 'requestCompleted') {
          const seq = msg.body.request_seq;
          this._dispatchResponse(seq, msg);
        } else {
          this._dispatchEvent(msg);
        }
        break;
      default:
        this.logger.error(new Error('received unknown message: ' + JSON.stringify(msg) + ' from tsserver<' + this.kind + '>'));
        break;
    }
  }

  _handleExit(exitCode, signal) {
    if (this.isClosed) return;

    this.logger.info('[TsProxyServer] tsserver process is exited with %s', exitCode != null ? `code: ${exitCode}` : `signal: ${signal}`);
    this.close();
  }

  _handleProcessError(err) {
    err.message = 'tsserver occurred an error: ' + err.message;
    this.logger.error(err);
    this.close();
  }

  _handleSocket(socket) {
    clearTimeout(this.closeTimer);
    const conn = new TsConnection({
      socket,
      logger: this.options.logger,
      maxIdleTime: this.options.maxIdleTime,
    });
    this.conns.set(conn.key, conn);
    conn.once('close', () => {
      this.conns.delete(conn.key, conn);
      // 如果最后一个 conn 断开以后，10s 内没有新的连接则停掉 server
      if (this.conns.size === 0) {
        this.closeTimer = setTimeout(() => {
          this.close();
        }, 10000);
      }
    });
    conn.once('kill', () => {
      this.logger.info('[TsProxyServer] received kill command, will close tsserver');
      this.close();
    });
    conn.on('request', req => {
      this._write(req, conn);
    });
    conn.on('cancel', seq => {
      this._cancel(seq);
    });
    this.logger.info('[TsProxyServer] an new socket:%s is connected, server kind: %s', conn.key, this.kind);
  }

  async _tryConnect() {
    if (fs.existsSync(this.sockPath)) {
      const socket = net.connect(this.sockPath);
      try {
        await awaitFirst(socket, [ 'connect', 'error' ]);
        socket.end();
        return true;
      } catch (err) {
        await rimraf(this.sockPath);
        return false;
      }
    }
    return false;
  }

  async _claimServer() {
    return new Promise(resolve => {
      const server = net.createServer();
      server.on('connection', socket => { this._handleSocket(socket); });
      server.listen({
        path: this.sockPath,
        // When exclusive is true, the handle is not shared, and attempted port sharing results in an error.
        exclusive: true,
      });
      server.once('error', err => {
        this.logger.info('[TsProxyServer] claim tsserver failed, due to %s, tsServerPath: %s, args: %j, tsServerForkOptions: %j',
          err.message, this.tsServerPath, this.args, this.tsServerForkOptions);
        resolve(null);
      });
      server.once('listening', () => {
        resolve(server);
      });
    });
  }
}

module.exports = TsProxyServer;
