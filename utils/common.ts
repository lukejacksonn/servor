import fs from 'fs';
import os, { NetworkInterfaceInfo } from 'os';
import net from 'net';
import chokidar from 'chokidar';

// recursive function that checks if a file is still changing
const awaitWriteFinish = (path: fs.PathLike, prev: { mtimeNs: bigint }, cb: () => void) => {
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

export const fileWatch = (
  x: string | readonly string[],
  cb: (
    eventName: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir',
    path: string,
    stats?: fs.Stats | undefined
  ) => void
) => {
  chokidar.watch(x).on('all', cb);
};

export const usePort = (port: number | string = 0) =>
  new Promise<string>((ok, x) => {
    const s = net.createServer();
    s.on('error', x);
    s.listen(port, () => {
      const a = s.address();
      s.close(() => (a ? ok(typeof a === 'string' ? a : a.port.toString()) : void 0));
    });
  });

export const networkIps = Object.values(os.networkInterfaces())
  .flat()
  .filter((i): i is NetworkInterfaceInfo => i?.family === 'IPv4' && i?.internal === false)
  .map((i) => i.address);
