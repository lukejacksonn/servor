#!/usr/bin/env node
const fs = require('fs');
const servor = require('./servor.js');
const tunnel = require('./tunnel.js');

const readCredentials = () => ({
  cert: fs.readFileSync(__dirname + '/servor.crt'),
  key: fs.readFileSync(__dirname + '/servor.key')
});

const certify = () =>
  require('child_process').execSync(__dirname + '/certify.sh', {
    cwd: __dirname
  });

const open =
  process.platform == 'darwin'
    ? 'open'
    : process.platform == 'win32'
    ? 'start'
    : 'xdg-open';

(async () => {
  const args = process.argv.slice(2).filter(x => !~x.indexOf('--'));
  const admin = process.getuid && process.getuid() === 0;
  let credentials;

  // Generate ssl certificates

  if (~process.argv.indexOf('--secure')) {
    admin && certify();
    process.setuid(501);
    try {
      credentials = readCredentials();
    } catch (e) {
      certify();
      try {
        credentials = readCredentials();
      } catch (e) {
        console.log(
          ' ⚠️ There was a problem generating ssl credentials. Try removing `--secure`'
        );
        process.exit();
      }
    }
  }

  // Parse arguments from the command line

  const { root, protocol, port, ips, url } = await servor({
    root: args[0],
    fallback: args[1],
    port: args[2],
    reload: ~process.argv.indexOf('--reload'),
    credentials
  });

  // Output server details to the console

  !~process.argv.indexOf('--silent') &&
    console.log(`
  🗂  Serving:\t${root}\n
  🏡 Local:\t${url}
  ${ips.map(ip => `📡 Network:\t${protocol}://${ip}:${port}`).join('\n  ')}`);

  // Browser the server index

  ~process.argv.indexOf('--browse') &&
    require('child_process').execSync(`${open} ${url}`);

  // Start ngrok if the enter key is pressed

  process.stdin.once('data', () =>
    ~process.argv.indexOf('--secure')
      ? console.log('  🚧 Public:\tCannot tunnel with the --secure flag')
      : tunnel(protocol, port).then(url =>
          console.log(`  🌍 Public:\t\x1b[4m${url}\x1b[0m`)
        )
  );
})();
