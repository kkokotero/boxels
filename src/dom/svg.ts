import { handleAttributes } from './attributes';
import type { BoxelsElement, Child } from './attributes/elements';
import { appendChild } from './utils';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function createSvg<T extends keyof SVGElementTagNameMap>(
	selector: T,
	props?: BoxelsElementAttributes<'div'>,
	children: Child[] = [],
): BoxelsElement {
	// Crear el elemento con namespace correcto
	const node = document.createElementNS(SVG_NS, selector) as SVGElement;

	handleAttributes(node, props || {});

	// Método para montar en cualquier padre (HTML, SVG, Fragment, Comment)
	const mount = (
		parent: HTMLElement | SVGElement | DocumentFragment | Comment,
	) => {
		if ((node as unknown as BoxelsElement).__mounted) return;

		if (parent instanceof Comment) {
			parent.parentNode?.insertBefore(node, parent);
		} else {
			parent.appendChild(node);
		}

		(node as unknown as BoxelsElement).__mounted = true;
	};

	// Método para destruir
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
