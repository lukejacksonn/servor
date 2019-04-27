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
// Parse arguments from the command line
// ----------------------------------

const options = {
	root: '.',
	fallback: 'index.html',
	port: 8080,
	reloadPort: 5000,
	browser: !~process.argv.indexOf('--no-browser')
};

// parse & remove options from argv
const toRemove = [];
for(let i = 2; i <  process.argv.length; i++){
	if(process.argv[i].indexOf('--') === 0){
		// get option name and convert it from kebab-case to camelCase
		const optionName = process.argv[i].substr(2)
			.replace(/-([a-z])/g, function(match, char){
				return char.toUpperCase();
			});
		// get option value
		if(
			typeof options[optionName] !== 'undefined'
			&& typeof process.argv[i + 1] !== 'undefined'
			&& !~process.argv[i + 1].indexOf('--')
		){
			options[optionName] = process.argv[i + 1];
			toRemove.unshift(i);
			i++;
		}
		toRemove.unshift(i);
	}
}

// remove options from argv (removing them before could break the loop above)
for(let i = 0; i < toRemove.length; i++){
	process.argv.splice(toRemove[i], 1);
}

// read commands from argv
if(typeof process.argv[2] !== 'undefined'){
	options.root = process.argv[2];
}
if(typeof process.argv[3] !== 'undefined'){
	options.fallback = process.argv[3];
}
if(typeof process.argv[4] !== 'undefined'){
	options.port = process.argv[4];
}
if(typeof process.argv[5] !== 'undefined'){
	options.reloadPort = process.argv[5];
}


// ----------------------------------
// Template clientside reload script
// ----------------------------------

const reloadScript = `
  <script>
    const source = new EventSource('http://localhost:${options.reloadPort}');
    source.onmessage = () => location.reload(true);
  </script>
`;

// ----------------------------------
// Server utility functions
// ----------------------------------

const sendError = (res, resource, status) => {
  res.writeHead(status);
  res.end();
  console.log(" \x1b[41m", status, "\x1b[0m", `${resource}`);
};

const sendFile = (res, resource, status, file, ext) => {
  res.writeHead(status, {
    "Content-Type": mime[ext] || "application/octet-stream",
    "Access-Control-Allow-Origin": "*"
  });
  res.write(file, "binary");
  res.end();
  console.log(" \x1b[42m", status, "\x1b[0m", `${resource}`);
};

const sendMessage = (res, channel, data) => {
  res.write(`event: ${channel}\nid: 0\ndata: ${data}\n`);
  res.write("\n\n");
};

const isRouteRequest = uri =>
  uri
    .split("/")
    .pop()
    .indexOf(".") === -1;

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
    // Send an initial ack event to stop request pending
    sendMessage(res, "connected", "awaiting change");
    // Send a ping event every minute to prevent console errors
    setInterval(sendMessage, 60000, res, "ping", "still waiting");
    // Watch the target directory for changes and trigger reload
    fs.watch(path.join(cwd, options.root), { recursive: true }, () =>
      sendMessage(res, "message", "reloading page")
    );
  })
  .listen(parseInt(options.reloadPort, 10));

// ----------------------------------
// Start static file server
// ----------------------------------

http
  .createServer((req, res) => {
    const pathname = url.parse(req.url).pathname;
    const isRoute = isRouteRequest(pathname);
    const status = isRoute && pathname !== "/" ? 301 : 200;
    const resource = isRoute ? `/${options.fallback}` : decodeURI(pathname);
    const uri = path.join(cwd, options.root, resource);
    const ext = uri.replace(/^.*[.\/\\]/, "").toLowerCase();
    isRoute && console.log("\n \x1b[44m", "RELOADING", "\x1b[0m\n");
    // Check if files exists at the location
    fs.stat(uri, (err) => {
      if (err) return sendError(res, resource, 404);
      // Respond with the contents of the file
      fs.readFile(uri, "binary", (err, file) => {
        if (err) return sendError(res, resource, 500);
        if (isRoute) file += reloadScript;
        sendFile(res, resource, status, file, ext);
      });
    });
  })
  .listen(parseInt(options.port, 10));

// ----------------------------------
// Log startup details to terminal
// ----------------------------------

console.log(`\n 🗂  Serving files from ./${options.root} on http://localhost:${options.port}`);
console.log(` 🖥  Using ${options.fallback} as the fallback for route requests`);
console.log(` ♻️  Reloading the browser when files under ./${options.root} change`);

// ----------------------------------
// Open the page in the default browser
// ----------------------------------

if(options.browser){
	const page = `http://localhost:${options.port}`;
	const open =
		process.platform === "darwin"
			? "open"
			: process.platform === "win32"
			? "start"
			: "xdg-open";

	require("child_process").exec(open + " " + page);
}
