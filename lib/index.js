'use strict';

const path = require('path');
const Base = require('sdk-base');
const cp = require('child_process');
const awaitEvent = require('await-event');
const TsProxyClient = require('./proxy_client');
const { PassThrough, pipeline } = require('stream');

class ClusterTsServerProcess extends Base {
  constructor(options = {}) {
    super(Object.assign({}, options, { initMethod: '_init' }));
    this.stdout = new PassThrough();

    const { args } = this.options;
    const index = args.indexOf('--cancellationPipeName');
    if (index >= 0) {
      this._cancellationPipeName = args[index + 1].slice(0, -1);
    }

    this._pendingReqs = [];
    this._clientReady = false;

    this.requestCanceller = {
      tryCancelOngoingRequest: seq => {
        if (!this._cancellationPipeName || !this._client) return false;

        this._client.cancel(seq);
        return true;
      },
    };
  }

  async _init() {
    await this._startServer();
    const { tsServerPath, args, tsServerForkOptions } = this.options;
    this._client = new TsProxyClient({ tsServerPath, args, tsServerForkOptions });

    this._client.on('exit', () => {
      this.emit('exit');
    });
    this._client.on('error', err => {
      this.emit('error', err);
    });
    await this._client.ready();

    pipeline(this._client.stdout, this.stdout, err => {
      if (err) {
        this.emit('error', err);
      }
    });

    this._clientReady = true;

    let req = this._pendingReqs.shift();
    while (req) {
      this.write(req);
      req = this._pendingReqs.shift();
    }
  }

  async _startServer() {
    const { tsServerPath, args, tsServerForkOptions, logFile, logLevel } = this.options;
    const proc = cp.fork(path.join(__dirname, 'start_server.js'), [
      '--args',
      JSON.stringify({ tsServerPath, args, tsServerForkOptions, logFile, logLevel }),
    ], {
      detached: true,
      stdio: 'inherit',
      execArgv: [],
    });
    await awaitEvent(proc, 'message');
    proc.disconnect();
    proc.unref();
  }

  kill() {
    if (!this._client) return;

    this._client.kill();
  }

  write(serverRequest) {
    // 还没有 ready 前先存入数组，等 ready 后再一次性写入
    if (!this._clientReady) {
      this._pendingReqs.push(serverRequest);
      return;
    }
    this._client.write(serverRequest);
  }

  static get default() {
    return ClusterTsServerProcess;
  }
}

module.exports = ClusterTsServerProcess;
