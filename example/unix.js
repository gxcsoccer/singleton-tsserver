'use strict';

const net = require('net');
const path = require('path');

const server = net.createServer(socket => {
  console.log('new socket on', socket.address());
});

// server.listen(path.join(__dirname, 'xxx.sock'));
server.listen('/Users/gaoxiaochen/projj/github.com/gxcsoccer/singleton-tsserver/lib/tmp/c793036fdc9efcc5e529413472bd8593.sock')
