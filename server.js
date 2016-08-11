
const fs = require('fs');
const url = require('url');
const path = require('path');
const http = require('http');
const mime = require('mime');

// CLI arguments

const root = process.argv[2]; // www
const file = process.argv[3]; // index.html
const port = process.argv[4]; // 8080
const cwd = process.cwd();

let index;

// Try put the root file in memory

try {
  const uri = path.join(process.cwd(), root, file);
  index = fs.readFileSync(uri);
} catch(e) {
  console.log(`[ERR] Could not start server, root file not found`);
  console.log(`[TRY] http-server-spa <dir> <file> <port>`);
  process.exit();
}

function readFile(res, uri) {
  fs.readFile(uri, 'binary', (err, file) => {
    if (err) sendError(res);
    else sendFile(res, uri, file);
  });
};

function sendError(res) {
  res.writeHead(500);
  res.write('500 Server Error');
  res.end();
}

function sendNotFound(res) {
  res.writeHead(404);
  res.write('404 Not Found');
  res.end();
}

function sendIndex(res, status) {
  if (process.env.NODE_ENV !== 'production') {
    const uri = path.join(process.cwd(), root, file);
    index = fs.readFileSync(uri);
  }
  res.writeHead(status, { 'Content-Type': 'text/html' });
  res.write(index);
  res.end();
}

function sendFile(res, uri, data) {
  res.writeHead(200, { 'Content-Type': mime.lookup(uri) });
  res.write(data, 'binary');
  res.end();
}

function isRootRequest(uri) {
  return uri.split('/').pop().indexOf('.') === -1 ? true : false;
}

http.createServer((req, res) => {
  const uri = url.parse(req.url).pathname;
  const resource = path.join(cwd, root, uri);
  // A route was requested
  if(isRootRequest(uri)) {
    sendIndex(res, uri === '/' ? 200 : 301);
    return;
  }
  // A file was requested
  fs.stat(resource, function(err, stat) {
    if (err === null) readFile(res, resource);
    else sendNotFound(res);
  });
}).listen(parseInt(port, 10));
