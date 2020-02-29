'use strict';

const path = require('path');
const fs = require('fs');
const ClusterTsServerProcess = require('../lib');

const options = {
  "tsServerPath": "/Users/gaoxiaochen/projj/gitlab.alipay-inc.com/cloud-ide/api-server/_extensions/kaitian.typescript-language-features-1.37.1-patch.12/node_modules/typescript/lib/tsserver.js",
  "args": [
    "--useInferredProjectPerProjectRoot",
    "--enableTelemetry",
    "--cancellationPipeName",
    "/var/folders/q4/4nwl16wn32ndm69rzh1zyvhh0000gn/T/vscode-typescript501/e6ea02d3b441c4be4f4c/tscancellation-6ecdd2ccb16d73006bfb.tmp*",
    "--locale", "zh-CN",
    "--noGetErrOnBackgroundUpdate",
    "--validateDefaultNpmLocation"
  ],
  "tsServerForkOptions": {
    "execArgv": []
  }
}

const proc = new ClusterTsServerProcess(options);
proc.stdout.on('data', data => {
  console.log(data.toString());
});

proc.write({
  seq: 0,
  type: 'request',
  command: 'configure',
  arguments: {
    hostInfo: 'vscode',
    preferences: {
      providePrefixAndSuffixTextForRename: true,
      allowRenameOfImportPath: true
    }
  }
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
      allowNonTsExtensions: true
    }
  }
});

proc.write({
  "seq": 2,
  "type": "request",
  "command": "updateOpen",
  "arguments": {
    "changedFiles": [],
    "closedFiles": [],
    "openFiles": [{
      "file": "/Users/gaoxiaochen/projj/gitlab.alipay-inc.com/cloud-ide/api-server/app/controller/home.ts",
      "fileContent": fs.readFileSync('/Users/gaoxiaochen/projj/gitlab.alipay-inc.com/cloud-ide/api-server/app/controller/home.ts', 'utf8'),
      "scriptKindName": "TS",
      "projectRootPath": "/Users/gaoxiaochen/projj/gitlab.alipay-inc.com/cloud-ide/api-server"
    }]
  }
});

// setTimeout(() => {
proc.write({
  seq: 3,
  type: 'request',
  command: 'geterr',
  arguments: {
    delay: 0,
    files: ['/Users/gaoxiaochen/projj/gitlab.alipay-inc.com/cloud-ide/api-server/app/controller/home.ts']
  }
});
// }, 5000);

proc.write({
  seq: 4,
  type: 'request',
  command: 'getSupportedCodeFixes',
  arguments: null
});
