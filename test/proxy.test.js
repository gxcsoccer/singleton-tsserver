'use strict';

const path = require('path');
const uuid = require('uuid');
const assert = require('assert');
const sleep = require('mz-modules/sleep');
const awaitEvent = require('await-event');
const rimraf = require('mz-modules/rimraf');
const TsProxyClient = require('../lib/proxy_client');
const TsProxyServer = require('../lib/proxy_server');

const tsServerPath = path.join(path.dirname(require.resolve('typescript')), 'tsserver.js');
const args = [
  '--useInferredProjectPerProjectRoot',
  '--noGetErrOnBackgroundUpdate',
  '--validateDefaultNpmLocation',
];
const tsServerForkOptions = {
  silent: true,
};

describe('test/proxy.test.js', () => {
  before(async () => {
    await rimraf(path.join(__dirname, '.tmp'));
  });
  after(async () => {
    await rimraf(path.join(__dirname, '.tmp'));
  });

  it('should init one tsserver', async () => {
    const server = new TsProxyServer({
      tsServerPath,
      args,
      tsServerForkOptions,
    });
    await server.ready();

    const server2 = new TsProxyServer({
      tsServerPath,
      args,
      tsServerForkOptions,
    });
    await server2.ready();

    await server2.close();
    await server.close();
  });

  it('should ok', async () => {
    const server = new TsProxyServer({
      tsServerPath,
      args,
      tsServerForkOptions,
    });
    await server.ready();

    const client = new TsProxyClient({
      tsServerPath,
      args,
      tsServerForkOptions,
    });
    client.write({
      seq: 1,
      type: 'request',
      command: 'open',
      arguments: { file: path.join(__dirname, '../lib/protocol.js') },
    });

    client.write({
      seq: 2,
      type: 'request',
      command: 'quickinfo',
      arguments: {
        file: path.join(__dirname, '../lib/protocol.js'),
        line: 5,
        offset: 7,
      },
    });

    const data = await awaitEvent(client.stdout, 'data');
    console.log(data.toString());

    await server.close();
  });

  it('should kill server by client', async () => {
    const server = new TsProxyServer({
      tsServerPath,
      args,
      tsServerForkOptions,
    });
    await server.ready();

    const client = new TsProxyClient({
      tsServerPath,
      args,
      tsServerForkOptions,
    });

    client.write({
      seq: 1,
      type: 'kill',
    });

    await server.await('close');
  });

  it('should dispatch event to all clients', async () => {
    const server = new TsProxyServer({
      tsServerPath,
      args,
      tsServerForkOptions,
    });
    await server.ready();

    const client1 = new TsProxyClient({
      tsServerPath,
      args,
      tsServerForkOptions,
    });
    const client2 = new TsProxyClient({
      tsServerPath,
      args,
      tsServerForkOptions,
    });

    client1.write({
      seq: 1,
      type: 'request',
      command: 'open',
      arguments: { file: path.join(__dirname, 'fixtures/ts-app/index.ts') },
    });

    const [ data1, data2 ] = await Promise.all([
      awaitEvent(client1.stdout, 'data'),
      awaitEvent(client2.stdout, 'data'),
    ]);
    console.log(data1.toString());
    console.log(data2.toString());

    await server.close();
  });

  it('should auto clear timeout request', async () => {
    const server = new TsProxyServer({
      tsServerPath,
      args,
      tsServerForkOptions,
      responseTimeout: 1000,
    });
    await server.ready();

    const client = new TsProxyClient({
      tsServerPath,
      args,
      tsServerForkOptions,
    });

    client.write({
      seq: 1,
      type: 'request',
      command: 'open',
      arguments: { file: path.join(__dirname, 'fixtures/ts-app/index.ts') },
    });

    await sleep(100);

    assert(server.peddingRequests && server.peddingRequests.size === 1);

    await sleep(1000);

    assert(server.peddingRequests && server.peddingRequests.size === 0);

    await server.close();
  });

  it('should cancel request', async () => {
    const newArgs = args.concat([
      '--cancellationPipeName',
      path.join(__dirname, '.tmp/tscancellation', uuid.v4() + '.tmp*'),
    ]);
    const server = new TsProxyServer({
      tsServerPath,
      args: newArgs,
      tsServerForkOptions,
      responseTimeout: 3000,
    });
    await server.ready();

    const client = new TsProxyClient({
      tsServerPath,
      args: newArgs,
      tsServerForkOptions,
    });
    client.stdout.on('data', data => {
      console.log(data.toString());
    });

    client.write({
      seq: 1,
      type: 'request',
      command: 'open',
      arguments: { file: path.join(__dirname, 'fixtures/ts-app/index.ts') },
    });
    client.write({
      seq: 2,
      type: 'request',
      command: 'quickinfo',
      arguments: {
        file: path.join(__dirname, 'fixtures/ts-app/index.ts'),
        line: 2,
        offset: 1,
      },
    });

    await sleep(100);
    assert(server.peddingRequests && server.peddingRequests.size === 2);

    client.cancel(2);
    await sleep(100);
    assert(server.peddingRequests && server.peddingRequests.size === 1);

    await sleep(5000);
    assert(server.peddingRequests && server.peddingRequests.size === 0);

    await server.close();
  });

  it('should send ping if idle for a while', async () => {
    const server = new TsProxyServer({
      tsServerPath,
      args,
      tsServerForkOptions,
    });
    await server.ready();

    const client = new TsProxyClient({
      tsServerPath,
      args,
      tsServerForkOptions,
      maxIdleTime: 6000,
    });
    await client.ready();

    client.write({
      seq: 1,
      type: 'request',
      command: 'open',
      arguments: { file: path.join(__dirname, 'fixtures/ts-app/index.ts') },
    });

    const firstTime = client._lastActiveTime;

    await sleep(3100);

    const secondTime = client._lastActiveTime;
    assert(secondTime > firstTime);

    await server.close();
  });
});
