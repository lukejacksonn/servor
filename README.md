# http-server-spa

A small but fast static file server running on node, with built in history-api-fallback. Useful for serving up single page applications with frontend routing. You can start the server using the command line..

```
npm install http-server-spa -g
```
```
http-server-spa <directory> <fallback> <port>
```

Requests to the server are categorized as one of two types:

## File Request

- A `file` request defined by any request url where last part of the path (after being split by the `/` delimiter) contains a `.` character.

In the event of a `file` request the server tries to resolve the given path for example `/assets/image.png`. If the file exists then it is sent as a response with the appropriate mime type and a status code of `200`. If the file does not exist however, then the server responds with the status code `404`.

## Route Request

- A `route` request defined by any request that is not a file request.

In the event of any `route` request, for example `/user/profile`, the server immediately responds with the specified `fallback` file. If the app root (just `/`) is requested then the server responds with the status code `200`. If some other route was requested then the server responds with the status code `301`.

## Frontend Routing

This approach presumes that your application handles routing on the frontend with javascript. There are many frontend routers out there..

- [aviator](https://github.com/swipely/aviator)
- [navigo](https://github.com/krasimir/navigo)
- [react-router](https://github.com/ReactTraining/react-router)
- [ui-router](https://ui-router.github.io/)

..to name a few, but if you prefer to do things yourself a frontend router can be reduced to something a simple as a switch statement that gets evaluated every time the url changes:

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
