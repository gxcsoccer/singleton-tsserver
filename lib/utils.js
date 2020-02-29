'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const mkdirp = require('mz-modules/mkdirp');

function md5(input) {
  const result = crypto.createHash('md5').update(input).digest('base64');
  return result.replace(/=/gi, '*').replace(/\//ig, '_');
}

exports.md5 = md5;

exports.getSockPath = options => {
  mkdirp.sync(path.join(os.homedir(), '.cloudide/ts'));
  const { tsServerPath, args, tsServerForkOptions } = options;

  const newArgs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--cancellationPipeName' || args[i] === '--logFile') {
      i = i + 1;
      continue;
    } else {
      newArgs.push(args[i]);
    }
  }

  return path.join(os.homedir(), '.cloudide/ts', md5(JSON.stringify({
    tsServerPath,
    args: newArgs,
    tsServerForkOptions,
  })));
};
