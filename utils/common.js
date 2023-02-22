const fs = require('fs');
const os = require('os');
const net = require('net');
const chokidar = require("chokidar");

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

const fileWatch = (x, cb) => {
    chokidar.watch(x).on('all', cb)
}

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
