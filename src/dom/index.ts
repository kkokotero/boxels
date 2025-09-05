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
import { appendChild } from './utils';
import { debug } from '@testing/debugger';
import { createLifecycle } from './lifecycle';

import './fragment';

export const Fragment: unique symbol = Symbol('Boxles-Fragment');

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

	// --- Otros tipos ---
	if (isClassComponent(selector)) {
		const instance = new selector(props);
		return instance.render();
	}
	if (isSignal(selector)) {
		const nodes = normalizeChildren(selector as Child);
		return $(Fragment, {}, nodes);
	}
	if (typeof selector === 'function') {
		return selector(props);
	}
	if (typeof selector === 'string' && svgTags.has(selector)) {
		return createSvg(selector as any, props as BoxelsElementAttributes<'div'>);
	}
	// --- Fragmento ---
	if (
		selector === Fragment ||
		selector === document.createDocumentFragment() ||
		(selector as string) === 'fragment'
	) {
		node = document.createElement('x-fragment');
	} else if (typeof selector === 'string') {
		node = document.createElement(selector);
	} else {
		node = selector;
	}

	// --- Nodo normal ---
	return createLifecycle(
		node,
		() => handleAttributes(node as HTMLElement, props ?? {}),
		{
			isFragment: false,
			props,
			cleanupChildren: (node, result) => {
				if (typeof (node as ChildNode).remove === 'function') {
					(node as ChildNode).remove();
				}
				result['$lifecycle:destroy']?.(node);
			},
			onDestroyResult: (result, node) =>
				result['$lifecycle:destroy']?.(node as any),
			onMountResult: (result, node) => {
				if ((node as any).__destroyed) {
					props?.['$lifecycle:remount']?.(node as BoxelsElementNode<T>);
				} else {
					result['$lifecycle:mount']?.(node as BoxelsElementNode<T>);
				}
			},
		},
	) as unknown as BoxelsElement;
}

export * from './attributes/elements/index';
export * from './attributes/handlers/index';
export * from './utils';
