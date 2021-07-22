const express = require('express');
const app = express();
const debug = require('debug')('pssst:server');
const server = require('http').Server(app);
const socket = require('./server/sockets')(server);

console.log("PSSST Web & Socket Server.");
console.log("Press Ctrl-C to exit.\n\n");

app.get ('/', (req, res) => {
    res.sendFile(__dirname + '/client/index.html');
})
//app.use ('/server', express.static(__dirname + '/server'));
app.use ('/client', express.static(__dirname + '/client'));
app.use ('/scripts', express.static(__dirname + '/client/scripts'));
app.use ('/css', express.static(__dirname + '/client/css'));

const port = normalizePort(process.env.PORT || '3000');
app.set('port', port);
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

function normalizePort(val) {
  let port = parseInt(val, 10);
  if (isNaN(port)) return val;
  if (port >= 0) return port;
  return false;
}

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }
  let bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function onListening() {
  let addr = server.address();
  let bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}
