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

	// Helper: envuelve un BoxlesChildren con sus propios anchors (start/end)
	function wrapScoped(
		inner: BoxlesChildren,
		name = 'fragment',
	): BoxlesChildren {
		const start = document.createComment(
			debug.isShowCommentNames() ? `${name}:start` : '',
		);
		const end = document.createComment(
			debug.isShowCommentNames() ? `${name}:end` : '',
		);

		const wrappedNodes: Node[] = [start, ...inner.nodes, end];

		const onMount = () => {
			inner.onMount();
		};

		const cleanup = () => {
			// eliminar lo que quede entre start y end (si están montados)
			try {
				let next = start.nextSibling;
				while (next && next !== end) {
					const toRemove = next;
					next = next.nextSibling;
					if (isBoxelsElement(toRemove)) {
						try {
							(toRemove as BoxelsElement).destroy?.();
						} catch (e) {
							/* swallow */
						}
					} else {
						try {
							toRemove.remove();
						} catch (e) {
							/* swallow */
						}
					}
				}
			} catch (e) {
				/* swallow */
			}

			// delegar cleanup original
			try {
				inner.cleanup();
			} catch (e) {
				/* swallow */
			}

			// remover anchors si quedaron sueltos
			try {
				start.remove();
			} catch (e) {
				/* swallow */
			}
			try {
				end.remove();
			} catch (e) {
				/* swallow */
			}
		};

		return {
			nodes: wrappedNodes,
			onMount,
			cleanup,
		};
	}

	while (queue.length) {
		const child = queue.shift();

		if (isBoxelsElement(child)) {
			const elementChild: BoxelsElement = child;

			// cada BoxelsElement se normaliza como un "mini-BoxlesChildren"
			nodes.push(elementChild);

			if (!child.isFragment) elementChild.mountEffect();
			onMounts.push(() => {
				if (!elementChild.__mounted) {
					try {
						const cleanup = elementChild.mountEffect();
						if (typeof cleanup === 'function') cleanUps.push(cleanup);
					} catch (e) {
						console.error('mountEffect error (deferred):', e);
					}
				}
			});

			continue;
		}

		// Si ya está normalizado
		if (isNormalizedChild(child)) {
			// Si parece provenir de un fragmento (múltiples nodos), envolverlo para tener scope propio
			if (child.nodes.length > 1) {
				const first = child.nodes[0];
				const last = child.nodes[child.nodes.length - 1];
				const looksWrapped =
					first?.nodeType === Node.COMMENT_NODE &&
					last?.nodeType === Node.COMMENT_NODE;

				if (!looksWrapped) {
					const wrapped = wrapScoped(child, 'wrapped');
					nodes.push(...wrapped.nodes);
					onMounts.push(wrapped.onMount);
					cleanUps.push(wrapped.cleanup);
					continue;
				}
			}

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

			// función que maneja la inserción/reemplazo del valor
			const handleValue = (val: Child) => {
				// Normalizar nuevo valor
				let normalized = normalizeChildren(val);

				// Si el resultado tiene múltiples nodos, envolverlo en su propio scope
				if (normalized.nodes.length > 1) {
					normalized = (function wrapScoped(
						inner: BoxlesChildren,
						name = 'signal-frag',
					): BoxlesChildren {
						const sStart = document.createComment(
							debug.isShowCommentNames() ? `${name}:start` : '',
						);
						const sEnd = document.createComment(
							debug.isShowCommentNames() ? `${name}:end` : '',
						);
						return {
							nodes: [sStart, ...inner.nodes, sEnd],
							onMount: inner.onMount,
							cleanup: inner.cleanup,
						};
					})(normalized, 'signal-frag');
				}

				// Si es exactamente el mismo conjunto de nodos (misma referencia), no hacemos nada
				// (evita duplicados si la señal re-emite el mismo BoxlesChildren)
				if (currentChild && currentChild === normalized) return;

				// Borrar contenido actual entre start y end de forma segura
				if (start.parentNode && end.parentNode) {
					let next = start.nextSibling;
					while (next && next !== end) {
						const toRemove = next;
						next = next.nextSibling;
						// destruir si es BoxelsElement
						if (isBoxelsElement(toRemove)) {
							try {
								(toRemove as BoxelsElement).destroy?.();
							} catch (e) {
								/* swallow */
							}
						} else {
							try {
								toRemove.remove();
							} catch (e) {
								/* swallow */
							}
						}
					}
				}

				// Insertar atómicamente con DocumentFragment
				if (end.parentNode) {
					const frag = document.createDocumentFragment();
					for (const n of normalized.nodes) frag.appendChild(n);
					end.parentNode.insertBefore(frag, end);
				}

				// Ejecutar onMount del nuevo valor
				try {
					normalized.onMount();
				} catch (e) {
					console.error('onMount error (signal):', e);
				}

				// limpiar el anterior (solo después de montar el nuevo para evitar parpadeos)
				try {
					currentChild?.cleanup();
				} catch (e) {
					/* swallow */
				}

				// debug overlays: envolver cleanup si aplica (mantén tu lógica)
				if (debug.isShowChanges()) {
					const overlayCleanups: (() => void)[] = [];
					normalized.nodes.forEach((n) => {
						const cleanupOverlay = createChangeOverlay(n);
						overlayCleanups.push(cleanupOverlay);
					});
					const orig = normalized.cleanup;
					normalized.cleanup = () => {
						orig();
						overlayCleanups.forEach((fn) => fn());
					};
				}

				currentChild = normalized;
			};

			// Registramos la suscripción en onMount (deferred)
			onMounts.push(() => {
				let localCurrent: BoxlesChildren | null = null;

				// local handler que sincroniza localCurrent con currentChild
				const localHandler = (v: Child) => {
					handleValue(v);
					localCurrent = currentChild;
				};

				// subscribe puede llamar el handler sincrónicamente; está bien porque
				// handleValue es idempotente en limpieza/inserción.
				const unsub: ReactiveUnsubscribe = s.subscribe(localHandler);

				// cleanup para cuando el padre limpie esta normalizeChildren
				cleanUps.push(() => {
					// limpiar el contenido actual insertado por esta suscripción
					try {
						localCurrent?.cleanup();
					} catch (e) {
						/* swallow */
					}

					// eliminar nodos si todavía están en el DOM
					if (localCurrent?.nodes) {
						for (const n of localCurrent.nodes) {
							if (
								isBoxelsElement(n) &&
								typeof (n as BoxelsElement).destroy === 'function'
							) {
								try {
									(n as BoxelsElement).destroy();
								} catch (e) {
									/* swallow */
								}
							} else {
								try {
									(n as ChildNode).remove();
								} catch (e) {
									/* swallow */
								}
							}
						}
					}

					// desuscribir
					try {
						unsub();
					} catch (e) {
						/* swallow */
					}

					// si los anchors ya no están montados, quitar anchors
					if (!start.parentElement || !end.parentElement) {
						try {
							start.remove();
						} catch (e) {
							/* swallow */
						}
						try {
							end.remove();
						} catch (e) {
							/* swallow */
						}
						return;
					}

					// borrar lo que pueda quedar entre start y end (seguro)
					if (start.parentNode && end.parentNode) {
						let next = start.nextSibling;
						while (next && next !== end) {
							const toRemove = next;
							next = next.nextSibling;
							try {
								toRemove.remove();
							} catch (e) {
								/* swallow */
							}
						}
					}
				});
			});

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

		// Función (evaluar y reintentar)
		if (typeof child === 'function') {
			try {
				const result = (child as () => Child | Promise<Child>)();
				queue.unshift(result as Child);
			} catch (err) {
				console.error('Error ejecutando función hijo:', err);
			}
			continue;
		}

		// DocumentFragment -> normalizamos y lo envolvemos en scope propio
		if (child instanceof DocumentFragment) {
			const children = normalizeChildren(
				Array.from(child.cloneNode(true).childNodes) as unknown as Child,
			);
			const wrapped = wrapScoped(children, 'docfrag');
			onMounts.push(wrapped.onMount);
			cleanUps.push(wrapped.cleanup);
			nodes.push(...wrapped.nodes);
			continue;
		}

		// Nodos DOM normales
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

		// Objetos -> text node
		if (typeof child === 'object') {
			nodes.push(document.createTextNode(JSON.stringify(child, null, 2)));
			continue;
		}

		// Primitivos
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
