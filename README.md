# Servør

> A dependency free dev server for modern web application development

A very compact but capable static file server with https, live reloading, gzip and other useful features to support modern web app development on localhost and over a local network. The motivation here was to write a package from the ground up with no dependencies; using only native, node and browser APIs to do some specific tasks with minimal code.

Servør can be invoked via the command line or programmatically using the node API.

**Quickstart Example**

The following command instructs servør to; clone [perflink](https://github.com/lukejacksonn/perflink), start a server at the project root, open the url in a browser, open the source code in an editor and reload the browser when files change.

```s
npx servor gh:lukejacksonn/perflink --browse --editor --reload
```

Most features are disabled by default but you can customize behaviour by passing positional arguments and flags to enable features.

<hr>

<img src="https://user-images.githubusercontent.com/1457604/68399629-979e8480-016e-11ea-89b3-0f852a018042.gif" alt="servor" width="800">

## Features

- 🗂 Serves static content like scripts, styles, images from a given directory
- ♻️ Reloads the browser when project files get added, removed or modified
- 🗜 Uses gzip on common filetypes like html, css, js and json
- 🔐 Supports https and http2 with trusted self signed certificates
- 🖥 Redirects all path requests to a single file for frontend routing
- 📦 Accepts both HTML and JavaScript files as the root file for a directory
- 🔎 Discovers freely available ports to start if the default is in use
- 📄 Renders directory listing for urls ending with a trailing slash
- 🗃 Opens browser tab and code editor to streamline quick start

## CLI Usage

Run as a terminal command without adding it as a dependency using `npx`:

```s
npx servor <root> <fallback> <port>
```

> You can pass a GitHub repo as `<root>` using the syntax `gh:<user>/<repository>`

- `<root>` path to serve static files from (defaults to current directory `.`)
- `<fallback>` the file served for all non-file requests (defaults to `index.html`)
- `<port>` what port you want to serve the files from (defaults to `8080`)

Optional flags passed as non-positional arguments:

- `--browse` causes the browser to open when the server starts
- `--reload` causes the browser to reload when files change
- `--secure` starts the server with https using generated credentials
- `--silent` prevents the server node process from logging to stdout
- `--module` causes the server to wrap the root in script type module tags
- `--static` causes the server to route nested index files if they exist
- `--editor` opens a code editor (currently only vscode) at the project root

Example usage with npm scripts in a `package.json` file after running `npm i servor -D`:

```json
{
  "devDependencies": {
    "servor": "4.0.0"
  },
  "scripts": {
    "start": "servor www index.html 8080 --reload --browse"
  }
}
```

### Generating Credentials

> NOTE: This process depends on the `openssl` command existing (tested on macOS and linux only)

The files `servor.crt` and `servor.key` need to exist for the server to start using https. If the files do not exist when the `--secure` flag is passed, then [`certify.sh`](/certify.sh) is invoked which:

- Creates a local certificate authority used to generate self signed SSL certificates
- Runs the appropriate `openssl` commands to produce:
  - a root certificate (pem) so the system will trust the self signed certificate
  - a public certificate (crt) that the server sends to clients
  - a private key for the certificate (key) to encrypt and decrypt traffic

#### Adding credentials to the trusted store

> NOTE: This process depends on the `sudo` and `security` commands existing (tested on macOS only)

For the browser to trust self signed certificates the root certificate must be added to the system trusted store. This can be done automatically by running `sudo servor --secure` which:

- Adds the root certificate to the system Keychain Access
- Prevents the "⚠️ Your connection is not private" screen
- Makes the 🔒 icon appear in the browsers address bar

The approach was adopted from [@kingkool68/generate-ssl-certs-for-local-development](https://github.com/kingkool68/generate-ssl-certs-for-local-development)

## API Usage

Use servor programmatically with node by requiring it as a module in your script:

```js
const servor = require('servor');
const instance = await servor({
  root: '.',
  fallback: 'index.html',
  module: false,
  static: false,
  reload: false,
  inject: ''
  credentials: null,
  port: 8080,
});
```

The `servor` function accepts a config object with optional props assigned the above default values if none are provided. Calling the `servor` function starts up a new server and returns an object describing its configuration.

```js
const { url, root, protocol, port, ips } = await servor(config);
```

### Inject

The `inject` property accepts a string that gets appended to the servers root document (which is `index.html` by default). This could be used to inject config or extend the development servers behavior and capabilities to suit specific environments.

```js
const config = require('package.json');
servor({ inject: `<script>window.pkg=${config}</script>` });
```

### Credentials

The `credentials` property accepts an object containing the entries `cert` and `key` which must both be valid for the server to start successfully. If valid credentials are provided then the server will start serving over https.

It is possible to generate the appropriate credentials using the `--secure` CLI flag.

## Notes

Thanks to all the contributors to this projects so far. If you find a bug please create an issue or if you have an idea for a new feature then fork the project and create a pull request. Let me know how you are using servør [on twitter](https://twitter.com/lukejacksonn).
