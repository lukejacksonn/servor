#!/usr/bin/env node

const fs = require('fs');
const url = require('url');
const path = require('path');
const http = require('http');
const https = require('https');
const http2 = require('http2');
const proc = require('child_process');
const os = require('os');

// Parse arguments from the command line

const args = process.argv.slice(2).filter(x => !~x.indexOf('--'));

const root = args[0] || '.';
const fallback = args[1] || 'index.html';
const port = args[2] || 8080;

const browser = !~process.argv.indexOf('--no-browser');
const reload = !~process.argv.indexOf('--no-reload');

const cwd = process.cwd();
const admin = process.getuid && process.getuid() === 0;

// Define and assign constants

const clients = [];
const reloader = `
  <script>
    const source = new EventSource('/livereload');
    source.onmessage = e => location.reload(true);
  </script>
`;

const mimes = Object.entries(require('./types.json')).reduce(
  (all, [type, exts]) =>
    Object.assign(all, ...exts.map(ext => ({ [ext]: type }))),
  {}
);

const ips = Object.values(os.networkInterfaces())
  .reduce((every, i) => [...every, ...i], [])
  .filter(i => i.family === 'IPv4' && i.internal === false);

const open =
  process.platform == 'darwin'
    ? 'open'
    : process.platform == 'win32'
    ? 'start'
    : 'xdg-open';

let server;
let protocol;

try {
  admin && proc.execSync('cd certify && ./generate.sh');
  const cert = fs.readFileSync('servor.crt');
  const key = fs.readFileSync('servor.key');
  process.setuid(501);
  protocol = 'https';
  server = cb => https.createServer({ cert, key }, cb);
} catch (e) {
  protocol = 'http';
  server = cb => http.createServer(cb);
}

const ngrok = `authtoken: 1RJ1wVqDcoolLeIWrzTSRDJt4Wb_73v2muP83AeeNA14wSMY
tunnels:
  servor:
    proto: http
    addr: ${protocol}://localhost:${port}
    bind_tls: ${protocol === 'https'}
`;

// Server utility functions

const sendError = (res, resource, status) => {
  res.writeHead(status);
  res.end();
  console.log(' \x1b[41m', status, '\x1b[0m', `${resource}`);
};

const sendFile = (res, resource, status, file, ext) => {
  res.writeHead(status, {
    'Content-Type': mimes[ext] || 'application/octet-stream',
    'Access-Control-Allow-Origin': '*'
  });
  res.write(file, 'binary');
  res.end();
  console.log(' \x1b[42m', status, '\x1b[0m', `${resource}`);
};

const sendMessage = (res, channel, data) => {
  res.write(`event: ${channel}\nid: 0\ndata: ${data}\n`);
  res.write('\n\n');
};

const isRouteRequest = uri =>
  uri
    .split('/')
    .pop()
    .indexOf('.') === -1
    ? true
    : false;

// Notify livereload clients on file change

fs.watch(path.join(cwd, root), { recursive: true }, () => {
  while (clients.length > 0) sendMessage(clients.pop(), 'message', 'reloading');
});

// Start the server on the desired port

server((req, res) => {
  const pathname = url.parse(req.url).pathname;
  if (pathname === '/livereload') {
    // Open the event stream for live reload
    res.writeHead(200, {
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });
    // Send an initial ack event to stop any netwo pending
    sendMessage(res, 'connected', 'ready');
    // Send a ping event every minute to prevent console errors
    setInterval(sendMessage, 60000, res, 'ping', 'waiting');
    // Register connection to be notified of file changes
    clients.push(res);
  } else {
    const isRoute = isRouteRequest(pathname);
    const status = isRoute && pathname !== '/' ? 301 : 200;
    const resource = isRoute ? `/${fallback}` : decodeURI(pathname);
    const uri = path.join(cwd, root, resource);
    const ext = uri.replace(/^.*[\.\/\\]/, '').toLowerCase();
    isRoute && console.log('\n \x1b[44m', 'RELOADING', '\x1b[0m\n');
    // Check if files exists at the location
    fs.stat(uri, (err, stat) => {
      if (err) return sendError(res, resource, 404);
      // Respond with the contents of the file
      fs.readFile(uri, 'binary', (err, file) => {
        if (err) return sendError(res, resource, 500);
        if (isRoute && reload) file += reloader;
        sendFile(res, resource, status, file, ext);
      });
    });
  }
}).listen(parseInt(port, 10));

// Log startup details to terminal

console.log(`
 🗂  Serving ${root} on ${protocol}://localhost:${port}
 ${ips
   .map(ip => `📡 Exposed on ${protocol}://${ip.address}:${port}`)
   .join('\n')}
 🖥  Using ${fallback} to handle route requests
 ${reload && `♻️  Live reloading the browser when files change`}
`);

// Open the page in the default browser

browser && proc.execSync(`${open} ${protocol}://localhost:${port}`);

// Create an ngrok tunnel for localhost

fs.writeFileSync('ngrok.yml', ngrok);
proc.spawn('npx', ['ngrok', 'start', '-config', 'ngrok.yml', 'servor'], {
  stdio: 'inherit'
});
