'use strict';

const fs = require('fs');
const path = require('path');
const uuid = require('uuid');
const assert = require('assert');
const { pipeline } = require('stream');
const sleep = require('mz-modules/sleep');
const awaitEvent = require('await-event');
const rimraf = require('mz-modules/rimraf');
const ClusterTsServerProcess = require('../lib');
const { TsServerDecoder } = require('../lib/protocol');

const tsServerPath = path.join(path.dirname(require.resolve('typescript')), 'tsserver.js');
const tsServerForkOptions = {
  silent: true,
};

const logFile = path.join(__dirname, '.tmp', 'logs/tsserver.log');

describe('test/index.test.js', () => {
  before(async () => {
    await rimraf(path.join(__dirname, '.tmp'));
  });

  it('should work', async () => {
    const options = {
      tsServerPath,
      args: [
        '--useInferredProjectPerProjectRoot',
        '--enableTelemetry',
        '--cancellationPipeName',
        path.join(__dirname, '.tmp/tscancellation', uuid.v4() + '.tmp*'),
        '--locale', 'zh-CN',
        '--noGetErrOnBackgroundUpdate',
        '--validateDefaultNpmLocation',
      ],
      tsServerForkOptions,
      logFile,
      logLevel: 'DEBUG',
    };
    const proc = new ClusterTsServerProcess(options);
    assert(proc && proc.requestCanceller);

    const decoder = new TsServerDecoder();

    pipeline(proc.stdout, decoder, err => {
      if (err) {
        console.error(err);
      }
    });

    proc.write({
      seq: 0,
      type: 'request',
      command: 'configure',
      arguments: {
        hostInfo: 'vscode',
        preferences: {
          providePrefixAndSuffixTextForRename: true,
          allowRenameOfImportPath: true,
        },
      },
    });

    proc.write({
      seq: 1,
      type: 'request',
      command: 'compilerOptionsForInferredProjects',
      arguments: {
        options: {
          module: 'commonjs',
          target: 'es2016',
          jsx: 'preserve',
          allowJs: true,
          allowSyntheticDefaultImports: true,
          allowNonTsExtensions: true,
        },
      },
    });

    proc.write({
      seq: 2,
      type: 'request',
      command: 'updateOpen',
      arguments: {
        changedFiles: [],
        closedFiles: [],
        openFiles: [{
          file: path.join(__dirname, 'fixtures/ts-app/index.ts'),
          fileContent: fs.readFileSync(path.join(__dirname, 'fixtures/ts-app/index.ts'), 'utf8'),
          scriptKindName: 'TS',
          projectRootPath: path.join(__dirname, 'fixtures/ts-app'),
        }],
      },
    });

    proc.write({
      seq: 3,
      type: 'request',
      command: 'geterr',
      arguments: {
        delay: 0,
        files: [ path.join(__dirname, 'fixtures/ts-app/index.ts') ],
      },
    });

    proc.write({
      seq: 4,
      type: 'request',
      command: 'getSupportedCodeFixes',
      arguments: null,
    });


    const reqSet = new Set([ 0, 1, 2, 3, 4 ]);

    decoder.on('message', msg => {
      if (msg.type === 'response') {
        console.log('response --------------->', msg);
        assert(reqSet.has(msg.request_seq));
        reqSet.delete(msg.request_seq);
      } else if (msg.type === 'event' && msg.event === 'requestCompleted') {
        console.log('requestCompleted -------------->', msg);
        assert(reqSet.has(msg.body.request_seq));
        reqSet.delete(msg.body.request_seq);
      }
      if (reqSet.size === 0) {
        decoder.emit('finished');
      }
    });

    await awaitEvent(decoder, 'finished');

    console.log('----------------> kill');
    proc.kill();

    await proc.await('exit');
    await sleep(100);

    assert(fs.existsSync(logFile));
  });

  it('should support export default', () => {
    assert(ClusterTsServerProcess === ClusterTsServerProcess.default);
  });
});
