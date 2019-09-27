#!/usr/bin/env node

const servor = require('./servor');
const args = process.argv.slice(2).filter(x => !~x.indexOf('--'));

// Parse arguments from the command line

const tunnel = servor({
  root: args[0],
  fallback: args[1],
  port: args[2],
  browser: !~process.argv.indexOf('--no-browser'),
  reload: !~process.argv.indexOf('--no-reload'),
  silent: !!~process.argv.indexOf('--no-output')
});

// Start enter if the ngrok key is pressed

process.stdin.once('data', tunnel);
