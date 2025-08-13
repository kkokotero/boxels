import { isSignal, type ReactiveSignal } from '@core/reactive';
import { handleAttributes } from './attributes';
import {
	type BoxelsElement,
	type BoxelsElementNode,
	type Child,
	isBoxelsElement,
	normalizeChildren,
} from './attributes/elements';
import { createSvg } from './svg';

export const Fragment: unique symbol = Symbol('Boxles-Fragment');

const svgTags = new Set([
	'svg',
	'circle',
	'ellipse',
	'line',
	'path',
	'polygon',
	'polyline',
	'rect',
	'text',
	'g',
	'defs',
	'linearGradient',
	'stop',
	'use',
	'symbol',
]);

// Tipos para detectar componentes
export type FunctionalComponent = (props?: any) => any;
export type ClassComponent = { new (props?: any): { render(): BoxelsElement } };

export type BoxelsElementSelector<T extends keyof HTMLElementTagNameMap> =
	| T
	| HTMLElementTagNameMap[T]
	| DocumentFragment
	| typeof Fragment
	| 'svg'
	| 'cirlce'
	| 'path'
	| FunctionalComponent
	| ReactiveSignal<any>
	| ClassComponent;

// Función para detectar si es un componente de clase
export function isClassComponent(fn: unknown): fn is ClassComponent {
	return (
		typeof fn === 'function' &&
		typeof (fn as any).prototype === 'object' &&
		typeof (fn as any).prototype.render === 'function'
	);
}

export function $<T extends keyof HTMLElementTagNameMap>(
	selector: BoxelsElementSelector<T>,
	props?: BoxelsElementAttributes<T>,
	...children: Child[]
): BoxelsElement {
	// Inyecta children si no están en props
	if (props) {
		props.children =
			props.children ??
			(children.length === 1
				? children[0]
				: children[0] !== undefined
					? children
					: []);
	}

	let node: Node;

	if (selector === Fragment) {
		node = document.createDocumentFragment();
	} else if (isClassComponent(selector)) {
		const instance = new selector(props);
		return instance.render();
	} else if (isSignal(selector)) {
		const nodes = normalizeChildren(selector as Child);
		return $(Fragment, {}, nodes);
	} else if (typeof selector === 'function') {
		return selector(props);
	} else if (typeof selector === 'string' && svgTags.has(selector)) {
		return createSvg(selector as any, props as BoxelsElementAttributes<'div'>, children);
	} else if (typeof selector === 'string') {
		node = document.createElement(selector);
	} else {
		node = selector;
	}

	// Si es un fragmento manual (ej. selector instanceof DocumentFragment)
	if (selector === Fragment || selector instanceof DocumentFragment) {
		const result = normalizeChildren(props?.children);

		result.nodes.forEach((n) => append(node as HTMLElement, n));

		const mount = (parent: HTMLElement | DocumentFragment) => {
			if ((node as BoxelsElement).__mounted) return;

			try {
				result.onMount();
				parent.appendChild(node);
			} finally {
				(node as BoxelsElement).__mounted = true;
			}
		};

		const destroy = () => {
			if ((node as BoxelsElement).__destroyed) return;
			result.cleanup();
			(node as BoxelsElement).__mounted = false;
			(node as BoxelsElement).__destroyed = true;
			while (node.firstChild) {
				node.firstChild.remove();
			}
		};

		return Object.assign(node, {
			mount,
			destroy,
			mountEffect: () => result.onMount(),
			isFragment: true,
			__boxels: true,
			__mounted: false,
			__destroyed: false,
		}) as BoxelsElement;
	}

	// Si es un elemento HTML estándar
	const result = handleAttributes(node as HTMLElement, props ?? {});

	const mount = (parent: HTMLElement | DocumentFragment) => {
		// Prevención de recursión infinita
		if ((node as BoxelsElement).__mounted) return;

		try {
			result['$lifecycle:mount']?.(node as BoxelsElementNode<T>);
			if (parent instanceof Comment) {
				parent.parentNode?.insertBefore(
					node instanceof Node ? node : document.createTextNode(String(node)),
					parent,
				);
				return;
			}
			parent.appendChild(
				node instanceof Node ? node : document.createTextNode(String(node)),
			);
		} finally {
			(node as BoxelsElement).__mounted = true;
		}
	};

	const destroy = () => {
		if ((node as BoxelsElement).__destroyed) return;
		result['$lifecycle:destroy']?.(node as BoxelsElementNode<T>);
		(node as BoxelsElement).__mounted = false;
		(node as BoxelsElement).__destroyed = true;
		(node as ChildNode).remove();
	};

	return Object.assign(node, {
		mount,
		destroy,
		mountEffect: () =>
			result['$lifecycle:mount']?.(node as BoxelsElementNode<T>),
		isFragment: false,
		__boxels: true,
		__mounted: false,
		__destroyed: false,
	}) as BoxelsElement;
}

export function append(
	parent: HTMLElement | DocumentFragment | Comment | BoxelsElement | SVGElement,
	child: any,
) {
	// Caso: el padre es un comentario → insertar antes del comentario
	if (parent instanceof Comment) {
		parent.parentNode?.insertBefore(
			child instanceof Node ? child : document.createTextNode(String(child)),
			parent,
		);
		return;
	}

	// Caso: SVG → mantener namespace
	if (parent instanceof SVGElement) {
		if (child instanceof Node) {
			parent.appendChild(child);
		} else {
			parent.appendChild(document.createTextNode(String(child)));
		}
		return;
	}

	// Si es un BoxelsElement
	if (isBoxelsElement(child)) {
		if (!child.__mounted && !child.__destroyed) child.mount(parent);
		return;
	}

	// Si es un signal → convertir a fragment para manejarlo de forma reactiva
	if (isSignal(child)) {
		append(parent, $(Fragment, {}, child as ReactiveSignal<any>));
		return;
	}

	// Caso especial: ambos son Fragment → fusionar nodos
	if (parent instanceof DocumentFragment && child instanceof DocumentFragment) {
		parent.append(...child.childNodes);
		return;
	}

	// Caso: padre es Fragment y el hijo es un Node normal
	if (
		parent instanceof DocumentFragment &&
		child instanceof DocumentFragment === false
	) {
		parent.appendChild(
			child instanceof Node ? child : document.createTextNode(String(child)),
		);
		return;
	}

	// Promesa → render diferido
	if (child instanceof Promise) {
		const comment = document.createComment('');
		parent.appendChild(comment);

		(async () => {
			const result = await child;
			append(comment, result);
			comment.remove();
		})();
		return;
	}

	// Fallback normal
	parent.appendChild(
		child instanceof Node ? child : document.createTextNode(String(child)),
	);
}

export const setAttribute = <T extends keyof HTMLElementTagNameMap>(
	element: HTMLElementTagNameMap[T] | HTMLElement,
	props: BoxelsElementAttributes<T>,
) => {
	const result = handleAttributes(element, props);
	result['$lifecycle:mount']?.(element as BoxelsElementNode<T>);
	return () => result['$lifecycle:destroy']?.(element as BoxelsElementNode<T>);
};

export const removeAttribute = <T extends keyof HTMLElementTagNameMap>(
	element: HTMLElementTagNameMap[T] | HTMLElement,
	props: (keyof BoxelsElementAttributes<T>)[],
) => {
	for (const attr of props) {
		element.removeAttribute(String(attr));
	}
};

export * from './attributes/elements/index';
export * from './attributes/handlers/index';
export { append as appendChild };
