'use strict';

const path = require('path');
const ClusterTsServerProcess = require('../lib');

const tsServerPath = path.join(path.dirname(require.resolve('typescript')), 'tsserver.js');
const args = [
  '--useInferredProjectPerProjectRoot',
  '--noGetErrOnBackgroundUpdate',
  '--validateDefaultNpmLocation',
];
const tsServerForkOptions = {
  silent: true,
};

async function main() {
  const proc = new ClusterTsServerProcess({ tsServerPath, args, tsServerForkOptions });
  proc.stdout.on('data', data => {
    console.log(data.toString());
  });
  await proc.ready();

  proc.write({
    seq: 1,
    type: 'request',
    command: 'open',
    arguments: { file: path.join(__dirname, '../lib/protocol.js') },
  });

  proc.write({
    seq: 2,
    type: 'request',
    command: 'quickinfo',
    arguments: {
      file: path.join(__dirname, '../lib/protocol.js'),
      line: 5,
      offset: 7,
    },
  });
}

main();
