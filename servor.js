const fs = require('fs');
const url = require('url');
const path = require('path');
const http = require('http');
const http2 = require('http2');
const https = require('https');
const os = require('os');
const net = require('net');
const zlib = require('zlib');
const cwd = process.cwd();

const watch =
  process.platform !== 'linux'
    ? (x, cb) => fs.watch(x, { recursive: true }, cb)
    : (x, cb) => {
        if (fs.statSync(x).isDirectory()) {
          fs.watch(x, cb);
          fs.readdirSync(x).forEach((xx) => watch(`${x}/${xx}`, cb));
        }
      };

const freePort = (port = 0) =>
  new Promise((ok, x) => {
    const s = net.createServer();
    s.on('error', x);
    s.listen(port, () => (a = s.address()) && s.close(() => ok(a.port)));
  });

const ips = Object.values(os.networkInterfaces())
  .reduce((every, i) => [...every, ...i], [])
  .filter((i) => i.family === 'IPv4' && i.internal === false)
  .map((i) => i.address);

const mimes = Object.entries(require('./types.json')).reduce(
  (all, [type, exts]) =>
    Object.assign(all, ...exts.map((ext) => ({ [ext]: type }))),
  {}
);

module.exports = async ({
  root = '.',
  module = false,
  fallback = module ? 'index.js' : 'index.html',
  port,
  reload = true,
  routes = false,
  inject = '',
  credentials,
} = {}) => {
  // Try start on specified port then fail or find a free port

  try {
    port = await freePort(port || process.env.PORT || 8080);
  } catch (e) {
    if (port || process.env.PORT) {
      console.log('[ERR] The port you have specified is already in use!');
      process.exit();
    }
    port = await freePort();
  }

  // Configure globals

  root = root.startsWith('/') ? root : path.join(cwd, root);
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

  const sendError = (res, status) => {
    res.writeHead(status);
    res.write(`${status}`);
    res.end();
  };

  const sendFile = (res, status, file, ext, encoding = 'binary') => {
    if (['js', 'css', 'html', 'json', 'xml', 'svg'].includes(ext)) {
      res.removeHeader('Content-Length');
      res.setHeader('Content-Encoding', 'gzip');
      file = zlib.gzipSync(utf8(file));
      encoding = 'utf8';
    }
    res.writeHead(status, {
      'Content-Type': mimes[ext] || 'application/octet-stream',
    });
    res.write(file, encoding);
    res.end();
  };

  const sendMessage = (res, channel, data) => {
    res.write(`event: ${channel}\nid: 0\ndata: ${data}\n`);
    res.write('\n\n');
  };

  const serveReload = (res) => {
    res.writeHead(200, {
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    });
    sendMessage(res, 'connected', 'ready');
    setInterval(sendMessage, 60000, res, 'ping', 'waiting');
    reloadClients.push(res);
  };

  const serveStaticFile = (res, pathname) => {
    const uri = path.join(root, pathname);
    let ext = uri.replace(/^.*[\.\/\\]/, '').toLowerCase();
    if (!fs.existsSync(uri)) return sendError(res, 404);
    fs.readFile(uri, 'binary', (err, file) =>
      err ? sendError(res, 500) : sendFile(res, 200, file, ext)
    );
  };

  const serveRoute = (res, pathname) => {
    const uri = routes
      ? path.join(root, pathname, fallback)
      : path.join(root, fallback);
    if (!fs.existsSync(uri)) return sendError(res, 404);
    fs.readFile(uri, 'binary', (err, file) => {
      if (err) return sendError(res, 500);
      const status = pathname === '/' || routes ? 200 : 301;
      const base = path.join('/', pathname, '/');
      const doc = `<!doctype html><meta charset="utf-8"/><base href="${base}"/>`;
      if (module) file = `<script type='module'>${file}</script>`;
      file = doc + file + inject + livereload;
      sendFile(res, status, file, 'html');
    });
  };

  // Start the server on the desired port

  server((req, res) => {
    const pathname = decodeURI(url.parse(req.url).pathname);
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (reload && pathname === '/livereload') return serveReload(res);
    if (!isRouteRequest(pathname)) return serveStaticFile(res, pathname);
    return serveRoute(res, pathname);
  }).listen(parseInt(port, 10));

  // Notify livereload reloadClients on file change

  reload &&
    watch(root, () => {
      while (reloadClients.length > 0)
        sendMessage(reloadClients.pop(), 'message', 'reload');
    });

  // Close socket connections on sigint

  process.on('SIGINT', () => {
    while (reloadClients.length > 0) reloadClients.pop().end();
    process.exit();
  });

  return {
    url: `${protocol}://localhost:${port}`,
    root,
    protocol,
    port,
    ips,
  };
};
