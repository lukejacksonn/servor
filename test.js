const fs = require('fs');
const puppeteer = require('puppeteer');
const cp = require('child_process');

const matches = (obj, source) =>
  Object.keys(source).every(
    (key) =>
      obj.hasOwnProperty(key) &&
      JSON.stringify(obj[key]) === JSON.stringify(source[key])
  );

const test = (cmd) => (url) => (expect) => async () => {
  // Make sure nothing is running on port 8080
  cp.execSync(
    "lsof -n -i4TCP:8080 | grep LISTEN | awk '{ print $2 }' | xargs kill"
  );

  // Run the command and wait for the server to start
  const [c, ...a] = cmd.split(' ');
  const servor = cp.spawn(c, a);
  await new Promise((resolve) => servor.stdout.on('data', resolve));

  const browser = await puppeteer.launch({
    ignoreHTTPSErrors: true,
    headless: true,
    slowMo: 0,
  });

  // Load new page and go to url
  const page = await browser.newPage();
  await page.setCacheEnabled(false);

  const res = await page.goto(url);

  // Collect data from response and page
  const status = res.status();
  const headers = res.headers();
  const content = await page.content();

  // Change a file to trigger reload
  let reload = false;
  if (cmd.includes('--reload')) {
    fs.readFile('test/index.html', 'utf-8', (_, data) => {
      fs.writeFileSync('test/index.html', data, 'utf-8');
    });
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

  await test('node cli test')('http://localhost:8080')({
    ...base,
    includes: ['SERVOR_TEST_INDEX'],
  })();

  await test('node cli test')('http://localhost:8080/nested')({
    ...base,
    status: 301,
    includes: ['SERVOR_TEST_INDEX'],
  })();

  await test('node cli test')('http://localhost:8080/assets/exists.png')({
    ...base,
    gzip: false,
  })();

  await test('node cli test')('http://localhost:8080/assets/no-exists.png')({
    ...base,
    status: 404,
    gzip: false,
  })();

  await test('node cli test --reload')('http://localhost:8080')({
    ...base,
    reload: true,
    includes: ['SERVOR_TEST_INDEX'],
  })();

  await test('node cli test --routes')('http://localhost:8080')({
    ...base,
    includes: ['SERVOR_TEST_INDEX'],
  })();

  await test('node cli test --routes')('http://localhost:8080/nested')({
    ...base,
    includes: ['SERVOR_TEST_NESTED_INDEX'],
  })();

  await test('node cli test --module')('http://localhost:8080')({
    ...base,
    includes: ['SERVOR_TEST_MODULE_INDEX'],
  })();

  await test('node cli test --secure')('https://localhost:8080')({
    ...base,
    includes: ['SERVOR_TEST_INDEX'],
  })();

  await test('node cli test --secure --reload --routes --module')(
    'https://localhost:8080'
  )({
    ...base,
    reload: true,
    includes: ['SERVOR_TEST_MODULE_INDEX'],
  })();

  await test('node cli test --secure --reload --routes --module')(
    'https://localhost:8080/nested'
  )({
    ...base,
    reload: true,
    includes: ['SERVOR_TEST_NESTED_MODULE_INDEX'],
  })();
})();
