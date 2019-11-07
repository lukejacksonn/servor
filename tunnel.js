const fs = require('fs');
const proc = require('child_process');

const ngrok = (protocol, port) => `
authtoken: 1RJ1wVqDcoolLeIWrzTSRDJt4Wb_73v2muP83AeeNA14wSMY
tunnels:
  servor:
    proto: http
    addr: ${protocol}://localhost:${port}
    bind_tls: ${protocol === 'https'}
`;

module.exports = (protocol, port) =>
  new Promise(resolve => {
    const config = __dirname + '/ngrok.yml';
    fs.writeFileSync(config, ngrok(protocol, port));
    proc.spawn('npx', ['-q', 'ngrok', 'start', '-config', config, 'servor']);
    setInterval(function() {
      try {
        const data = proc.execSync('curl -s localhost:4040/api/tunnels');
        const url = (tunnel = JSON.parse(String(data)).tunnels[0].public_url);
        clearInterval(this);
        resolve(url);
      } catch (e) {}
    }, 1000);
  });
