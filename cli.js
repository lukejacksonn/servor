#!/usr/bin/env node
(async () => {
  const servor = require('./servor');

  const args = process.argv.slice(2).filter(x => !~x.indexOf('--'));

  // Generate ssl certificates

  if (!!~process.argv.indexOf('--certify')) {
    return require('child_process').execSync(__dirname + '/certify.sh', {
      cwd: __dirname
    });
  }

  // Parse arguments from the command line

  const tunnel = await servor({
    root: args[0],
    fallback: args[1],
    port: args[2],
    browse: !~process.argv.indexOf('--no-browse'),
    reload: !~process.argv.indexOf('--no-reload'),
    silent: !!~process.argv.indexOf('--no-output'),
    secure: !!~process.argv.indexOf('--secure')
  });

  // Start enter if the ngrok key is pressed

  process.stdin.once('data', tunnel);
})();
