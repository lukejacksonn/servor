const fs = require('fs');
const puppeteer = require('puppeteer');
const cp = require('child_process');

const matches = (obj, source) =>
  Object.keys(source).every(
    (key) =>
      obj.hasOwnProperty(key) &&
      JSON.stringify(obj[key]) === JSON.stringify(source[key])
  );

const modifyFile = (x) =>
  fs.readFile(x, 'utf-8', (_, data) => {
    fs.writeFileSync(x, data, 'utf-8');
  });

const test = (cmd) => (url) => async (expect) => {
  // Make sure nothing is running on port 8080
  cp.execSync(
    "lsof -n -i4TCP:8080 | grep LISTEN | awk '{ print $2 }' | xargs kill"
  );

  // Run the command and wait for the server to start
  const [c, ...a] = ('node ../cli example ' + cmd).trim().split(' ');
  const servor = cp.spawn(c, a);
  const { origin } = await new Promise((resolve) =>
    servor.stdout.once('data', (out) => {
      resolve(new URL(out.toString().match(/Local:\t(.*)\n/)[1]));
    })
  );

  const browser = await puppeteer.launch({
    ignoreHTTPSErrors: true,
    headless: true,
    slowMo: 0,
  });

  // Load new page and go to url
  const page = await browser.newPage();
  await page.setCacheEnabled(false);

  const res = await page.goto(`${origin}${url}`);

  // Collect data from response and page
  const status = res.status();
  const headers = res.headers();
  const content = await page.content();

  // Change a file to trigger reload
  let reload = false;
  if (cmd.includes('--reload')) {
    modifyFile('example/index.html');
    reload = await page.waitForNavigation({ timeout: 1000 }).catch(() => false);
    modifyFile('example/assets/index.js');
    reload = await page.waitForNavigation({ timeout: 1000 }).catch(() => false);
  }

  const result = {
    status,
    reload: !!reload,
    gzip: headers['content-encoding'] === 'gzip',
    cors: headers['access-control-allow-origin'] === '*',
    includes: [
      'SERVOR_TEST_INDEX',
      'SERVOR_TEST_NESTED_INDEX',
      'SERVOR_TEST_MODULE_INDEX',
      'SERVOR_TEST_NESTED_MODULE_INDEX',
    ].filter((x) => content.includes(x)),
  };

  const passed = matches(result, expect);
  console.log(
    passed
      ? { ['PASSED']: { cmd, url, out: JSON.stringify(result) } }
      : { ['FAILED']: { cmd, url, result, expect } }
  );

  servor.kill();
  await browser.close();
};

(async () => {
  const base = { status: 200, gzip: true, cors: true, reload: false };

  await test('')('/')({
    ...base,
    includes: ['SERVOR_TEST_INDEX'],
  });

  await test('')('/index.html')({
    ...base,
    includes: ['SERVOR_TEST_INDEX'],
  });

  await test('')('/assets/file with space.html')({
    ...base,
  });

  await test('')('/assets/exists.png')({
    ...base,
    gzip: false,
  });

  await test('')('/assets/no-exists.png')({
    ...base,
    status: 404,
    gzip: false,
  });

  await test('')('/nested')({
    ...base,
    status: 301,
    includes: ['SERVOR_TEST_INDEX'],
  });

  await test('')('/nested/assets/exists.png')({
    ...base,
    gzip: false,
  });

  await test('')('/nested/assets/no-xists.png')({
    ...base,
    status: 404,
    gzip: false,
  });

  await test('--reload')('/')({
    ...base,
    reload: true,
    includes: ['SERVOR_TEST_INDEX'],
  });

  await test('--static')('/')({
    ...base,
    includes: ['SERVOR_TEST_INDEX'],
  });

  await test('--static')('/nested')({
    ...base,
    includes: ['SERVOR_TEST_NESTED_INDEX'],
  });

  await test('--static')('/broken-nested')({
    ...base,
    status: 404,
    gzip: false,
  });

  await test('--module')('/')({
    ...base,
    includes: ['SERVOR_TEST_MODULE_INDEX'],
  });

  await test('--secure')('/')({
    ...base,
    includes: ['SERVOR_TEST_INDEX'],
  });

  await test('--secure --reload --static --module')('/')({
    ...base,
    reload: true,
    includes: ['SERVOR_TEST_MODULE_INDEX'],
  });

  await test('--secure --reload --static --module')('/nested')({
    ...base,
    reload: true,
    includes: ['SERVOR_TEST_NESTED_MODULE_INDEX'],
  });
})();
