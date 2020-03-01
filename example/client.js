'use strict';

const path = require('path');
const TsProxyClient = require('../lib/proxy_client');

async function main() {

  const client = new TsProxyClient();

  client.stdout.on('data', data => {
    console.log(data.toString());
  });

  client.write({
    seq: 1,
    type: 'request',
    command: 'open',
    arguments: { file: path.join(__dirname, '../lib/protocol.js') },
  });

  client.write({
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
