// Importa utilidades del sistema reactivo
import {
	isSignal,
	type ReactiveSignal,
	type ReactiveUnsubscribe,
} from '@core/reactive';

// Importa controladores globales que pueden instalar efectos secundarios o listeners
import '../handlers/global-handlers';

import { debug } from '@testing/index';
import { createChangeOverlay, ensureChangeStyles } from './zone';

/* -------------------------
   Tipos (sin cambios funcionales)
   ------------------------- */
export type Child =
	| Node
	| string
	| number
	| null
	| false
	| true
	| undefined
	| BoxlesChildren
	| Child[]
	| ReactiveSignal<Child>
	| ReactiveSignal<Child[]>
	| Promise<Child>;

export type BoxlesChildren = {
	nodes: Node[];
	onMount(): void;
	cleanup(): void;
};

export type BoxelsElement = HTMLElement & {
	mount: (parent: HTMLElement | DocumentFragment | Comment) => void;
	destroy: () => void;
	mountEffect: () => () => void;
	isFragment: boolean;
	__boxels: true;
	__mounted: boolean;
	__destroyed: boolean;
};

export type BoxelsElementNode<T extends keyof HTMLElementTagNameMap> =
	HTMLElementTagNameMap[T] & {
		mount: (parent: HTMLElement | DocumentFragment | Comment) => void;
		destroy: () => void;
		mountEffect: () => void;
		isFragment: boolean;
		__boxels: true;
		__mounted: boolean;
		__destroyed: boolean;
	};

// Alias de atributos específicos para tipos HTML dentro de JSX
export type JSXBoxelsELementAttrs<T extends keyof HTMLElementTagNameMap> =
	BoxelsElementAttributes<T>;

// Tipo general para cualquier elemento creado por Boxels
export type JSXBoxelsElement = BoxelsElement & any & {};

/* -------------------------
   Helpers de type guards
   ------------------------- */
export function isNormalizedChild(child: Child): child is BoxlesChildren {
	return (
		typeof child === 'object' &&
		child !== null &&
		'nodes' in child &&
		'onMount' in child &&
		'cleanup' in child
	);
}

export function isBoxelsElement(value: any): value is BoxelsElement {
	return (
		value != null &&
		typeof value === 'object' &&
		typeof value.mount === 'function' &&
		typeof value.destroy === 'function' &&
		value.__boxels === true &&
		typeof value.__mounted === 'boolean' &&
		typeof value.__destroyed === 'boolean'
	);
}

/* -------------------------
   normalizeChildren optimizada
   ------------------------- */
export function normalizeChildren(input: Child): BoxlesChildren {
	// Inyección condicional de estilos para overlays de cambio
	if (debug.isShowChanges()) ensureChangeStyles();

	const nodes: Node[] = [];
	const cleanUps: (() => void)[] = [];
	const onMounts: (() => void)[] = [];

	const queue: Child[] = Array.isArray(input) ? [...input] : [input];

	while (queue.length) {
		const child = queue.shift();

		// BoxelsElement
		if (isBoxelsElement(child)) {
			cleanUps.push(child.mountEffect());
			if (child.isFragment) {
				const children = normalizeChildren(Array.from(child.childNodes));
				onMounts.push(children.onMount);
				cleanUps.push(children.cleanup);
				nodes.push(...children.nodes);
			} else {
				nodes.push(child);
			}
			continue;
		}

		// Si ya está normalizado
		if (isNormalizedChild(child)) {
			nodes.push(...child.nodes);
			onMounts.push(child.onMount);
			cleanUps.push(child.cleanup);
			continue;
		}

		// Señal reactiva
		if (isSignal(child)) {
			const s = child as ReactiveSignal<Child>;
			const start = document.createComment(
				debug.isShowCommentNames() ? 'signal:start' : '',
			);
			const end = document.createComment(
				debug.isShowCommentNames() ? 'signal:end' : '',
			);
			nodes.push(start, end);

			let currentChild: BoxlesChildren | null = null;
			let unsub: ReactiveUnsubscribe | null = null;

			unsub = s.subscribe((val) => {
				if (!start.parentElement || !end.parentElement) return;
				if (typeof currentChild?.cleanup === 'function')
					currentChild?.cleanup();
				currentChild = null;
				const localCleanUps: (() => void)[] = [];

				// 1. Limpieza del valor previo
				const range = document.createRange();
				range.setStartAfter(start);
				range.setEndBefore(end);
				range.deleteContents();

				// 2. Normalizar nuevo valor
				const normalized = normalizeChildren(val);

				// 3. Insertar nodos en el DOM
				normalized.nodes.forEach((n) => {
					if (isBoxelsElement(n)) {
						const cleanUp = n.mountEffect();
						if (typeof cleanUp === 'function') localCleanUps.push(cleanUp);
					}
					end.before(n);
				});
				if (localCleanUps.length !== 0) {
					const origCleanup = normalized.cleanup;
					normalized.cleanup = () => {
						if (typeof origCleanup === 'function') origCleanup();
						localCleanUps.forEach((fn) => fn());
					};
				}

				// 4. Ejecutar onMount del nuevo valor
				normalized.onMount();

				// 5. Overlays de debug
				if (debug.isShowChanges()) {
					const overlayCleanups: (() => void)[] = [];
					normalized.nodes.forEach((n) => {
						const cleanupOverlay = createChangeOverlay(n);
						overlayCleanups.push(cleanupOverlay);
					});
					const origCleanup = normalized.cleanup;
					normalized.cleanup = () => {
						origCleanup();
						overlayCleanups.forEach((fn) => fn());
					};
				}

				currentChild = normalized;
			});

			// Registro de limpieza global
			cleanUps.push(() => {
				currentChild?.cleanup();

				unsub?.();
				const range = document.createRange();
				range.setStartAfter(start);
				range.setEndBefore(end);
				range.deleteContents();
				range.collapse();
				start.remove();
				end.remove();

				currentChild = null;
			});

			// Suscribir
			continue;
		}

		// Promesa
		if (child instanceof Promise) {
			const placeholder = document.createComment(
				debug.isShowCommentNames() ? 'promise:placeholder' : '',
			);
			nodes.push(placeholder);

			onMounts.push(() => {
				let cancelled = false;
				child.then((resolved) => {
					if (cancelled) return;
					const normalized = normalizeChildren(resolved);
					placeholder.replaceWith(...normalized.nodes);
					try {
						normalized.onMount();
					} catch (e) {
						console.error(
							'Error en onMount del contenido resuelto de la promesa:',
							e,
						);
					}
					cleanUps.push(normalized.cleanup);
				});
				cleanUps.push(() => {
					cancelled = true;
				});
			});
			continue;
		}

		// Función
		if (typeof child === 'function') {
			try {
				const result = (child as () => Child | Promise<Child>)();
				queue.unshift(result as Child);
			} catch (err) {
				console.error('Error ejecutando función hijo:', err);
			}
			continue;
		}

		// DocumentFragment
		if (child instanceof DocumentFragment) {
			const children = normalizeChildren(Array.from(child.childNodes));
			onMounts.push(children.onMount);
			cleanUps.push(children.cleanup);
			nodes.push(...children.nodes);
			continue;
		}

		if (child instanceof Node) {
			if (child instanceof Element) {
				const isSvgNode =
					child.namespaceURI === 'http://www.w3.org/2000/svg' ||
					child.tagName.toLowerCase() === 'svg' ||
					child.parentNode instanceof SVGElement;

				if (isSvgNode) {
					const clonedSvgNode = document.importNode(child, true) as SVGElement;
					nodes.push(clonedSvgNode);
					continue;
				}
			}
			nodes.push(child);
			continue;
		}
		if (typeof child === 'object') {
			nodes.push(document.createTextNode(JSON.stringify(child, null, 2)));
			continue;
		}
		nodes.push(document.createTextNode(String(child)));
	}

	return {
		nodes,
		onMount: () => {
			for (const fn of onMounts) fn();
		},
		cleanup: () => {
			for (const fn of cleanUps) if (typeof fn === 'function') fn();
		},
	};
}

export * from './zone';
