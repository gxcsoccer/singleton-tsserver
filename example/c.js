'use strict';

const net = require('net');
const path = require('path');

const socket = net.connect(path.join(__dirname, 'xxx.sock'));

socket.once('connect', () => {
  console.log('connect');
});
