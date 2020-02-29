'use strict';

const path = require('path');
const assert = require('assert');
const utils = require('../lib/utils');

describe('test/utils.test.js', () => {
  it('should getSockPath ok', () => {
    const tsServerPath = path.join(path.dirname(require.resolve('typescript')), 'tsserver.js');
    const args1 = [
      '--syntaxOnly',
      '--useInferredProjectPerProjectRoot',
      '--disableAutomaticTypingAcquisition',
      '--noGetErrOnBackgroundUpdate',
      '--cancellationPipeName',
      '/var/folders/q4/4nwl16wn32ndm69rzh1zyvhh0000gn/T/vscode-typescript501/f78125e6de579d114c4b/tscancellation-02c830b011e535ace5b8.tmp*',
      '--globalPlugins',
      'typescript-vscode-sh-plugin,typescript-tslint-plugin,@vsintellicode/typescript-intellicode-plugin',
      '--pluginProbeLocations',
      '/Applications/Visual Studio Code.app/Contents/Resources/app/extensions/typescript-language-features,/Users/gaoxiaochen/.vscode/extensions/ms-vscode.vscode-typescript-tslint-plugin-1.2.3,/Users/gaoxiaochen/.vscode/extensions/visualstudioexptteam.vscodeintellicode-1.2.5',
      '--noGetErrOnBackgroundUpdate',
      '--validateDefaultNpmLocation',
      '--logFile',
      '/home/admin/logs/xxx.log',
    ];
    const tsServerForkOptions = {
      silent: true,
    };
    const p1 = utils.getSockPath({
      tsServerPath,
      args: args1,
      tsServerForkOptions,
    });
    console.log(p1);

    const args2 = [
      '--syntaxOnly',
      '--useInferredProjectPerProjectRoot',
      '--disableAutomaticTypingAcquisition',
      '--noGetErrOnBackgroundUpdate',
      '--cancellationPipeName',
      '/var/folders/q4/4nwl16wn32ndm69rzh1zyvhh0000gn/T/vscode-typescript501/f78125e6de579d114c4b/tscancellation-03a6eacfe6d7a61df990.tmp*',
      '--globalPlugins',
      'typescript-vscode-sh-plugin,typescript-tslint-plugin,@vsintellicode/typescript-intellicode-plugin',
      '--pluginProbeLocations',
      '/Applications/Visual Studio Code.app/Contents/Resources/app/extensions/typescript-language-features,/Users/gaoxiaochen/.vscode/extensions/ms-vscode.vscode-typescript-tslint-plugin-1.2.3,/Users/gaoxiaochen/.vscode/extensions/visualstudioexptteam.vscodeintellicode-1.2.5',
      '--noGetErrOnBackgroundUpdate',
      '--validateDefaultNpmLocation',
    ];
    const p2 = utils.getSockPath({
      tsServerPath,
      args: args2,
      tsServerForkOptions,
    });
    console.log(p2);

    assert(p1 === p2);
  });
});
