# singleton-tsserver
单实例的 [tsserver](https://github.com/Microsoft/TypeScript/wiki/Standalone-Server-%28tsserver%29)

[![NPM version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]
[![Test coverage][codecov-image]][codecov-url]
[![David deps][david-image]][david-url]
[![Known Vulnerabilities][snyk-image]][snyk-url]
[![npm download][download-image]][download-url]

[npm-image]: https://img.shields.io/npm/v/singleton-tsserver.svg?style=flat-square
[npm-url]: https://npmjs.org/package/singleton-tsserver
[travis-image]: https://img.shields.io/travis/gxcsoccer/singleton-tsserver.svg?style=flat-square
[travis-url]: https://travis-ci.org/gxcsoccer/singleton-tsserver
[codecov-image]: https://codecov.io/gh/gxcsoccer/singleton-tsserver/branch/master/graph/badge.svg
[codecov-url]: https://codecov.io/gh/gxcsoccer/singleton-tsserver
[david-image]: https://img.shields.io/david/gxcsoccer/singleton-tsserver.svg?style=flat-square
[david-url]: https://david-dm.org/gxcsoccer/singleton-tsserver
[snyk-image]: https://snyk.io/test/npm/singleton-tsserver/badge.svg?style=flat-square
[snyk-url]: https://snyk.io/test/npm/singleton-tsserver
[download-image]: https://img.shields.io/npm/dm/singleton-tsserver.svg?style=flat-square
[download-url]: https://npmjs.org/package/singleton-tsserver

针对同样的参数，只启动一个 tsserver 实例

## 用法

```js
const ClusterTsServerProcess = require('singleton-tsserver');

const options = {
  tsServerPath: '<tsServerPath>',
  args: [
    '--useInferredProjectPerProjectRoot',
    '--enableTelemetry',
    '--noGetErrOnBackgroundUpdate',
    '--validateDefaultNpmLocation',
  ],
};

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
      allowRenameOfImportPath: true,
    },
  },
});
```
