'use strict';

const uuid = require('uuid');
const Base = require('sdk-base');
const assert = require('assert');
const { pipeline } = require('stream');
const { TsServerEncoder, TsServerDecoder } = require('./protocol');

const defaultOptions = {
  maxIdleTime: 120000, // 120s 没有请求断开连接
};

class TsConnection extends Base {
  constructor(options = {}) {
    assert(options.socket, '[TsConnection] options.socket is ');
    super(Object.assign({}, defaultOptions, options));
    this.socket = options.socket;
    this.logger = options.logger || console;
    this.key = uuid.v4();
    this.peddingReqs = new Map();

    this.socket.once('close', () => { this._handleClose(); });
    this.socket.once('error', err => { this._handleSocketError(err); });
    this.encoder = new TsServerEncoder();
    this.decoder = new TsServerDecoder();
    this.decoder.on('message', msg => { this._dispatchMessage(msg); });

    pipeline(this.encoder, this.socket, this.decoder, err => {
      if (err) {
        this._handleSocketError(err);
      }
    });

    this._lastActiveTime = Date.now();
    this._timer = setInterval(() => {
      const now = Date.now();
      if (now - this.lastActiveTime >= this.options.maxIdleTime) {
        this.logger.warn('[TsConnection] socket: %s is idle for %s(ms), the connection maybe lost.', this.key, this.options.maxIdleTime);
        this.close();
      }
    }, this.options.maxIdleTime);
  }

  get isClosed() {
    return this._closed;
  }

  get lastActiveTime() {
    return this._lastActiveTime;
  }

  responseTimeout(request_seq) {
    this.peddingReqs.delete(request_seq);
  }

  writeResponse(seq, res) {
    this.peddingReqs.delete(seq);
    this._write(res);
  }

  writeEvent(event) {
    this._write(event);
  }

  _dispatchMessage(msg) {
    this._lastActiveTime = Date.now();

    switch (msg.type) {
      case 'request':
        this.peddingReqs.set(msg.seq, msg);
        this.emit('request', msg);
        break;
      case 'ping': // 心跳
        // this._write({ type: 'pong', request_seq: msg.seq });
        break;
      case 'kill': // 主动 kill
        this.emit('kill');
        break;
      case 'cancel': // 取消某一个请求
        this._handleCancel(msg);
        break;
      default:
        this._handleSocketError(new Error(`unknow message: ${JSON.stringify(msg)}`));
        break;
    }
  }

  _write(msg) {
    if (this.isClosed) return;

    this.encoder.writeMessage(msg);
  }

  _handleCancel(msg) {
    const req = this.peddingReqs.get(msg.seq);
    if (req) {
      this.peddingReqs.delete(msg.seq);
      this.emit('cancel', req.seq);
    }
  }

  _handleSocketError(err) {
    if (err.code !== 'ECONNRESET') {
      this.logger.warn('[TsConnection] error occured on socket: %s, errName: %s, errMsg: %s', this.key, err.name, err.message);
    }
  }

  _handleClose() {
    this._closed = true;
    this.peddingReqs.clear();
    clearInterval(this._timer);
    this.emit('close');
  }

  close(err) {
    if (this.isClosed) return Promise.resolve();

    this.socket.destroy(err);
    return this.await('close');
  }
}

module.exports = TsConnection;
