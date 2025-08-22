import { isSignal, type ReactiveSignal } from '@core/reactive';
import { handleAttributes } from './attributes';
import {
	type BoxelsElement,
	type BoxelsElementNode,
	type Child,
	normalizeChildren,
} from './attributes/elements';
import { createSvg } from './svg';
import { appendChild } from './utils';

export const Fragment: unique symbol = Symbol('Boxles-Fragment');
export const Comment: unique symbol = Symbol('Boxles-Fragment');

const svgTags = new Set([
	// Contenedor raíz
	'svg',

	// Formas básicas
	'circle',
	'ellipse',
	'line',
	'path',
	'polygon',
	'polyline',
	'rect',

	// Contenedores / estructurales
	'g',
	'symbol',
	'defs',
	'use',

	// Texto
	'text',
	'tspan',
	'textPath',

	// Gradientes y patrones
	'linearGradient',
	'radialGradient',
	'stop',
	'pattern',
	'clipPath',
	'mask',

	// Filtros
	'filter',
	'feBlend',
	'feColorMatrix',
	'feComponentTransfer',
	'feComposite',
	'feConvolveMatrix',
	'feDiffuseLighting',
	'feDisplacementMap',
	'feDropShadow',
	'feFlood',
	'feGaussianBlur',
	'feImage',
	'feMerge',
	'feMorphology',
	'feOffset',
	'feSpecularLighting',
	'feTile',
	'feTurbulence',
	'title',
]);

// Tipos para detectar componentes
export type FunctionalComponent = (props?: any) => any;
export type ClassComponent = { new (props?: any): { render(): BoxelsElement } };

export type BoxelsElementSelector<T extends keyof HTMLElementTagNameMap> =
	| T
	| HTMLElementTagNameMap[T]
	| DocumentFragment
	| typeof Fragment
	// SVG
	| 'svg'
	| 'circle'
	| 'ellipse'
	| 'line'
	| 'path'
	| 'pathx'
	| 'polygon'
	| 'polyline'
	| 'rect'
	| 'text'
	| 'tspan'
	| 'textPath'
	| 'g'
	| 'defs'
	| 'symbol'
	| 'use'
	| 'linearGradient'
	| 'radialGradient'
	| 'stop'
	| 'pattern'
	| 'clipPath'
	| 'mask'
	| 'filter'
	| 'feBlend'
	| 'feColorMatrix'
	| 'feComponentTransfer'
	| 'feComposite'
	| 'feConvolveMatrix'
	| 'feDiffuseLighting'
	| 'feDisplacementMap'
	| 'feDropShadow'
	| 'feFlood'
	| 'feGaussianBlur'
	| 'feImage'
	| 'feMerge'
	| 'feMorphology'
	| 'feOffset'
	| 'feSpecularLighting'
	| 'feTile'
	| 'feTurbulence'
	| 'title'
	// Reactivo / componentes
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
		return createSvg(selector as any, props as BoxelsElementAttributes<'div'>);
	} else if (typeof selector === 'string') {
		node = document.createElement(selector);
	} else {
		node = selector;
	}

	// Si es un fragmento manual (ej. selector instanceof DocumentFragment)
	if (selector === Fragment || selector instanceof DocumentFragment) {
		const result = normalizeChildren(props?.children);

		result.nodes.forEach((n) => node.appendChild(n));

		const mount = (parent: HTMLElement | DocumentFragment) => {
			if ((node as BoxelsElement).__mounted) return;

			result.onMount();
			props?.['$lifecycle:mount']?.(undefined as any);
			parent.appendChild(node);
			(node as BoxelsElement).__mounted = true;
		};

		const destroy = () => {
			if ((node as BoxelsElement).__destroyed) return;
			result.cleanup();
			props?.['$lifecycle:destroy']?.(undefined as any);
			(node as BoxelsElement).__mounted = false;
			(node as BoxelsElement).__destroyed = true;
			while (node.firstChild) {
				node.firstChild.remove();
			}
		};

		return Object.assign(node, {
			mount,
			destroy,
			mountEffect: () => {
				result.onMount();
				props?.['$lifecycle:mount']?.(undefined as any);
			},
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
		(node as BoxelsElement).__mounted = true;

		result['$lifecycle:mount']?.(node as BoxelsElementNode<T>);
		parent.appendChild(node);
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

export * from './attributes/elements/index';
export * from './attributes/handlers/index';
export * from './utils';
