'use strict';

const path = require('path');
const utils = require('../lib/utils');

const tsServerPath = path.join(path.dirname(require.resolve('typescript')), 'tsserver.js');
const args = [
  '--useInferredProjectPerProjectRoot',
  '--noGetErrOnBackgroundUpdate',
  '--validateDefaultNpmLocation',
];
const tsServerForkOptions = {
  silent: true,
};

console.log(utils.md5(JSON.stringify({
  tsServerPath,
  args,
  tsServerForkOptions,
})));
