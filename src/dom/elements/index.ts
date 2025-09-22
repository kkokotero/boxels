import { createSvg } from './svg';
import { createLifecycle } from './lifecycle';

// Importa controladores globales que pueden instalar efectos secundarios o listeners
import './attributes/handlers/global-handlers';

import './fragment';
import { queue } from '@core/scheduler';
import { isSignal, type Signal } from '@core/index';
import { lifecycleStore } from './lifecycle/lifecycle-store';
import type { BoxelsElement, BoxelsElementNode, BoxelsTagNameMap, Child } from './types';
import { normalizeChildren } from '@dom/elements/children';
import { isBoxelsElement } from '@dom/utils/element';

export const Fragment: unique symbol = Symbol('Boxles-Fragment');

/**
 * Interfaz base que debe implementar cualquier componente del sistema.
 * Todo componente define un método `render()` que devuelve un JSX.Element.
 *
 * Ejemplo:
 *   class MiComponente implements Component {
 *     render() {
 *       return <div>Hola mundo</div>;
 *     }
 *   }
 */
export interface Component {
	render: () => JSX.Element;
}

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

export type BoxelsElementSelector<T extends keyof BoxelsTagNameMap> =
	| T
	| BoxelsTagNameMap[T]
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
	| 'fragment'
	// Reactivo / componentes
	| FunctionalComponent
	| Signal<any>
	| ClassComponent;

// Función para detectar si es un componente de clase
export function isClassComponent(fn: unknown): fn is ClassComponent {
	return (
		typeof fn === 'function' &&
		typeof (fn as any).prototype === 'object' &&
		typeof (fn as any).prototype.render === 'function'
	);
}

export function $<T extends keyof BoxelsTagNameMap>(
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
		selector instanceof DocumentFragment ||
		(selector as string) === 'fragment'
	) {
		node = document.createElement('x-fragment');
	} else if (typeof selector === 'string') {
		node = document.createElement(selector);
	} else {
		node = selector;
	}

	// --- Nodo normal ---
	return createLifecycle(node as any, {
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
			result['$lifecycle:mount']?.(node as BoxelsElementNode<T>);
		},
	}) as unknown as BoxelsElement;
}

/**
 * Monta (agrega) uno o varios elementos JSX a un contenedor en el DOM.
 *
 * @param parent - Contenedor donde se insertarán los hijos. Puede ser:
 *   - HTMLElement (<div>, <section>, etc.)
 *   - DocumentFragment (fragmento de nodos).
 * @param children - Uno o más nodos JSX a insertar.
 *
 * - Si el hijo es una Promesa, se espera a su resolución antes de insertarlo.
 * - Internamente delega la inserción en `appendChild`, que gestiona casos especiales
 *   como señales, BoxelsElements, fragmentos y nodos DOM comunes.
 */
export const mount = async (
  parent: HTMLElement | DocumentFragment,
  ...children: (JSX.Element | JSX.Component<any, {}>)[]
) => {
  for (const child of children) {
	const resolved = await (typeof child === "function" ? child({}) : child);

	const fragment = $('fragment' as 'div', {}, resolved);
	parent.appendChild(fragment);

	queue(() => {
		if (!parent.contains(resolved)) {
		  throw new Error(
			`El elemento no se pudo montar correctamente en el DOM: ${resolved}`
		  );
		}
	});
  }
};

/**
 * Desmonta (elimina) elementos JSX del DOM.
 *
 * @param children - Elementos JSX a eliminar.
 *
 * - Si es un `BoxelsElement`:
 *   - Verifica que esté montado (`__mounted`).
 *   - Llama a su método `destroy()` para ejecutar lógica de limpieza interna (eventos, efectos, etc).
 * - Si es un nodo DOM común → se elimina con `.remove()`.
 */
export const unmount = async (...children: JSX.Element[]) => {

	 for (const child of children) {
		const parent = child.parentElement;
		if (isBoxelsElement(child)) {
			// Solo destruir si estaba montado
			if (child.__mounted) {
				child.destroy();
			}
		} else {
			// Eliminar nodo DOM estándar
			(child as ChildNode).remove();
		}

		queue(() => {
			if (parent?.contains(child)) {
						  throw new Error(
				`El elemento no se pudo desmontar correctamente en el DOM: ${child}`
			  );
			}
		})
	 }
};

/* -------------------------
   Global Effects System (DX)
   ------------------------- */

export function onMount(cb: (node: BoxelsElement) => void) {
	lifecycleStore.globalMountEffects.push(cb);
	// devolvemos función para eliminar solo ese callback
	return () => {
		lifecycleStore.globalMountEffects =
			lifecycleStore.globalMountEffects.filter((fn) => fn !== cb);
	};
}

export function onDestroy(cb: (node: BoxelsElement) => void) {
	lifecycleStore.globalDestroyEffects.push(cb);
	return () => {
		lifecycleStore.globalDestroyEffects =
			lifecycleStore.globalDestroyEffects.filter((fn) => fn !== cb);
	};
}