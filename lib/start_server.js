'use strict';

const TsProxyServer = require('./proxy_server');
const { Logger, FileTransport, ConsoleTransport } = require('egg-logger');

const options = JSON.parse(process.argv[3]);

const logger = new Logger();

if (options.logFile) {
  logger.set('file', new FileTransport({
    file: options.logFile,
    level: options.logLevel || 'INFO',
  }));
} else {
  logger.set('console', new ConsoleTransport({
    level: options.logLevel || 'INFO',
  }));
}

options.logger = logger;
const server = new TsProxyServer(options);
server.once('close', () => {
  logger.close();
});
server.ready()
  .then(() => {
    process.send('started');
  });

function handle() {
  if (server) {
    server.close();
  }
}

process.on('exit', handle);
process.on('SIGINT', handle);
process.on('SIGTERM', handle);

process.on('uncaughtException', (err, origin) => {
  // TODO:
  console.log(err, origin);
  server.close();
});
