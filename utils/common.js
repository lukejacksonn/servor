const fs = require('fs');
const os = require('os');
const net = require('net');

const fileWatch =
  process.platform !== 'linux'
    ? (x, cb) => fs.watch(x, { recursive: true }, cb)
    : (x, cb) => {
        if (fs.statSync(x).isDirectory()) {
          fs.watch(x, cb);
          fs.readdirSync(x).forEach((xx) => fileWatch(`${x}/${xx}`, cb));
        }
      };

module.exports.fileWatch = fileWatch;

const usePort = (port = 0) =>
  new Promise((ok, x) => {
    const s = net.createServer();
    s.on('error', x);
    s.listen(port, () => (a = s.address()) && s.close(() => ok(a.port)));
  });

module.exports.usePort = usePort;

const networkIps = Object.values(os.networkInterfaces())
  .reduce((every, i) => [...every, ...i], [])
  .filter((i) => i.family === 'IPv4' && i.internal === false)
  .map((i) => i.address);

module.exports.networkIps = networkIps;
