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
  process.platform === 'linux'
    ? (path, cb) => {
        if (fs.statSync(path).isDirectory()) {
          fs.watch(path, cb);
          fs.readdirSync(path).forEach((entry) =>
            watch(`${path}/${entry}`, cb)
          );
        }
      }
    : (path, cb) => fs.watch(path, { recursive: true }, cb);

const fport = (p = 0) =>
  new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on('error', reject);
    s.listen(p, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
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
  fallback = 'index.html',
  port,
  reload = true,
  routes = false,
  inject,
  credentials,
} = {}) => {
  // Try start on specified port or find a free one

  try {
    port = await fport(port || process.env.PORT || 8080);
  } catch (e) {
    if (port || process.env.PORT) {
      console.log('[ERR] The port you have specified is already in use!');
      process.exit();
    }
    port = await fport();
  }

  // Configure globals

  root = root.startsWith('/') ? root : path.join(cwd, root);
  const clients = [];
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

  const sendError = (res, status) => {
    res.writeHead(status);
    res.end();
  };

  const sendFile = (res, status, file, ext, encoding = 'binary') => {
    if (['js', 'css', 'html', 'json', 'xml', 'svg'].includes(ext)) {
      res.removeHeader('Content-Length');
      res.setHeader('Content-Encoding', 'gzip');
      file = zlib.gzipSync(Buffer.from(file, 'binary').toString('utf8'));
      encoding = 'utf8';
    }
    res.writeHead(status, {
      'Content-Type': mimes[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
    });
    res.write(file, encoding);
    res.end();
  };

  const sendMessage = (res, channel, data) => {
    res.write(`event: ${channel}\nid: 0\ndata: ${data}\n`);
    res.write('\n\n');
  };

  const indexFileExists = (pathname) =>
    fs.existsSync(`${root}${pathname}/index.html`);

  const isRouteRequest = (pathname) => !~pathname.split('/').pop().indexOf('.');

  // Start the server on the desired port

  server((req, res) => {
    const pathname = url.parse(req.url).pathname;
    if (reload && pathname === '/livereload') {
      res.writeHead(200, {
        Connection: 'keep-alive',
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      });
      sendMessage(res, 'connected', 'ready');
      setInterval(sendMessage, 60000, res, 'ping', 'waiting');
      clients.push(res);
    } else {
      const isRoute = isRouteRequest(pathname);
      const hasRoute = isRoute && routes && indexFileExists(pathname);
      const status = isRoute && pathname !== '/' ? 301 : 200;
      const resource = isRoute
        ? hasRoute
          ? `/${decodeURI(pathname)}/${fallback}`
          : `/${fallback}`
        : decodeURI(pathname);
      const uri = path.join(root, resource);
      const ext = uri.replace(/^.*[\.\/\\]/, '').toLowerCase();
      const base = path.join('/', pathname, '/');
      fs.stat(uri, (err, stat) => {
        if (err) return sendError(res, resource, 404);
        fs.readFile(uri, 'binary', (err, file) => {
          if (err) return sendError(res, resource, 500);
          if (isRoute && inject) file = inject + file;
          if (isRoute && reload) file = livereload + file;
          if (isRoute && hasRoute)
            file = `<!doctype html><base href="${base}" />` + file;
          sendFile(res, resource, status, file, ext);
        });
      });
    }
  }).listen(parseInt(port, 10));

  // Notify livereload clients on file change

  reload &&
    watch(root, () => {
      while (clients.length > 0)
        sendMessage(clients.pop(), 'message', 'reload');
    });

  // Close socket connections on sigint

  process.on('SIGINT', () => {
    while (clients.length > 0) clients.pop().end();
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
