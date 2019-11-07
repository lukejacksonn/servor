# Servør

> A dependency free dev server for modern web application development

The new and enhanced version of [http-server-spa](https://npmjs.com/http-server-spa). A very compact but capable static file server with https, live reloading and other useful features to support web app development on localhost and over a network.

Servør can be invoked via the command line or programmatically using the node API.

The motivation here was to write a "close to the metal" package from the ground up using no dependencies; only native nodejs and browser APIs to do (what should be) a straightforward task with minimal code.

<hr>

<img src="https://user-images.githubusercontent.com/1457604/68399629-979e8480-016e-11ea-89b3-0f852a018042.gif" alt="servor" width="800">

## Features

- 🗂 Serves static content like scripts, styles, images from a given directory
- 🖥 Redirects all path requests to a single file for frontend routing
- ♻️ Reloads the browser when project files get added, removed or modified
- 🔐 Supports https with self signed and trusted certificates
- 🚇 Generates secure public urls for localhost using ngrok

## CLI Usage

Run as a terminal command without adding it as a dependency using `npx`:

```s
npx servor <root> <fallback> <port>
```

- `<root>` path to serve static files from (defaults to current directory `.`)
- `<fallback>` the file served for all non-file requests (defaults to `index.html`)
- `<port>` what port you want to serve the files from (defaults to any free port)

Optional flags passed as non-positional arguments:

- `--browse` causes the browser to open when the server starts
- `--reload` causes the browser to reload when files change
- `--secure` causes the server to generate credentials and use https
- `--silent` prevents the node process from logging to stdout

Example usage with npm scripts in a `package.json` file after running `npm i servor -D`:

```json
{
  "devDependencies": {
    "servor": "3.0.0"
  },
  "scripts": {
    "start": "servor www index.html 8080 --reload --browse"
  }
}
```

### Creating a public url

Once the process has started, hit the return key in the terminal window; this will cause [`tunnel.js`](/tunnel.js) to be ran which invokes ngrok via `npx`. A public url will be logged out as soon as a connection has been established.

### Generating Credentials

> NOTE: This process depends on the `openssl` command existing (tested on macOS only)

When servor is invoked with the `--secure` flag, it looks for two files `servor.crt` and `servor.key`. If the files are missing then [`certify.sh`](/certify.sh) is ran which:

- Creates a local certificate authority used to generate self signed SSL certificates
- Runs the appropriate `openssl` commands to generate:
  - a root certificate (pem) so the system will trust the self signed certificate
  - a public certificate (crt) that the server sends to clients
  - a private key for the certificate (key) to encrypt and decrypt traffic

If these steps are all successful then the server will start using https. The credentials are valid but are still not trusted, which means that when the server is opened in the browser for the first time there is likely to be a warning displayed which needs to be acknowledged before continuing. Once the warning has been dismissed once it should not return unless the credentials are regenerated.

#### Adding credentials to the trusted store

> NOTE: This process depends on the `sudo` and `security` commands existing (tested on macOS only)

For the browser to trust self signed certificates the root certificate must be added to the system trusted store. This can be done automatically by running `sudo servor --secure` which:

- Adds the root certificate to the system Keychain Access
- Prevents the "⚠️ Your connection is not private" warning
- Makes the 🔒 icon appear in the browsers address bar

The approach was adopted from [@kingkool68/generate-ssl-certs-for-local-development](https://github.com/kingkool68/generate-ssl-certs-for-local-development)

## API Usage

Use servor programmatically with node by requiring it as a module in your script:

```js
const servor = require('servor');
const instance = servor({
  root: '.',
  fallback: 'index.html',
  port: 8080,
  reload: false,
  inject: ''
  credentials: {},
});
```

The `servor` function accepts a config object with optional props assigned the above default values if none are provided. Calling the `servor` function starts up a new server and returns an object describing its configuration.

```js
const { url, root, protocol, port, ips }; = servor(config);
```

### Inject

The `inject` property accepts a string that gets prepended to the servers root document (which is `index.html` by default). This could be used to inject config or extend the development servers behavior and capabilities to suit specific environments.

```js
const config = require('package.json');
servor({ inject: `<script>window.pkg=${config}</script>` });
```

### Credentials

The `credentials` property accepts an object containing the entries `cert` and `key` which must both be valid for the server to start successfully. If valid credentials are provided then the server will start serving over https.

It is possible to generate the appropriate credentials using the `--secure` CLI flag.

## Notes

Thanks to all the contributors to this projects so far. If you find a bug please create an issue or if you have an idea for a new feature then fork the project and create a pull request. Let me know how you are using servør [on twitter](https://twitter.com/lukejacksonn).
