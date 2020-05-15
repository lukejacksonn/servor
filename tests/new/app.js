// Simple react app by @lukejacksonn
// ----------------

import { react, html, css } from 'https://unpkg.com/rplus';

const random = () => `${Math.random() * 80}%`;
const style = css`
  position: absolute;
  font-size: 2rem;
  width: 5rem;
  height: 5rem;
  border-radius: 50%;
  border: 5px solid black;
  font-weight: bold;
`;

const app = () => {
  const [score, setScore] = react.useState(0);
  return html`
    <button
      class=${style}
      onClick=${(e) => setScore(score + 1)}
      style=${{ left: random(), top: random() }}
    >
      ${score}
    </button>
  `;
};

react.render(html`<${app} />`, document.body);
