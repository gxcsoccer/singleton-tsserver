'ues strict';

module.exports = {
  write: true,
  prefix: '^',
  devprefix: '^',
  exclude: [
    'test/fixtures',
  ],
  devdep: [
    'autod',
    'egg-ci',
    'egg-bin',
    'vscode',
    'eslint',
    'eslint-config-egg',
    'typescript',
    'contributors',
  ],
  keep: [
    'vscode',
  ],
  semver: [],
};
