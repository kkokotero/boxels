class BoxelsFragmentElement extends HTMLElement {
	// Bloquear atributos
	static get observedAttributes() {
		return [];
	}

	attributeChangedCallback() {}

	// Bloquear eventos en el host
	addEventListener() {}

	setAttribute() {}
}

customElements.define('x-fragment', BoxelsFragmentElement);

// Inyectar estilo global para reforzar
const style = document.createElement('style');
style.textContent = `
  x-fragment {
    display: contents !important;
  }
`;
document.head.appendChild(style);
