#!/usr/bin/env node

(function() {

  const fs = require('fs');
  const url = require('url');
  const path = require('path');
  const http = require('http');
  const mime = Object.entries(require('./types.json'))
    .reduce((all, [key, vals]) =>
      Object.assign(all, ...vals.map(ext => ({ [ext]: key }))),
      {}
    );

  // ----------------------------------
  // Parse arguments from the command line
  // ----------------------------------

  const root = process.argv[2];
  const file = process.argv[3] || 'index.html';
  const port = process.argv[4] || 8080;
  const watch = process.argv.filter(x => x === '--watch').length
  const cwd = process.cwd();

  let index;

  // ----------------------------------
  // Try put the root file in memory
  // ----------------------------------

  try {
    const uri = path.join(process.cwd(), root, file);
    index = fs.readFileSync(uri);
  } catch(e) {
    console.log(`[ERR] Could not start server, fallback file not found`);
    console.log(`[TRY] http-server-spa <directory> <fallback> <port>`);
    process.exit();
  }

  // ----------------------------------
  // Server utility functions
  // ----------------------------------

  function readFile(res, uri) {
    fs.readFile(uri, 'binary', (err, file) => {
      if (err) sendError(res);
      else sendFile(res, uri, file);
    });
  };

  function sendError(res) {
    res.writeHead(500);
    res.write('500 Server Error');
    res.end();
  }

  function sendNotFound(res) {
    res.writeHead(404);
    res.write('404 Not Found');
    res.end();
  }

  function sendIndex(res, status) {
    if (process.env.NODE_ENV !== 'production') {
      const uri = path.join(process.cwd(), root, file);
      index = fs.readFileSync(uri);
      if(watch) {
        index += `
          <script>
            const source = new EventSource('http://localhost:5000');
            source.onmessage = e => location.reload(true);
          </script>
        `
      }
    }
    res.writeHead(status, { 'Content-Type': 'text/html' });
    res.write(index);
    res.end();
  }

  function sendFile(res, uri, data) {
    const ext = uri.replace(/^.*[\.\/\\]/, '').toLowerCase()
    res.writeHead(200, { 'Content-Type': mime[ext] || "application/octet-stream" });
    res.write(data, 'binary');
    res.end();
  }

  function isRouteRequest(uri) {
    return uri.split('/').pop().indexOf('.') === -1 ? true : false;
  }

  // ----------------------------------
  // Start file watching server
  // ----------------------------------

  watch && http.createServer((request, res) => {
    // Open the event stream for live reload
    res.writeHead(200, {
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    let id = 0
    // Send an initial ack event
    res.write(`event: connected\nid: ${id++}\ndata: awaiting message\n`);
    res.write('\n\n');
    // Send a ping event every minute to prevent console errors
    setInterval(() => {
      res.write(`event: ping\nid: ${id++}\ndata: keep alive\n`);
      res.write('\n\n');
    }, 60000)
    // Watch the target directory for changes and trigger reload
    fs.watch(path.join(cwd, root), { recursive: true }, (eventType, filename) => {
      res.write(`event: message\nid: ${id++}\ndata: ${filename} ${eventType}\n`);
      res.write('\n\n');
    })
  }).listen(5000);

  // ----------------------------------
  // Start static file server
  // ----------------------------------

  http.createServer((req, res) => {
    const uri = url.parse(req.url).pathname;
    const resource = path.join(cwd, root, decodeURI(uri));
    // A route was requested
    if(isRouteRequest(uri)) {
      sendIndex(res, uri === '/' ? 200 : 301);
      console.log(`[OK] GET ${uri}`);
      return;
    }
    // A file was requested
    fs.stat(resource, (err, stat) => {
      if (err === null) {
        readFile(res, resource);
        console.log(`[OK] GET ${uri}`);
      }
      else {
        sendNotFound(res);
        console.log(`[ER] GET ${uri}`);
      }
    });
  }).listen(parseInt(port, 10));

  // ----------------------------------
  // Log startup details to terminal
  // ----------------------------------

  console.log(`---------------------------------------------------------`);
  console.log(`[OK] Serving files from ./${root} on http://localhost:${port}`);
  console.log(`[OK] Using ${file} as the fallback for route requests`);
  watch && console.log(`[OK] Watching files and reloading the browser on changes`);
  console.log(`---------------------------------------------------------`);

})();
