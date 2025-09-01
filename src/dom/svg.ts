import { handleAttributes } from './attributes';
import type { BoxelsElement, BoxelsElementNode } from './attributes/elements';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function createSvg<T extends keyof SVGElementTagNameMap>(
	selector: T,
	props?: BoxelsElementAttributes<'div'>,
): BoxelsElement {
	// Crear el elemento con namespace correcto
	const node = document.createElementNS(SVG_NS, selector) as SVGElement;

	const lifecycle = handleAttributes(node, props || {});

	// Método para montar en cualquier padre (HTML, SVG, Fragment, Comment)
	const mount = (
		parent: HTMLElement | SVGElement | DocumentFragment | Comment,
	) => {
		if ((node as unknown as BoxelsElement).__mounted) return;
		(node as unknown as BoxelsElement).__mounted = true;

		lifecycle['$lifecycle:mount']?.(
			node as unknown as BoxelsElementNode<'div'>,
		);

		if (parent instanceof Comment) {
			parent.parentNode?.insertBefore(node, parent);
		} else {
			parent.appendChild(node);
		}
	};

	// Método para destruir
	const destroy = () => {
		if ((node as unknown as BoxelsElement).__destroyed) return;
		(node as unknown as BoxelsElement).__destroyed = true;
		(node as unknown as BoxelsElement).__mounted = false;
		lifecycle['$lifecycle:destroy']?.(
			node as unknown as BoxelsElementNode<'div'>,
		);
		while (node.firstChild) node.firstChild.remove();
		node.remove();
	};

	return Object.assign(node, {
		mount,
		destroy,
		mountEffect: () => {},
		__boxels: true,
		__mounted: false,
		__destroyed: false,
	}) as unknown as BoxelsElement;
}
