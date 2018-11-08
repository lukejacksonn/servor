# Servor

> A dependency free server for single page app development

A zero dependency static file server with built in live reload and history api fallback defaults for rapid single page app development. The motivation here was to learn how packages like [serve](https://github.com/zeit/serve) or [budo](https://github.com/mattdesl/budo) worked and create something similar that can be ran on the CLI via `npx` but that clean installs in a fraction of the time due to its no frills feature set and smaller overall size.

## Features

* 🗂 Serve static content like scripts, styles, images from a directory
* 🖥 Reroute all non-file requests like `/` or `/admin` to a single file
* ♻️ Reload the browser when project files get added, removed or modified
* ⏱ Install using `npx` and be running in the browser in seconds

# Usage

Add `servor` as a dev dependency using `npm i servor -D` or run from the terminal:

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
