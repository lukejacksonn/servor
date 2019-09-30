const fs = require('fs');
const url = require('url');
const path = require('path');
const http = require('http');
const https = require('https');
const proc = require('child_process');
const os = require('os');
const readline = require('readline');
const net = require('net');

const cwd = process.cwd();
const admin = process.getuid && process.getuid() === 0;

const ssl = `
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names
[alt_names]
DNS.1 = localhost
DNS.2 = 127.0.0.1
DNS.3 = ::1
`;

const ca = `
[req]
prompt = no
distinguished_name = options
[options]
C = US
ST = State
L = Locality
O = Company
CN = servor
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

const reloader = script => `
  <script>
    const source = new EventSource('/livereload');
    source.onmessage = e => location.reload(true);
    ${script}
  </script>
`;

const ngrok = (protocol, port) => `
authtoken: 1RJ1wVqDcoolLeIWrzTSRDJt4Wb_73v2muP83AeeNA14wSMY
tunnels:
  servor:
    proto: http
    addr: ${protocol}://localhost:${port}
    bind_tls: ${protocol === 'https'}
`;

const fport = () =>
  new Promise(res => {
    const s = net.createServer().listen(0, () => {
      const { port } = s.address();
      s.close(() => res(port));
    });
  });

module.exports = async ({
  root = '.',
  fallback = 'index.html',
  port,
  browse = true,
  reload = true,
  silent = true,
  inject = ''
} = {}) => {
  port = port || (await fport());

  const clients = [];
  let requests = 0;
  let server;
  let protocol;
  let tunnel;

  try {
    if (admin) {
      fs.writeFileSync(__dirname + '/ssl.conf', ssl);
      fs.writeFileSync(__dirname + '/ca.conf', ca);
      proc.execSync(__dirname + '/certify.sh', { cwd: __dirname });
      process.setuid(501);
    }
    const cert = fs.readFileSync(__dirname + '/servor.crt');
    const key = fs.readFileSync(__dirname + '/servor.key');
    protocol = 'https';
    server = cb => https.createServer({ cert, key }, cb);
  } catch (e) {
    protocol = 'http';
    server = cb => http.createServer(cb);
  }

  // Server utility functions

  const sendError = (res, resource, status) => {
    res.writeHead(status);
    res.end();
  };

  const sendFile = (res, resource, status, file, ext) => {
    res.writeHead(status, {
      'Content-Type': mimes[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(file, 'binary');
    res.end();
  };

  const sendMessage = (res, channel, data) => {
    res.write(`event: ${channel}\nid: 0\ndata: ${data}\n`);
    res.write('\n\n');
  };

  const isRouteRequest = pathname =>
    !~pathname
      .split('/')
      .pop()
      .indexOf('.');

  // Start the server on the desired port

  server((req, res) => {
    const pathname = url.parse(req.url).pathname;
    if (reload && pathname === '/livereload') {
      res.writeHead(200, {
        Connection: 'keep-alive',
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });
      sendMessage(res, 'connected', 'ready');
      setInterval(sendMessage, 60000, res, 'ping', 'waiting');
      log(clients.push(res));
    } else {
      log(requests++);
      const isRoute = isRouteRequest(pathname);
      const status = isRoute && pathname !== '/' ? 301 : 200;
      const resource = isRoute ? `/${fallback}` : decodeURI(pathname);
      const uri = path.join(cwd, root, resource);
      const ext = uri.replace(/^.*[\.\/\\]/, '').toLowerCase();
      fs.stat(uri, (err, stat) => {
        if (err) return sendError(res, resource, 404);
        fs.readFile(uri, 'binary', (err, file) => {
          if (err) return sendError(res, resource, 500);
          if (isRoute && reload) file += reloader(inject);
          sendFile(res, resource, status, file, ext);
        });
      });
    }
  }).listen(parseInt(port, 10));

  // Notify livereload clients on file change

  reload &&
    fs.watch(path.join(cwd, root), { recursive: true }, () => {
      while (clients.length > 0)
        sendMessage(clients.pop(), 'message', 'reload');
      log();
    });

  // Open the page in the default browse

  browse && proc.execSync(`${open} ${protocol}://localhost:${port}`);

  // Log state to the terminal

  console.log('\n'.repeat(process.stdout.rows));
  const log = () => {
    if (silent) return;
    readline.cursorTo(process.stdout, 0, 0);
    readline.clearScreenDown(process.stdout);
    console.log(`
  🗂  Folder:\t${cwd}/${root}
  🖥  Route:\t${root}/${fallback}

  ⚙️  Requests:\t${requests} files (${clients.length} livereload listener${
      clients.length === 1 ? '' : 's'
    })

  🏡 Local:\t${protocol}://localhost:${port}
  ${ips
    .map(ip => `📡 Network:\t${protocol}://${ip.address}:${port}`)
    .join('\n  ')} 
  ${
    typeof tunnel === 'number'
      ? `🌍 Public:\tEstablishing ngrok tunnel.` +
        Array.from({ length: tunnel })
          .map(_ => '.')
          .join('')
      : tunnel
      ? `🌍 Public:\t\x1b[4m${tunnel}\x1b[0m`
      : `🌍 Public:\tHit \x1b[4mreturn\x1b[0m to generate a public url`
  }
`);
  };

  log();

  // Return function to create public url

  return () =>
    new Promise(resolve => {
      log((tunnel = 0));
      const config = __dirname + '/ngrok.yml';
      fs.writeFileSync(config, ngrok(protocol, port));
      proc.spawn('npx', ['-q', 'ngrok', 'start', '-config', config, 'servor']);
      setInterval(function() {
        try {
          const data = proc.execSync('curl -s localhost:4040/api/tunnels');
          const url = (tunnel = JSON.parse(String(data)).tunnels[0].public_url);
          clearInterval(this);
          browse && proc.execSync(`${open} ${url}`);
          log(resolve(url));
        } catch (e) {
          log(tunnel++);
        }
      }, 1000);
    });
};
