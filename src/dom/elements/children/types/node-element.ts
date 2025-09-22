import type { BoxlesChildren } from '@dom/elements/types';
import type { handlerChild } from '../type';

export function handleNormalNode(
	child: Node | Element,
): handlerChild<Node | Element> {
	let node: Node | Element = child;

	if (child instanceof Element) {
		const isSvgNode =
			child.namespaceURI === 'http://www.w3.org/2000/svg' ||
			child.tagName.toLowerCase() === 'svg' ||
			child.parentNode instanceof SVGElement;

		if (isSvgNode) {
			node = document.importNode(child, true) as SVGElement;
		}
	}

	return {
		child: [node],
		mount: () => {},
		destroy: () => {},
	};
}
