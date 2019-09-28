# Servør

> A dependency free dev server for web app development

The new and enhanced version of [http-server-spa](https://npmjs.com/http-server-spa). A very compact, https capable static file server with useful features and sensible defaults to support modern web app development on localhost and over a network. It can be used via the command line or programatically using the node API.

The motivation here was to write a "close to the metal" package from the ground up; employing only native nodejs and browser APIs to do focussed tasks with minimal code (~200LOC).

<hr>

<img src="https://user-images.githubusercontent.com/1457604/48194482-bf061a00-e37f-11e8-98d3-90d97e639c4e.gif" width="800">

## Features

- 🗂 Serves static content like scripts, styles, images from a directory
- 🖥 Reroutes all path requests like `/` or `/admin` to a single file
- ♻️ Reloads the browser when project files get added, removed or modified
- 🔐 Supports https with self signed and trusted certificates
- 🚇 Generates secure public urls for localhost with ngrok

## CLI Usage

Run as a terminal command without adding it as a dependency using `npx`:

```
npx servor <root> <fallback> <port>
```

- `<root>` path to serve static files from (defaults to current directory `.`)
- `<fallback>` the file served for all non-file requests (defaults to `index.html`)
- `<port>` what port you want to serve the files from (defaults to `8080`)

Optional flags passed as non-positional arguments:

- `--no-browse` prevents the browser from opening when the server starts
- `--no-reload` prevents the browser from reloading when files change
- `--no-output` prevents the node process from logging to stdout

Example usage with npm scripts in a `package.json` file after running `npm i servor -D`:

```json
{
  "devDependencies": {
    "servor": "2.0.0"
  },
  "scripts": {
    "start": "servor www index.html 8080"
  }
}
```

#### Creating a public url

Once the process has started hit the return key; ngrok will be ran via `npx` and the public url will be logged out.

## API Usage

Use servor programatically with node by requiring it as a module in your script:

```js
const servor = require('servor');
const ngrok = servor({
  root: '.',
  fallback: 'index.html',
  port: 8080,
  browse: true,
  reload: true,
  silent: true,
  inject: ''
});

const url = await ngrok(); // https://xxxxxxxx.ngrok.io
```

The `servor` function accepts an config object with optional props assigned the above default values if none are provided. Calling the `servor` function starts up a server and returns a function `ngrok` which can be used to generate a public url for the server.

#### Creating a public url

Call the `ngrok` function; it returns a promise that resolves to the public url.

## Enable SSL (MacOS)

Servers always attempt to start in `https` mode but this is only possible if the appropriate credentials (certificate and key) exist in the module directory. If the credentials do not exist, then the servers will fallback to the `http` protocol.

### Generating Credentials

To generate the `servor.crt` and `servor.key` files and upgrade to `https` run:

```
sudo servor
```

> **WARNING:** Running any npm module with root privilages is not recommened. Please inspect the code first.

If you have servor installed globally or as a dependency then **this only needs to be done once** as credentials are stored locally and reused. If running via `npx` then it will require `sudo` everytime to enable `https`.

When servor is ran with root privilages a bash script is invoked which:

- Creates a local certificate authority used to generate self signed SSL certificates
- Runs the appropriate `openssl` commands to generate:
  - a root certificate (pem) so your system will trust your self signed certificate
  - a public certificate (crt) that your server sends to clients
  - a private key for the certificate (key) to encrypt and decrypt client/server traffic
- Adds the root certificate to keychain so the browser trusts all self signed certificates

It is only the final step that requires `sudo`. This step:

- Prevents the "⚠️ Your connection is not private" warning
- Makes the 🔒 icon appear in the browsers address bar

The approach was adopted from https://github.com/kingkool68/generate-ssl-certs-for-local-development

## Notes

Thanks to all the contributors to this projects so far. If you find a bug please create an issue or if you have an idea for a new feature then fork the project and create a pull request. Let me know how you are using servør [on twitter](https://twitter.com/lukejacksonn).
