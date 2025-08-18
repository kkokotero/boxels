// Importa utilidades del sistema reactivo
import {
	isSignal,
	type ReactiveSignal,
	type ReactiveUnsubscribe,
} from '@core/reactive';

// Importa controladores globales que pueden instalar efectos secundarios o listeners
import '../handlers/global-handlers';

import { __development__, __show_changes__ } from '../../../environment';
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
	mountEffect: () => void;
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
	if (__development__ && __show_changes__) ensureChangeStyles();

	const nodes: Node[] = [];
	const cleanUps: (() => void)[] = [];
	const onMounts: (() => void)[] = [];

	const queue: Child[] = Array.isArray(input) ? [...input] : [input];

	// Helper para ejecutar onMounts en microtask (evita condiciones de carrera con DOM insertado)
	function scheduleMount(fn: () => void) {
		queueMicrotask(fn);
	}

	while (queue.length) {
		const child = queue.shift();

		if (child == null || child === false) continue;

		// BoxelsElement
		if (isBoxelsElement(child)) {
			nodes.push(child);
			if (child.isFragment) onMounts.push(child.mountEffect);
			cleanUps.push(() => child.destroy());
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
			const start = document.createComment('');
			const end = document.createComment('');
			nodes.push(start, end);

			let currentChild: BoxlesChildren | null = null;
			let isMounted = false;
			let firstRun = true;
			let unsub: ReactiveUnsubscribe | null = null;

			// Encapsula la lógica de reemplazo para minimizar repaints
			const replaceRangeWith = (fragment: DocumentFragment) => {
				const range = document.createRange();
				range.setStartAfter(start);
				range.setEndBefore(end);
				range.deleteContents();
				end.parentNode?.insertBefore(fragment, end);
			};

			// Suscribir
			unsub = s.subscribe((val) => {
				// Limpieza del child actual
				if (currentChild) {
					try {
						currentChild.cleanup();
					} catch (e) {
						console.error('Error al limpiar el hijo actual:', e);
					}
					currentChild = null;
				}

				// Normalizar el nuevo valor y generar fragmento
				const normalized = normalizeChildren(val);
				currentChild = normalized;

				const frag = document.createDocumentFragment();
				normalized.nodes.forEach((n) => frag.appendChild(n.cloneNode(true)));

				replaceRangeWith(frag);

				// Visual overlays (si aplica)
				const overlayCleanups: (() => void)[] = [];
				if (__development__ && __show_changes__) {
					normalized.nodes.forEach((n) => {
						const cleanupOverlay = createChangeOverlay(n);
						overlayCleanups.push(cleanupOverlay);
					});
					const origCleanup = normalized.cleanup;
					normalized.cleanup = () => {
						try {
							origCleanup();
						} catch (e) {
							console.error('Error en normalized.cleanup:', e);
						}
						overlayCleanups.forEach((fn) => {
							try {
								fn();
							} catch (e) {
								console.error('Error al limpiar overlay:', e);
							}
						});
					};
				}

				if (isMounted) {
					scheduleMount(() => {
						try {
							normalized.onMount();
						} catch (e) {
							console.error('Error en normalized.onMount:', e);
						}
					});
				} else if (firstRun) {
					onMounts.push(() => {
						if (currentChild) {
							try {
								currentChild.onMount();
							} catch (e) {
								console.error('Error en onMount diferido:', e);
							}
						}
					});
					firstRun = false;
				}
			});

			// Registro de montaje
			onMounts.push(() => {
				isMounted = true;
				if (currentChild) {
					try {
						currentChild.onMount();
					} catch (e) {
						console.error('Error ejecutando onMount del hijo actual:', e);
					}
				}
			});

			// Registro de limpieza
			cleanUps.push(() => {
				if (currentChild) {
					try {
						currentChild.cleanup();
					} catch (e) {
						console.error(
							'Error al limpiar hijo actual durante cleanup del padre:',
							e,
						);
					}
				}
				if (unsub) {
					try {
						unsub();
					} catch (e) {
						console.error('Error al desuscribir la señal:', e);
					}
				}
			});

			continue;
		}

		// Promesa
		if (child instanceof Promise) {
			const placeholder = document.createComment('');
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
			const children = normalizeChildren(
				Array.from(child.cloneNode(true).childNodes),
			);
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

		// Valores primitivos
		const t = typeof child;
		if (
			t === 'string' ||
			t === 'number' ||
			t === 'bigint' ||
			t === 'boolean' ||
			t === 'undefined'
		) {
			nodes.push(document.createTextNode(String(child)));
		}
	}

	return {
		nodes,
		onMount: () => {
			for (const fn of onMounts) {
				try {
					fn();
				} catch (e) {
					console.error('Error en manejador onMount:', e);
				}
			}
		},
		cleanup: () => {
			for (let i = cleanUps.length - 1; i >= 0; i--) {
				try {
					cleanUps[i]();
				} catch (e) {
					console.error('Error en manejador cleanup:', e);
				}
			}
		},
	};
}
