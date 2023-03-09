import fs from 'node:fs/promises';
import url from 'node:url';
import path from 'node:path';
import http from 'node:http';
import http2 from 'node:http2';
import https from 'node:https';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import httpProxy from 'http-proxy';

const gzip = promisify(zlib.gzip);

import mimeTypes from './utils/mimeTypes';
import directoryListing from './utils/directoryListing';

import { fileWatch, usePort, networkIps } from './utils/common';
import { existsSync } from 'node:fs';

interface Options {
  root?: string;
  module?: boolean;
  fallback?: string;
  reload?: boolean;
  static?: boolean;
  inject?: string;
  credentials?: any;
  port?: string | number;
  host?: string;
  livereloadUrl?: string;
  proxy?: Record<string, string>;
  noDirListing?: boolean;
}

export const servor = async ({
  root = '.',
  module = false,
  fallback = module ? 'index.js' : 'index.html',
  reload = true,
  static: staticMode = false,
  inject = '',
  credentials,
  port: outerPort,
  host = '127.0.0.1',
  livereloadUrl = '/livereload',
  proxy: proxyConfigObj,
  noDirListing = false,
}: Options = {}) => {
  // Try start on specified port then fail or find a free port

  let port: string;
  try {
    port = await usePort(outerPort || process.env.PORT || 8080);
  } catch (e) {
    if (outerPort || process.env.PORT) {
      console.log('[ERR] The port you have specified is already in use!');
      process.exit();
    }
    port = await usePort();
  }

  const proxyConfig: Array<[RegExp, string]> = proxyConfigObj
    ? Object.keys(proxyConfigObj).map((key) => [new RegExp(key), proxyConfigObj![key]])
    : [];

  let proxy: { web: (arg0: any, arg1: any, arg2: { target: any; changeOrigin: boolean }) => any };

  // Configure globals

  root = root.startsWith('/') ? root : path.join(process.cwd(), root);

  if (!existsSync(root)) {
    console.log(`[ERR] Root directory ${root} does not exist!`);
    process.exit();
  }

  if (!(await fs.stat(root)).isDirectory()) {
    console.log(`[ERR] Root directory "${root}" is not directory!`);
    process.exit();
  }

  const reloadClients: http2.Http2ServerResponse[] = [];
  const protocol = credentials ? 'https' : 'http';
  const server = credentials
    ? reload
      ? (cb: http.RequestListener<typeof http.IncomingMessage, typeof http.ServerResponse> | undefined) =>
          https.createServer(credentials, cb)
      : (cb: ((request: http2.Http2ServerRequest, response: http2.Http2ServerResponse) => void) | undefined) =>
          http2.createSecureServer(credentials, cb)
    : (cb: http.RequestListener<typeof http.IncomingMessage, typeof http.ServerResponse> | undefined) =>
        http.createServer(cb);

  const livereload = reload
    ? `
      <script>
        const source = new EventSource('${livereloadUrl}');
        const reload = () => location.reload(true);
        source.onmessage = reload;
        source.onerror = () => (source.onopen = reload);
        console.log('[servor] listening for file changes');
      </script>
    `
    : '';

  // Server utility functions

  const isRouteRequest = (pathname: string) => !~pathname.split('/').pop()!.indexOf('.');
  const isDir = async (pathname: string) =>
    existsSync(pathname.split('/').pop()!) && (await fs.lstat(pathname.split('/').pop()!)).isDirectory();
  const utf8 = (file: WithImplicitCoercion<string> | { [Symbol.toPrimitive](hint: 'string'): string }) =>
    Buffer.from(file, 'binary').toString('utf8');

  const baseDoc = (pathname = '', base = path.join('/', pathname, '/')) =>
    `<!doctype html><meta charset="utf-8"/><base href="${base}"/>`;

  const sendError = (res: http2.Http2ServerResponse, status: number) => {
    res.writeHead(status);
    res.write(`${status}`);
    res.end();
  };

  const _sendFile = (
    res: http2.Http2ServerResponse,
    status: number,
    file: any,
    ext: string,
    encoding: BufferEncoding
  ) => {
    res.writeHead(status, { 'content-type': mimeTypes(ext as any) });
    res.write(file, encoding);
    res.end();
  };

  const sendFile = async (res: http2.Http2ServerResponse, status: number, file: any, ext: string) => {
    if (['js', 'css', 'html', 'json', 'xml', 'svg'].includes(ext)) {
      res.setHeader('content-encoding', 'gzip');
      const content = await gzip(utf8(file));
      _sendFile(res, status, content, ext, 'utf-8');
    } else {
      _sendFile(res, status, file, ext, 'binary');
    }
  };

  const sendMessage = (res: http2.Http2ServerResponse, channel: string, data: string) => {
    res.write(`event: ${channel}\nid: 0\ndata: ${data}\n`);
    res.write('\n\n');
  };

  // Respond to reload requests with keep alive

  const serveReload = (res: http2.Http2ServerResponse) => {
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

  const serveStaticFile = async (res: http2.Http2ServerResponse, pathname: string) => {
    try {
      const uri = path.join(root, pathname);
      let ext = uri.replace(/^.*[\.\/\\]/, '').toLowerCase();
      if (!existsSync(uri)) return sendError(res, 404);
      const file = await fs.readFile(uri, 'binary');

      if (pathname.endsWith('.html')) {
        await sendFile(res, 200, file + inject + livereload, ext);
      } else {
        await sendFile(res, 200, file, ext);
      }
    } catch {
      return sendError(res, 500);
    }
  };

  // Respond to requests without a file extension

  const serveRoute = async (req: http2.Http2ServerRequest, res: http2.Http2ServerResponse, pathname: string) => {
    try {
      for (let i = 0; i < proxyConfig.length; i++) {
        const [key, value] = proxyConfig[i];
        if (key.test(pathname) && proxy) {
          return proxy.web(req, res, { target: value, changeOrigin: true });
        }
      }
      const index = staticMode ? path.join(root, pathname, fallback) : path.join(root, fallback);
      if ((!existsSync(index) || (pathname.endsWith('/') && pathname !== '/')) && !noDirListing)
        return await serveDirectoryListing(res, pathname);
      const file = await fs.readFile(index, 'binary');
      const status = pathname === '/' || staticMode ? 200 : 301;
      if (module) {
        return await sendFile(res, status, `<script type='module'>${file}</script>`, 'html');
      }
      if (staticMode) {
        return await sendFile(res, status, baseDoc(pathname) + file, 'html');
      }
      return await sendFile(res, status, file + inject + livereload, 'html');
    } catch {
      return sendError(res, 500);
    }
  };

  // Respond to requests with a trailing slash

  const serveDirectoryListing = async (res: http2.Http2ServerResponse, pathname: string) => {
    const uri = path.join(root, pathname);
    if (!existsSync(uri)) return sendError(res, 404);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.write(baseDoc(pathname) + directoryListing(uri) + livereload);
    res.end();
  };

  // Start the server and route requests

  if (proxyConfig && Object.keys(proxyConfig).length > 0) {
    proxy = httpProxy.createProxyServer({});
  }

  // @ts-ignore
  server(async (req: http2.Http2ServerRequest, res: http2.Http2ServerResponse) => {
    const decodePathname = decodeURI(url.parse(req.url!).pathname!);
    const pathname = path
      .normalize(decodePathname)
      .replace(/^(\.\.(\/|\\|$))+/, '')
      .replaceAll('\\', '/');
    res.setHeader('access-control-allow-origin', '*');
    if (reload && pathname === livereloadUrl) return serveReload(res);
    if (!isRouteRequest(pathname) && !(await isDir(pathname))) return await serveStaticFile(res, pathname);
    return await serveRoute(req, res, pathname);
  }).listen(parseInt(port, 10), host);

  // Notify livereload reloadClients on file change

  reload &&
    fileWatch(root, () => {
      while (reloadClients.length > 0) sendMessage(reloadClients.pop()!, 'message', 'reload');
    });

  // Close socket connections on sigint

  process.on('SIGINT', () => {
    while (reloadClients.length > 0) reloadClients.pop()!.end();
    process.exit();
  });

  const x = { url: `${protocol}://localhost:${port}` };
  return { ...x, root, protocol, port, ips: networkIps };
};
