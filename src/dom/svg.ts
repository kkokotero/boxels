import {
	isBoxelsElement,
	type BoxelsElement,
	type Child,
} from './attributes/elements';
import { $, Fragment } from '.';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function createSvg<T extends keyof HTMLElementTagNameMap>(
	selector: T,
	props?: Record<string, any>,
	children: Child[] = [],
): BoxelsElement {
	// Crear el nodo SVG con el namespace correcto
	const node = document.createElementNS(SVG_NS, selector);

	// Función para agregar hijos (render hijos recursivo)
	const appendChild = (parent: Element, child: Child) => {
		if (typeof child === 'string' || typeof child === 'number') {
			parent.appendChild(document.createTextNode(String(child)));
		} else if (isBoxelsElement(child)) {
			// Si el hijo es un BoxelsElement, lo montamos en el padre
			child.mount(parent as HTMLElement);
		} else if (child instanceof Node) {
			parent.appendChild(child);
		} else if (Array.isArray(child)) {
			// Soportar arrays de hijos (opcional)
			child.forEach((c) => appendChild(parent, c));
		}
	};

	// Asignar atributos (excepto children)
	for (const [key, value] of Object.entries(props ?? {})) {
		if (key === 'children') {
			Array.isArray(value)
				? value.forEach((child) => appendChild(node, child))
				: appendChild(node, value);
			continue;
		}
		if (value == null) continue;

		// Para atributos especiales como className -> class, o estilos, podrías adaptar aquí
		// Pero para SVG normalmente setAttribute funciona bien
		node.setAttribute(key, String(value));
	}

	// Agregar hijos al nodo SVG
	children.forEach((child) => appendChild(node, child));

	// Método para montar el nodo en el DOM
	const mount = (parent: HTMLElement | DocumentFragment) => {
		if ((node as unknown as BoxelsElement).__mounted) return;
		parent.appendChild(node.cloneNode(true));
		(node as unknown as BoxelsElement).__mounted = true;
	};

	// Método para destruir el nodo y limpiar
	const destroy = () => {
		if ((node as unknown as BoxelsElement).__destroyed) return;
		(node as unknown as BoxelsElement).__destroyed = true;
		(node as unknown as BoxelsElement).__mounted = false;
		while (node.firstChild) node.firstChild.remove();
		node.remove();
	};

	return Object.assign(node, {
		mount,
		destroy,
		__boxels: true,
		__mounted: false,
		__destroyed: false,
	}) as unknown as BoxelsElement;
}
