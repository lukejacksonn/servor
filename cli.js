#!/usr/bin/env node

const servor = require('./servor');

// ----------------------------------
// Parse arguments from the command line
// ----------------------------------

const root = process.argv[2] || ".";
const fallback = process.argv[3] || "index.html";
const port = process.argv[4] || 8080;
const reloadPort = process.argv[5] || 5000;
const cwd = process.cwd();

servor(root, fallback, port, reloadPort, cwd);