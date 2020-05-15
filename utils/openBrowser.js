const childProcess = require('child_process');

module.exports = (url) => {
  let cmd;
  const args = [];

  if (process.platform === 'darwin') {
    try {
      childProcess.execSync(
        `osascript openChrome.applescript "${encodeURI(url)}"`,
        {
          cwd: __dirname,
          stdio: 'ignore',
        }
      );
      return true;
    } catch (err) {}
    cmd = 'open';
  } else if (process.platform === 'win32') {
    cmd = 'cmd.exe';
    args.push('/c', 'start', '""', '/b');
    url = url.replace(/&/g, '^&');
  } else {
    cmd = 'xdg-open';
  }

  args.push(url);
  childProcess.spawn(cmd, args);
};
