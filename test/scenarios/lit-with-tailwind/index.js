import { html, css, LitElement } from 'lit';

export class TestElement extends LitElement {
  static get styles() {
    return css`
      @tailwind base;
      @tailwind components;
      @tailwind utilities;
    `;
  }

  constructor() {
    super();
  }

  render() {
    return html`
      <p class="py-2 px-4 bg-blue-500 text-white font-semibold">Hello, world!</p>
    `;
  }
}

customElements.define('test-element', TestElement);
