# Servor

> A dependency free dev server for single page applications

A zero dependency static file server with built in live reload and history api fallback defaults for rapid single page app development. The motivation here was to create something similar to the [serve](https://github.com/zeit/serve) or [budo](https://github.com/mattdesl/budo) CLIs that can be ran via `npx` but that installs and starts in a fraction of the time.

## Features

* 🗂 Serve static content like scripts, styles, images from a directory
* 🖥 Reroute all non-file requests like `/` or `/admin` to a single file
* ♻️ Reload the browser when project files get added, removed or modified
* ⏱ Install using `npx` and be running in the browser in a seconds

Especially compliments projects that rely on platform runtime compilation (static/dynamic imports) over a build time transpile/bundle step as reloads are almost instantaneous regardless of project size.

# Example Usage

Add `servor` as a dev dependency using `npm i servor -D` or run once:

```
npx servor <directory> <file> <port> --live
```

* `<directory>` path to serve static files from (defaults to current directory `.`)
* `<file>` the fallback for all non-file requests (defaults to `index.html`)
* `<port>` what port you want to serve the files from (defaults to `8080`)

Example usage with npm scripts in a projects `package.json` file:

```
{
  scripts: {
    start: 'npx servor www index.html 8080 --live'
  }
}
```

## File Request

> A request where last part of the pathname contains a `.` character.

In the event of a file request for example `/assets/image.png`, the server tries to resolve the given path . If the file exists then it is sent as a response with the appropriate mime type and a status code of `200`. If the file does not exist however, then the server responds with the status code `404`.

## Route Request

> A request request that is **not** a file request.

In the event of a route request for example `/user/profile`, the server reroutes and responds with the fallback `<file>` specified. If the app root (just `/`) is requested then the server responds with the status code `200`. If some other route was requested then the server responds with the status code `301`.

## Live Reloading

> A script that gets appended to the fallback file when `--live` is used

In the event of contents changing in the specified `<directory>`, the browser window will hard refresh. This is done by setting up a keep alive connection on port `5000` and writing messages to it in response to `fs.watch` events consumed by the client as an `EventSource` and triggering the `location.reload` function.

## Frontend Routing

> A script that responds to the browser window location changing

This approach presumes that your application handles routing on the frontend with javascript. There are many frontend routers on GitHub.

- [reach-router](https://github.com/reach/router)
- [aviator](https://github.com/swipely/aviator)
- [navigo](https://github.com/krasimir/navigo)
- [react-router](https://github.com/ReactTraining/react-router)
- [ui-router](https://ui-router.github.io/)

But if you prefer to do things yourself a frontend router can be reduced to something a simple as a switch statement that gets evaluated every time the url changes:

```javascript
window.onpopstate = () => {
  switch (window.location.pathname) {
    case '/': loadHomePage(); break;
    case '/profile': loadProfilePage(); break;
  }
}
history.pushState(null, null, window.location.pathname);
window.onpopstate();
```
