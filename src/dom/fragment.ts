class BoxelsFragmentElement extends HTMLElement {
	#childNodes: ChildNode[] = [];

	connectedCallback() {
		const parent = this.parentNode;
		if (!parent) return;

		// Guardar hijos iniciales si es la primera vez
		if (this.#childNodes.length === 0) {
			this.#childNodes = Array.from(this.childNodes);
		}

		// Mover hijos al padre, justo antes del host
		for (const child of this.#childNodes) {
			parent.insertBefore(child, this);
		}

		// Eliminar el host: el <x-fragment> no se verá en el DOM
		this.remove();
	}

	disconnectedCallback() {
		// Mantiene referencias, pero no toca el DOM
	}

	get fragmentChildren() {
		return this.#childNodes;
	}
}

if (!customElements.get('x-fragment')) {
	customElements.define('x-fragment', BoxelsFragmentElement);
}
