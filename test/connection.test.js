'use strict';

const mm = require('mm');
const net = require('net');
const assert = require('assert');
const { pipeline } = require('stream');
const sleep = require('mz-modules/sleep');
const awaitEvent = require('await-event');
const TsConnection = require('../lib/connection');
const { TsServerEncoder, TsServerDecoder } = require('../lib/protocol');

const SOCKET_PORT = 16739;

describe('test/connection.test.js', () => {
  afterEach(mm.restore);

  it('should ok', async () => {
    const server = net.createServer();
    server.listen(SOCKET_PORT);
    await awaitEvent(server, 'listening');

    const clientSocket = net.connect(SOCKET_PORT, '127.0.0.1');
    const socket = await awaitEvent(server, 'connection');
    const conn = new TsConnection({
      socket,
    });
    assert(conn);

    const encoder = new TsServerEncoder();
    const decoder = new TsServerDecoder();
    pipeline(encoder, clientSocket, decoder, err => {
      if (err) {
        console.error(err);
      }
    });

    const lastActiveTime = conn.lastActiveTime;

    encoder.writeMessage({
      seq: 1,
      type: 'ping',
    });

    await sleep(100);
    // const pong = await awaitEvent(decoder, 'message');
    // assert.deepEqual(pong, { type: 'pong', request_seq: 1 });

    assert(conn.lastActiveTime > lastActiveTime);

    encoder.writeMessage({
      seq: 2,
      type: 'request',
      command: 'open',
      arguments: { file: __filename },
    });

    let req = await conn.await('request');
    assert(conn.peddingReqs && conn.peddingReqs.size === 1);
    assert.deepEqual(conn.peddingReqs.get(2), req);
    conn.responseTimeout(2);

    encoder.writeMessage({
      seq: 3,
      type: 'request',
      command: 'quickinfo',
      arguments: {
        file: __filename,
        line: 3,
        offset: 7,
      },
    });

    req = await conn.await('request');
    assert(conn.peddingReqs && conn.peddingReqs.size === 1);
    assert.deepEqual(conn.peddingReqs.get(3), req);

    conn.writeResponse(3, {
      type: 'response',
      request_seq: 3,
      success: false,
      command: 'quickinfo',
      message: 'unknow error',
    });
    assert(conn.peddingReqs.size === 0);

    const res = await awaitEvent(decoder, 'message');
    assert.deepEqual(res, {
      type: 'response',
      request_seq: 3,
      success: false,
      command: 'quickinfo',
      message: 'unknow error',
    });

    await conn.close();
    await conn.close();

    server.close();
    await awaitEvent(server, 'close');
  });

  it('should close after idle for a while', async () => {
    const server = net.createServer();
    server.listen(SOCKET_PORT);
    await awaitEvent(server, 'listening');

    net.connect(SOCKET_PORT, '127.0.0.1');
    const socket = await awaitEvent(server, 'connection');
    const conn = new TsConnection({
      socket,
      maxIdleTime: 1000,
    });
    assert(conn);
    assert(!conn.isClosed);

    await sleep(2000);

    assert(conn.isClosed);

    server.close();
    await awaitEvent(server, 'close');
  });

  it('should log unknow message type', async () => {
    const server = net.createServer();
    server.listen(SOCKET_PORT);
    await awaitEvent(server, 'listening');

    const clientSocket = net.connect(SOCKET_PORT, '127.0.0.1');
    const encoder = new TsServerEncoder();
    const decoder = new TsServerDecoder();
    pipeline(encoder, clientSocket, decoder, err => {
      if (err) {
        console.error(err);
      }
    });

    const socket = await awaitEvent(server, 'connection');
    let warnArgs;
    const conn = new TsConnection({
      socket,
      logger: {
        warn(...args) {
          warnArgs = args;
        },
      },
    });
    assert(conn);

    encoder.writeMessage({
      seq: 1,
      type: 'xxx',
    });

    await sleep(200);

    assert(warnArgs);

    const errMsg = warnArgs[3];
    assert(errMsg === `unknow message: ${JSON.stringify({ seq: 1, type: 'xxx' })}`);

    conn.close();
    server.close();
    await awaitEvent(server, 'close');
  });
});
