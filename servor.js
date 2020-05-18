const fs = require('fs');
const url = require('url');
const path = require('path');
const http = require('http');
const http2 = require('http2');
const https = require('https');
const zlib = require('zlib');

const mimeTypes = require('./utils/mimeTypes.js');
const directoryListing = require('./utils/directoryListing.js');

const { fileWatch, usePort, networkIps } = require('./utils/common.js');

module.exports = async ({
  root = '.',
  module = false,
  fallback = module ? 'index.js' : 'index.html',
  reload = true,
  static = false,
  inject = '',
  credentials,
  port,
} = {}) => {
  // Try start on specified port then fail or find a free port

  try {
    port = await usePort(port || process.env.PORT || 8080);
  } catch (e) {
    if (port || process.env.PORT) {
      console.log('[ERR] The port you have specified is already in use!');
      process.exit();
    }
    port = await usePort();
  }

  // Configure globals

  root = root.startsWith('/') ? root : path.join(process.cwd(), root);

  const reloadClients = [];
  const protocol = credentials ? 'https' : 'http';
  const server = credentials
    ? reload
      ? (cb) => https.createServer(credentials, cb)
      : (cb) => http2.createSecureServer(credentials, cb)
    : (cb) => http.createServer(cb);

  const livereload = reload
    ? `
      <script>
        const source = new EventSource('/livereload');
        const reload = () => location.reload(true);
        source.onmessage = reload;
        source.onerror = () => (source.onopen = reload);
        console.log('[servor] listening for file changes');
      </script>
    `
    : '';

  // Server utility functions

  const isRouteRequest = (pathname) => !~pathname.split('/').pop().indexOf('.');
  const utf8 = (file) => Buffer.from(file, 'binary').toString('utf8');

  const baseDoc = (pathname = '', base = path.join('/', pathname, '/')) =>
    `<!doctype html><meta charset="utf-8"/><base href="${base}"/>`;

  const sendError = (res, status) => {
    res.writeHead(status);
    res.write(`${status}`);
    res.end();
  };

  const sendFile = (res, status, file, ext, encoding = 'binary') => {
    if (['js', 'css', 'html', 'json', 'xml', 'svg'].includes(ext)) {
      res.setHeader('content-encoding', 'gzip');
      file = zlib.gzipSync(utf8(file));
      encoding = 'utf8';
    }
    res.writeHead(status, { 'content-type': mimeTypes(ext) });
    res.write(file, encoding);
    res.end();
  };

  const sendMessage = (res, channel, data) => {
    res.write(`event: ${channel}\nid: 0\ndata: ${data}\n`);
    res.write('\n\n');
  };

  // Respond to reload requests with keep alive

  const serveReload = (res) => {
    res.writeHead(200, {
      connection: 'keep-alive',
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
    });
    sendMessage(res, 'connected', 'ready');
    setInterval(sendMessage, 60000, res, 'ping', 'waiting');
    reloadClients.push(res);
  };

  // Respond to requests with a file extension

  const serveStaticFile = (res, pathname) => {
    const uri = path.join(root, pathname);
    let ext = uri.replace(/^.*[\.\/\\]/, '').toLowerCase();
    if (!fs.existsSync(uri)) return sendError(res, 404);
    fs.readFile(uri, 'binary', (err, file) =>
      err ? sendError(res, 500) : sendFile(res, 200, file, ext)
    );
  };

  // Respond to requests without a file extension

  const serveRoute = (res, pathname) => {
    const index = static
      ? path.join(root, pathname, fallback)
      : path.join(root, fallback);
    if (!fs.existsSync(index) || (pathname.endsWith('/') && pathname !== '/'))
      return serveDirectoryListing(res, pathname);
    fs.readFile(index, 'binary', (err, file) => {
      if (err) return sendError(res, 500);
      const status = pathname === '/' || static ? 200 : 301;
      if (module) file = `<script type='module'>${file}</script>`;
      if (static) file = baseDoc(pathname) + file;
      file = file + inject + livereload;
      sendFile(res, status, file, 'html');
    });
  };

  // Respond to requests with a trailing slash

  const serveDirectoryListing = (res, pathname) => {
    const uri = path.join(root, pathname);
    if (!fs.existsSync(uri)) return sendError(res, 404);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.write(baseDoc(pathname) + directoryListing(uri) + livereload);
    res.end();
  };

  // Start the server and route requests

  server((req, res) => {
    const pathname = decodeURI(url.parse(req.url).pathname);
    res.setHeader('access-control-allow-origin', '*');
    if (reload && pathname === '/livereload') return serveReload(res);
    if (!isRouteRequest(pathname)) return serveStaticFile(res, pathname);
    return serveRoute(res, pathname);
  }).listen(parseInt(port, 10));

  // Notify livereload reloadClients on file change

  reload &&
    fileWatch(root, () => {
      while (reloadClients.length > 0)
        sendMessage(reloadClients.pop(), 'message', 'reload');
    });

  // Close socket connections on sigint

  process.on('SIGINT', () => {
    while (reloadClients.length > 0) reloadClients.pop().end();
    process.exit();
  });

  const x = { url: `${protocol}://localhost:${port}` };
  return { ...x, root, protocol, port, ips: networkIps };
};
