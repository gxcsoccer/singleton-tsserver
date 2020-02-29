'use strict';

const net = require('net');
const Base = require('sdk-base');
const utils = require('./utils');
const { pipeline } = require('stream');
const sleep = require('mz-modules/sleep');
const { TsServerEncoder } = require('./protocol');

const defaultOptions = {
  logger: console,
  maxIdleTime: 120000, // 120s 没有请求断开连接
};

class TsProxyClient extends Base {
  constructor(options = {}) {
    super(Object.assign({}, defaultOptions, options));
    this._lastActiveTime = Date.now();
    this._connect();
  }

  get logger() {
    return this.options.logger;
  }

  get stdout() {
    return this._socket;
  }

  _connect() {
    const { tsServerPath, args, tsServerForkOptions } = this.options;
    const sockPath = utils.getSockPath({
      tsServerPath,
      args,
      tsServerForkOptions,
    });
    this._timer = null;
    this._isClosed = false;
    this._socket = net.connect(sockPath);
    this._socket.setNoDelay(true);
    this._socket.setTimeout(5000, () => {
      const err = new Error('TsServer connect timeout');
      this._socket.destroy(err);
    });
    this._socket.once('close', () => {
      this._isClosed = true;
      clearInterval(this._timer);
      this._timer = null;
      this.emit('exit');
    });
    this._socket.on('error', err => {
      this.logger.error(err);
    });
    this._socket.once('connect', () => {
      this._socket.setTimeout(0);
      this.ready(true);
      this._startPing();
    });

    this._encoder = new TsServerEncoder();
    pipeline(this._encoder, this._socket, err => {
      if (err) {
        this.logger.error(err);
      }
    });
  }

  write(req) {
    if (this._isClosed) return;

    this._lastActiveTime = Date.now();
    this._encoder.writeMessage(req);
  }

  cancel(seq) {
    this.write({ seq, type: 'cancel' });
  }

  kill() {
    this.write({ type: 'kill' });
  }

  async _startPing() {
    const timeout = this.options.maxIdleTime / 2;

    while (!this._isClosed) {
      await sleep(timeout);

      const dur = Date.now() - this._lastActiveTime;
      if (dur > timeout) {
        this.write({ seq: 1, type: 'ping' });
      }
    }
  }
}

module.exports = TsProxyClient;
