'use strict';

const path = require('path');
const cp = require('child_process');
const { PassThrough } = require('stream');
const { TrServerDecoder } = require('./lib/protocol');

const tsServerPath = path.join(path.dirname(require.resolve('typescript')), 'tsserver.js');

const proc = cp.fork(tsServerPath, [
  '--useInferredProjectPerProjectRoot',
  '--noGetErrOnBackgroundUpdate',
  '--validateDefaultNpmLocation',
], {
  silent: true,
});

const pass = new PassThrough();
const decoder = new TrServerDecoder();

proc.stdout.pipe(decoder);

decoder.on('message', msg => {
  console.log(msg);
});

function encode(obj) {
  return JSON.stringify(obj) + '\r\n';
}

proc.stdin.write(encode({
  seq: 1,
  type: 'request',
  command: 'open',
  arguments: { file: path.join(__dirname, 'lib/tsserver_decoder.js') },
}));

proc.stdin.write(encode({
  seq: 2,
  type: 'request',
  command: 'quickinfo',
  arguments: {
    file: path.join(__dirname, 'lib/tsserver_decoder.js'),
    line: 5,
    offset: 7,
  },
}));
