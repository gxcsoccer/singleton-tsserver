'use strict';

const path = require('path');
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

const server = new TsProxyServer({
  tsServerPath,
  args,
  tsServerForkOptions,
});
