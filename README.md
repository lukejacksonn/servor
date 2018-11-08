# Servor

> A dependency free server for single page app development

The new and improved version of [http-server-spa](https://npmjs.com/http-server-spa). A zero dependency static file server now with built in file watching, browser reloading and history api fallback defaults to support rapid single page app development. The motivation here was to write a close to the metal package from the ground up, in a single (~120 LOC) file, employing only native node and browser APIs, to do a very specific task. Inspiration was taken from more comprehensive packages like [serve](https://github.com/zeit/serve) and [budo](https://github.com/mattdesl/budo) which both do a similarly great job.



## Features

* 🗂 Serve static content like scripts, styles, images from a directory
* 🖥 Reroute all non-file requests like `/` or `/admin` to a single file
* ♻️ Reload the browser when project files get added, removed or modified
* ⏱ Install using `npx` and be running in the browser in ~1 second
* 📚 Readable source code that encourages learning and contribution

# Usage

Add `servor` as a dev dependency using `npm i servor -D` or run in the terminal:

```
npx servor <directory> <fallback> <port>
```

* `<directory>` path to serve static files from (defaults to current directory `.`)
* `<fallback>` the file served for all non-file requests (defaults to `index.html`)
* `<port>` what port you want to serve the files from (defaults to `8080`)

Example usage with npm scripts in a projects `package.json` file:

```
{
  scripts: {
    start: 'npx servor www index.html 8080'
  }
}
```
