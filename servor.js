#!/usr/bin/env node

const fs = require("fs");
const url = require("url");
const path = require("path");
const http = require("http");

// ----------------------------------
// Generate map of all known mimetypes
// ----------------------------------

const mime = Object.entries(require("./types.json")).reduce(
  (all, [type, exts]) =>
    Object.assign(all, ...exts.map(ext => ({ [ext]: type }))),
  {}
);

// ----------------------------------
// Template clientside reload script
// ----------------------------------

const reloadScript = `
  <script>
    const source = new EventSource('http://localhost:5000');
    source.onmessage = e => location.reload(true);
  </script>
`;

// ----------------------------------
// Parse arguments from the command line
// ----------------------------------

const root = process.argv[2] || ".";
const fallback = process.argv[3] || "index.html";
const port = process.argv[4] || 8080;
const cwd = process.cwd();

// ----------------------------------
// Server utility functions
// ----------------------------------

const sendError = res => {
  res.writeHead(500);
  res.write("500 Server Error");
  res.end();
};

const sendNotFound = (res, resource) => {
  res.writeHead(404);
  res.write("404 Not Found");
  res.end();
  console.log(" \x1b[41m", "404", "\x1b[0m", `GET ${resource}`);
};

const sendFile = (res, resource, status, file, ext) => {
  res.writeHead(status, {
    "Content-Type": mime[ext] || "application/octet-stream"
  });
  res.write(file, "binary");
  res.end();
  resource === `/${fallback}` &&
    console.log("\n \x1b[44m", "RELOADED", "\x1b[0m\n");
  console.log(" \x1b[42m", "200", "\x1b[0m", `GET ${resource}`);
};

const isRouteRequest = uri => {
  return uri
    .split("/")
    .pop()
    .indexOf(".") === -1
    ? true
    : false;
};

// ----------------------------------
// Start file watching server
// ----------------------------------

http
  .createServer((request, res) => {
    // Open the event stream for live reload
    res.writeHead(200, {
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*"
    });
    let id = 0;
    // Send an initial ack event to stop request pending
    res.write(`event: connected\nid: ${id++}\ndata: awaiting message\n`);
    res.write("\n\n");
    // Send a ping event every minute to prevent console errors
    setInterval(() => {
      res.write(`event: ping\nid: ${id++}\ndata: keep alive\n`);
      res.write("\n\n");
    }, 60000);
    // Watch the target directory for changes and trigger reload
    fs.watch(
      path.join(cwd, root),
      { recursive: true },
      (eventType, filename) => {
        // console.log("\n\x1b[44m", 'RELOADING', "\x1b[0m", `${filename} ${eventType}d\n`);
        res.write(
          `event: message\nid: ${id++}\ndata: ${filename} ${eventType}\n`
        );
        res.write("\n\n");
      }
    );
  })
  .listen(5000);

// ----------------------------------
// Start static file server
// ----------------------------------

http
  .createServer((req, res) => {
    const pathname = url.parse(req.url).pathname;
    const isRoute = isRouteRequest(pathname);
    const status = isRoute && pathname !== "/" ? 301 : 200;
    const resource = isRoute ? `/${fallback}` : decodeURI(pathname);
    const uri = path.join(cwd, root, resource);
    const ext = uri.replace(/^.*[\.\/\\]/, "").toLowerCase();
    // Check if files exists at the location
    fs.stat(uri, (err, stat) => {
      if (err) return sendNotFound(res, resource);
      // Respond with the contents of the file
      fs.readFile(uri, "binary", (err, file) => {
        if (err) return sendError(res);
        if (isRoute) file += reloadScript;
        sendFile(res, resource, status, file, ext);
      });
    });
  })
  .listen(parseInt(port, 10));

// ----------------------------------
// Log startup details to terminal
// ----------------------------------

console.log(`\n 🗂  Serving files from ./${root} on http://localhost:${port}`);
console.log(` 🖥  Using ${fallback} as the fallback for route requests`);
console.log(` ♻️  Reloading the browser when files under ./${root} change`);

// ----------------------------------
// Open the page in the default browser
// ----------------------------------

const page = `http://localhost:${port}`;
const open =
  process.platform == "darwin"
    ? "open"
    : process.platform == "win32"
      ? "start"
      : "xdg-open";

require("child_process").exec(open + " " + page);
