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
import { simpleUniqueId } from '@dom/utils';
import { deepEqual } from 'fast-equals';

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
	key?: string;
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
		key?: string;
	};

export type BoxelsNode<T extends keyof HTMLElementTagNameMap> =
	BoxelsElementNode<T>;

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

export function createComment(name: string) {
	const comment = document.createComment(name);
	(comment as any).key = simpleUniqueId('comment');
	return comment;
}

export function createTextNode(name: string) {
	const comment = document.createTextNode(name);
	(comment as any).key = simpleUniqueId('text');
	return comment;
}

function reconcileChildren(
	parent: Node,
	oldNodes: Node[],
	newNodes: Node[],
	start: Node | null = null,
	end: Node | null = null,
) {
	const oldKeyed = new Map<string, Node>();
	const used = new Set<Node>();
	const finalNodes: Node[] = [];

	// Indexar oldNodes con key
	for (const oldNode of oldNodes) {
		const key = (oldNode as any).key;
		if (key) oldKeyed.set(key, oldNode);
	}

	// Nodo actual a recorrer desde start hasta end
	let current: Node | null = start ? start.nextSibling : parent.firstChild;

	for (const newNode of newNodes) {
		const key = (newNode as any).key;

		let matched: Node | null = null;

		// Si tiene key, buscamos un nodo antiguo reutilizable
		if (key && oldKeyed.has(key)) {
			matched = oldKeyed.get(key)!;
			used.add(matched);
		}

		if (matched) {
			// Reusar nodo encontrado
			if (matched !== current) {
				parent.insertBefore(matched, current);
			}
			finalNodes.push(matched);
		} else {
			// Nuevo nodo → insertar antes de current
			parent.insertBefore(newNode, current);
			finalNodes.push(newNode);
		}

		if (isBoxelsElement(newNode)) newNode.mountEffect();

		// Avanzar current hasta el siguiente nodo válido
		if (current === newNode || current === matched) {
			current = current!.nextSibling;
		}
	}

	// 🔹 Eliminar los nodos sobrantes entre current y end
	let toRemove = current;
	while (toRemove && toRemove !== end) {
		const next = toRemove.nextSibling;
		if (!used.has(toRemove)) {
			if (isBoxelsElement(toRemove)) {
				try {
					toRemove.destroy();
				} catch {}
			} else {
				try {
					(toRemove as ChildNode).remove();
				} catch {}
			}
		}
		toRemove = next;
	}

	return finalNodes;
}

export function normalizeChildren(input: Child): BoxlesChildren {
	// Inyección condicional de estilos para overlays de cambio
	if (debug.isShowChanges()) ensureChangeStyles();

	const nodes: Node[] = [];
	const cleanUps: (() => void)[] = [];
	const onMounts: (() => void)[] = [];

	const queue: Child[] = Array.isArray(input) ? [...input] : [input];

	while (queue.length) {
		const child = queue.shift();

		if (isBoxelsElement(child)) {
			const elementChild: BoxelsElement = child;
			// Si no es un fragmento, continúa con el comportamiento normal
			nodes.push(elementChild);
			elementChild.mountEffect();
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
					nodes.push(...child.nodes);
					onMounts.push(child.onMount);
					cleanUps.push(child.cleanup);
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
			const start = createComment(
				debug.isShowCommentNames() ? 'signal:start' : '',
			);
			const end = createComment(debug.isShowCommentNames() ? 'signal:end' : '');

			nodes.push(start, end);

			let currentChild: BoxlesChildren | null = null;

			// función que maneja la inserción/reemplazo del valor
			const handleValue = (val: Child) => {
				// Normalizar nuevo valor
				const normalized = normalizeChildren(val);

				// Si no hay cambios en nodos, podemos omitir
				if (deepEqual(normalized.nodes, currentChild?.nodes)) {
					return;
				}

				// Limpia nodos previos
				currentChild?.cleanup();

				if (start.parentNode && end.parentNode) {
					const parent = end.parentNode;
					const oldNodes = currentChild?.nodes ?? [];
					const newNodes = normalized.nodes;

					// 🔹 reconciliamos con la nueva versión que respeta start/end
					const reconciled = reconcileChildren(
						parent,
						oldNodes,
						newNodes,
						start,
						end,
					);

					// 🔹 overlays
					if (debug.isShowChanges()) {
						const overlayCleanups: (() => void)[] = [];

						// detecta cuáles son realmente nuevos o movidos
						const oldSet = new Set(oldNodes);
						for (const n of reconciled) {
							if (!oldSet.has(n)) {
								const cleanupOverlay = createChangeOverlay(n);
								overlayCleanups.push(cleanupOverlay);
							}
						}

						const orig = normalized.cleanup;
						normalized.cleanup = () => {
							orig();
							overlayCleanups.forEach((fn) => fn());
						};
					}

					// Monta los efectos de los nuevos nodos
					normalized.onMount();

					// Actualiza referencia
					currentChild = { ...normalized, nodes: reconciled };
				}
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
			const placeholder = createComment(
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
			onMounts.push(children.onMount);
			cleanUps.push(children.cleanup);
			nodes.push(...children.nodes);
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
			nodes.push(createTextNode(JSON.stringify(child, null, 2)));
			continue;
		}

		// Primitivos
		nodes.push(createTextNode(String(child)));
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
