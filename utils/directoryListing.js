const fs = require('fs');
const path = require('path');

module.exports = (uri) => {
  const dir = (x) => fs.statSync(path.join(uri, x)).isDirectory();
  const size = (x) => fs.statSync(path.join(uri, x)).size;

  const link = (x) =>
    dir(x)
      ? `
        <div>
          <span>🗂</span>
          <a href=${`${x}/`}>${x}</a>
          <small>${size(x)}B</small>
        </div>
      `
      : `
        <div>
          <span>📄</span>
          <a href=${x}>${x}</a>
          <small>${size(x)}B</small>
        </div>
      `;

  return `
    <html>
      <head>
        <style>
          html {
            font-size: calc(12px + 1vw);
          }
          body {
            display:flex;
            flex-direction:column;
            min-height:100vh;
            font-family:sans-serif;
            background:#222;
            margin:0;
          }
          main {
            margin:auto;
            width:100%;
            max-width:30rem;
            padding:6rem 2rem;
            box-sizing:border-box;
          }
          div {
            display:flex;
            align-items:center;
            padding:0.5rem;
          }
          a {
            color:#f2f2f2;
            flex: 1 1 100%;
          }
          small {
            color:#b6b6b6;
          }
          span {
            margin-right: 1rem;
          }
        </style>
      </head>
      <body>
        <main>
          ${fs.readdirSync(uri).map(link).join('')}
        </main>
      </body>
    </html>
  `;
};
