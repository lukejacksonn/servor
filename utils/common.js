const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');

// recursive function that checks if a file is still changing
const awaitWriteFinish = (path, prev, cb) => {
  fs.stat(path, { bigint: true }, (err, stat) => {
    if (err) {
      throw err;
    }
    if (stat.mtimeNs === prev.mtimeNs) {
      cb();
    } else {
      setTimeout(awaitWriteFinish, 50, path, stat, cb);
    }
  });
};

const fileWatch =
  process.platform !== 'linux'
    ? (x, cb) =>
        fs.watch(x, {recursive: true}, (_, filename) => {
          if (filename !== null) { // filename can be null on windows
              const fileChanged = path.join(x, filename);
              awaitWriteFinish(fileChanged, {}, cb);
          } else {
              setTimeout(cb, 50);
          }
        })
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
