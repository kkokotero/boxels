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

function createLifecycle<T extends Node>(
	node: T,
	build: () => any,
	options: {
		isFragment: boolean;
		props?: any;
		appendChildren?: (node: T, result: any) => void;
		cleanupChildren?: (node: T, result: any) => void;
		onMountResult?: (result: any, node: T) => void;
		onDestroyResult?: (result: any, node: T) => void;
	},
) {
	let result = build();
	let everMounted = false;

	const destroy = () => {
		if ((node as any).__destroyed) return;
		(node as any).__mounted = false;
		(node as any).__destroyed = true;

		options.props?.['$lifecycle:destroy']?.(node);
		options.cleanupChildren?.(node, result);
		options.onDestroyResult?.(result, node);
	};

	const mount = (parent: HTMLElement | DocumentFragment) => {
		// Si ya estaba montado → rerender
		if ((node as any).__mounted) {
			options.cleanupChildren?.(node, result);
			result = build();
			options.appendChildren?.(node, result);

			// 🚀 activar hooks de hijos en fragments
			if (options.isFragment) {
				result.onMount?.();
			}

			options.props?.['$lifecycle:remount']?.(node);
			return;
		}

		// Primer montaje
		result = build();
		options.appendChildren?.(node, result);

		(node as any).__mounted = true;
		(node as any).__destroyed = false;
		everMounted = true;

		options.props?.['$lifecycle:mount']?.(node);
		parent.appendChild(node);
		options.onMountResult?.(result, node);
	};

	const mountEffect = () => {
		if ((node as any).__mounted) return;
		(node as any).__mounted = true;
		(node as any).__destroyed = false;

		if (everMounted) {
			options.props?.['$lifecycle:remount']?.(node);
		} else {
			options.props?.['$lifecycle:mount']?.(node);
		}

		options.onMountResult?.(result, node);

		return () => destroy();
	};

	return Object.assign(node, {
		mount,
		destroy,
		mountEffect,
		isFragment: options.isFragment,
		__boxels: true,
		__mounted: false,
		__destroyed: false,
	});
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

	// --- Fragmento ---
	if (selector === Fragment) {
		const start = document.createComment(
			debug.isShowCommentNames() ? 'fragment:start' : '',
		);
		const end = document.createComment(
			debug.isShowCommentNames() ? 'fragment:end' : '',
		);

		// truco: usar un contenedor solo lógico, sin nodo extra en el DOM
		const container = document.createDocumentFragment();
		container.appendChild(start);
		container.appendChild(end);

		return createLifecycle(
			container,
			() => normalizeChildren(props?.children || {}),
			{
				isFragment: true,
				props,
				appendChildren: (_node, result) => {
					// insertar entre start y end
					for (const n of result.nodes) {
						end.parentNode?.insertBefore(n, end);
						if (isBoxelsElement(n)) n.mountEffect();
					}
				},
				cleanupChildren: (_node, result) => {
					// limpiar todo entre start y end
					let next = start.nextSibling;
					while (next && next !== end) {
						const toRemove = next;
						next = next.nextSibling;
						toRemove.remove();
					}
					result.cleanup();
				},
				onMountResult: (result) => result.onMount(),
				onDestroyResult: (result) => result.cleanup(),
			},
		) as unknown as BoxelsElement;
	}

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
	if (typeof selector === 'string') {
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
