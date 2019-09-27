const fs = require('fs');
const url = require('url');
const path = require('path');
const http = require('http');
const https = require('https');
const http2 = require('http2');
const proc = require('child_process');
const os = require('os');
const readline = require('readline');

const mimes = Object.entries(require('./types.json')).reduce(
  (all, [type, exts]) =>
    Object.assign(all, ...exts.map(ext => ({ [ext]: type }))),
  {}
);

module.exports = ({
  root = '.',
  fallback = 'index.html',
  port = 8080,
  browser = true,
  reload = true,
  silent = true,
  inject = ''
} = {}) => {
  // Define and assign constants

  const cwd = process.cwd();
  const admin = process.getuid && process.getuid() === 0;

  const clients = [];
  const reloader = `
  <script>
    const source = new EventSource('/livereload');
    source.onmessage = e => location.reload(true);
    ${inject}
  </script>
`;

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
  let tunnel;

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

  // Notify livereload clients on file change

  fs.watch(path.join(cwd, root), { recursive: true }, () => {
    while (clients.length > 0) sendMessage(clients.pop(), 'message', 'reload');
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
      // Check if a file exists at the location
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

  // Open the page in the default browser

  browser && proc.execSync(`${open} ${protocol}://localhost:${port}`);

  // Log state to the terminal

  const log = () => {
    if (silent) return;
    console.log('\n'.repeat(process.stdout.rows));
    readline.cursorTo(process.stdout, 0, 0);
    readline.clearScreenDown(process.stdout);
    console.log(`\x1b[1m\x1b[36m   ___                      
  / __| ___ _ ___ _____ _ _ 
  \\__ \\/ -_) '_\\ V / _ \\ '_|
  |___/\\___|_|  \\_/\\___/_|\x1b[0m

    
   ${
     protocol === 'http'
       ? `🔓  Serving over http (for https run sudo !!)`
       : `🔐  Serving over https (with trusted certificates)`
   }
  
   🗂   Folder:\t ${cwd}/${root}
   🖥   File:\t /${fallback}
   ♻️   Reload:\t ${reload}

   🏡  Local:\t ${protocol}://localhost:${port}
   ${ips
     .map(ip => `📡  Network:\t ${protocol}://${ip.address}:${port}`)
     .join('\n   ')}

   ${
     tunnel
       ? `🌍  Public:\t \x1b[4m${tunnel}\x1b[0m`
       : `🚇  Hit \x1b[4mreturn\x1b[0m to generate a public url`
   }`);
  };

  log();

  // Return function to create public url

  return () =>
    new Promise((resolve, reject) => {
      !silent && process.stdout.write(`   🚧  Establishing ngrok tunnel..`);
      fs.writeFileSync('ngrok.yml', ngrok);
      const cmd = ['-q', 'ngrok', 'start', '-config', 'ngrok.yml', 'servor'];
      proc.spawn('npx', cmd);
      setInterval(function() {
        try {
          const data = proc.execSync('curl -s localhost:4040/api/tunnels');
          const url = (tunnel = JSON.parse(String(data)).tunnels[0].public_url);
          browser && proc.execSync(`${open} ${url}`);
          clearInterval(this);
          log();
          resolve(url);
        } catch (e) {
          !silent && process.stdout.write('.');
        }
      }, 1000);
    });
};
