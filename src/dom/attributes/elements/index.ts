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
import { appendChild, uniqueId } from '@dom/utils';

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

// Heurística rápida para detectar cambios visibles entre nodos reutilizados
function quickNodesDiffer(prev: any, next: any): boolean {
	// Caso: ambos son textos
	if (
		prev.nodes.length === 1 &&
		next.nodes.length === 1 &&
		prev.nodes[0].nodeType === Node.TEXT_NODE &&
		next.nodes[0].nodeType === Node.TEXT_NODE
	) {
		return prev.nodes[0].textContent !== next.nodes[0].textContent;
	}

	// Caso: nodos raíz de distinto tipo
	if (prev.nodes[0]?.nodeName !== next.nodes[0]?.nodeName) {
		return true;
	}

	// Podrías extender esto comparando attrs "clave"
	// (ejemplo: class, style, data-* importantes)
	const prevEl = prev.nodes[0] as HTMLElement;
	const nextEl = next.nodes[0] as HTMLElement;
	if (prevEl instanceof HTMLElement && nextEl instanceof HTMLElement) {
		if (prevEl.getAttribute('class') !== nextEl.getAttribute('class')) {
			return true;
		}
		if (prevEl.getAttribute('style') !== nextEl.getAttribute('style')) {
			return true;
		}
	}

	return false;
}

// Búsqueda rápida de un nodo previo correspondiente
function findPrevChildFor(
	child: any,
	currentKeyMap: Map<string, Child>,
	currentUnkeyed: Child[],
): Child | null {
	if (child.key != null) {
		return currentKeyMap.get(child.key) ?? null;
	}
	// si es unchild sin key → tratamos de encontrar por posición aproximada
	// (esto depende de cómo estés manejando los arrays)
	return currentUnkeyed[child.index] ?? null;
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
			const start = document.createComment(
				debug.isShowCommentNames() ? 'signal:start' : '',
			);
			const end = document.createComment(
				debug.isShowCommentNames() ? 'signal:end' : '',
			);

			// añadimos anchors inicialmente (mantener consistencia con el pipeline)
			nodes.push(start, end);

			// --- Caso especial: señal que produce primitivo -> textNode reactivo ---
			const tryInit = (() => {
				let initVal: any;
				try {
					initVal = (s as any)();
				} catch {
					initVal = undefined;
				}
				const isPrimitive =
					initVal == null ||
					typeof initVal === 'string' ||
					typeof initVal === 'number' ||
					typeof initVal === 'boolean';
				return { initVal, isPrimitive };
			})();

			if (tryInit.isPrimitive) {
				const textNode = document.createTextNode(
					tryInit.initVal == null ? '' : String(tryInit.initVal),
				);

				// insertar textNode en `nodes` justo antes de `end`
				const endIndex = nodes.indexOf(end);
				if (endIndex >= 0) {
					nodes.splice(endIndex, 0, textNode);
				} else {
					nodes.push(textNode);
				}

				// Suscribir en onMounts para actualizar textNode y limpiar al desmontar
				onMounts.push(() => {
					const unsub: ReactiveUnsubscribe = s.subscribe((v: any) => {
						try {
							textNode.textContent = v == null ? '' : String(v);
						} catch {
							textNode.textContent = '';
						}
					});

					// cleanup
					cleanUps.push(() => {
						try {
							unsub();
						} catch {
							/* swallow */
						}
						try {
							textNode.remove();
						} catch {
							/* swallow */
						}
					});
				});

				continue;
			}

			// --- Reconciliación compleja (no primitivo) ---

			let currentChild: BoxlesChildren | null = null;
			// mapa key -> array de BoxlesChildren (soporta duplicados)
			let currentKeyMap = new Map<string, BoxlesChildren[]>();
			// array para nodos sin key (reconciliación posicional)
			let currentUnkeyed: BoxlesChildren[] = [];

			// Aux: obtener key si existe (solo si el nodo ya trae key). NO fabricar keys.
			const getKeyIfExists = (node: any): string | null => {
				if (isBoxelsElement(node) && node.key != null) {
					return String(node.key);
				}
				return null;
			};

			// Heurística: snapshot rápida de un BoxlesChildren (puedes ajustar)
			const snapshotOf = (child: BoxlesChildren): string => {
				const nodes = child.nodes ?? [];
				const parts: string[] = [String(nodes.length)];
				for (const n of nodes) {
					if (!n) {
						parts.push('null');
						continue;
					}
					if ((n as Node).nodeType === Node.TEXT_NODE) {
						parts.push('T:' + String((n as Text).textContent));
					} else if ((n as Node).nodeType === Node.ELEMENT_NODE) {
						const el = n as Element;
						parts.push(
							'E:' +
								el.tagName +
								'#' +
								(el.id || '') +
								'.' +
								(el.className || '') +
								'[' +
								String(el.childElementCount) +
								']' +
								'<' +
								String((el.textContent || '').length) +
								'>',
						);
					} else {
						parts.push('O:' + (n as Node).nodeName);
					}
				}
				return parts.join('|');
			};

			// Helper: clonar map<string, array>
			const cloneMapOfArrays = (m: Map<string, BoxlesChildren[]>) => {
				const out = new Map<string, BoxlesChildren[]>();
				for (const [k, arr] of m) out.set(k, arr.slice());
				return out;
			};

			// función que maneja la inserción/reemplazo del valor
			const handleValue = (val: Child) => {
				// Normalizar nuevo valor
				const normalized = normalizeChildren(val);

				// Si es exactamente el mismo conjunto, nada que hacer
				if (currentChild && currentChild === normalized) return;

				// --- Guardar snapshot y copias del estado previo (antes de mutar currentKeyMap/currentUnkeyed) ---
				const prevKeyMap = cloneMapOfArrays(currentKeyMap); // copia superficial de arrays
				const prevUnkeyed = currentUnkeyed.slice();

				// snapshots previos por key -> array de snapshots (coincide con prevKeyMap arrays)
				const prevKeySnapshots = new Map<string, string[]>();
				for (const [k, arr] of prevKeyMap) {
					const snaps: string[] = [];
					for (const c of arr) {
						try {
							snaps.push(snapshotOf(c));
						} catch {
							snaps.push('');
						}
					}
					prevKeySnapshots.set(k, snaps);
				}
				// snapshots para unkeyed (posicional)
				const prevUnkeyedSnapshots: string[] = prevUnkeyed.map((c) => {
					try {
						return snapshotOf(c);
					} catch {
						return '';
					}
				});

				// Estructuras para la próxima representación:
				const nextKeyMap = new Map<string, BoxlesChildren[]>(); // key -> array (posible duplicados)
				const nextUnkeyed: BoxlesChildren[] = [];
				const nextSequence: BoxlesChildren[] = []; // orden final de grupos (para insert/move)

				// metadata por child para luego decidir overlays
				type Meta = {
					isNew: boolean;
					key?: string;
					prevSig?: string;
					oldIndex?: number;
				};
				const childMeta = new Map<BoxlesChildren, Meta>();
				const createdChildren = new Set<BoxlesChildren>();

				// índice para consumo posicional de prevUnkeyed
				let unkeyedIndex = 0;

				// Recorremos cada nodo normalizado en orden, determinando su child (reusar o crear)
				for (const n of normalized.nodes) {
					const key = getKeyIfExists(n);

					if (key !== null) {
						// Caso: nodo con key -> reconciliación por key usando prevKeyMap (cola FIFO)
						const queue = prevKeyMap.get(key);
						if (queue && queue.length > 0) {
							// reutilizamos la primera instancia disponible
							const reused = queue.shift()!;
							// añadir a nextKeyMap (crear array si no existe)
							if (!nextKeyMap.has(key)) nextKeyMap.set(key, []);
							nextKeyMap.get(key)!.push(reused);
							nextSequence.push(reused);
							// obtener snapshot correspondiente (si existe) y guardarla en meta
							const snaps = prevKeySnapshots.get(key) || [];
							const prevSig = snaps.length > 0 ? snaps.shift()! : '';
							childMeta.set(reused, { isNew: false, key, prevSig });
						} else {
							// nuevo con key
							const created = normalizeChildren(n);
							if (!nextKeyMap.has(key)) nextKeyMap.set(key, []);
							nextKeyMap.get(key)!.push(created);
							nextSequence.push(created);
							createdChildren.add(created);
							childMeta.set(created, { isNew: true, key });
						}
					} else {
						// Caso: nodo sin key -> reconciliación posicional usando prevUnkeyed
						const existing = prevUnkeyed[unkeyedIndex];
						if (existing) {
							// reutilizar el existente en esa posición
							nextUnkeyed.push(existing);
							nextSequence.push(existing);
							// snapshot disponible en prevUnkeyedSnapshots[unkeyedIndex]
							childMeta.set(existing, {
								isNew: false,
								oldIndex: unkeyedIndex,
								prevSig: prevUnkeyedSnapshots[unkeyedIndex],
							});
						} else {
							// crear nuevo (no hay key, es posicional)
							const created = normalizeChildren(n);
							nextUnkeyed.push(created);
							nextSequence.push(created);
							createdChildren.add(created);
							childMeta.set(created, { isNew: true, oldIndex: unkeyedIndex });
						}
						unkeyedIndex++;
					}
				}

				// Nota: prevKeyMap ahora contiene colas con lo que quedó sin consumir (sobrantes a limpiar)

				// -------------- Diff en el DOM: insertar/mover por orden final --------------
				if (end.parentNode) {
					const parent = end.parentNode;
					let anchor: Node = start;

					for (const child of nextSequence) {
						const nodesOfChild = child.nodes ?? [];
						if (nodesOfChild.length === 0) {
							continue;
						}

						const firstNode = nodesOfChild[0] as Node;
						const lastNode = nodesOfChild[nodesOfChild.length - 1] as Node;

						const alreadyInPlace =
							firstNode.parentNode === parent &&
							firstNode.previousSibling === anchor;

						if (alreadyInPlace) {
							// avanzar anchor hasta el final del grupo
							anchor = lastNode;
							continue;
						}

						// insertar/mover el primer nodo del grupo justo después del anchor
						try {
							parent.insertBefore(firstNode, anchor.nextSibling);
						} catch {
							try {
								parent.insertBefore(firstNode, end);
							} catch {}
						}

						// asegurar que los demás nodos del grupo sigan en orden
						for (let i = 1; i < nodesOfChild.length; i++) {
							const nd = nodesOfChild[i] as Node;
							const prev = nodesOfChild[i - 1] as Node;
							if (nd.parentNode === parent && nd.previousSibling === prev) {
								continue;
							}
							try {
								parent.insertBefore(nd, prev.nextSibling);
							} catch {
								try {
									parent.insertBefore(nd, end);
								} catch {}
							}
						}

						anchor = lastNode;
					}
				}

				// -------------- onMount para nuevos --------------
				// new keyed
				for (const [k, arr] of nextKeyMap) {
					for (const child of arr) {
						const meta = childMeta.get(child);
						if (meta && meta.isNew) {
							try {
								child.onMount();
							} catch (e) {
								console.error('onMount error (signal, new keyed child):', e);
							}
						}
					}
				}
				// new unkeyed
				for (const child of nextUnkeyed) {
					const meta = childMeta.get(child);
					if (meta && meta.isNew) {
						try {
							child.onMount();
						} catch (e) {
							console.error('onMount error (signal, new pos child):', e);
						}
					}
				}

				// -------------- Limpiar los antiguos que quedaron en prevKeyMap (keys ya no presentes o sobrantes) --------------
				for (const [, arr] of prevKeyMap) {
					for (const oldChild of arr) {
						try {
							oldChild.cleanup();
						} catch {}
						if (oldChild.nodes) {
							for (const n of oldChild.nodes) {
								try {
									if (
										isBoxelsElement(n) &&
										typeof (n as BoxelsElement).destroy === 'function'
									) {
										(n as BoxelsElement).destroy();
									}
								} catch {}
								try {
									(n as ChildNode).remove();
								} catch {}
							}
						}
					}
				}

				// -------------- Limpiar los posicionales sobrantes (si la nueva lista tiene menos posicionales) --------------
				for (let i = unkeyedIndex; i < prevUnkeyed.length; i++) {
					const oldChild = prevUnkeyed[i];
					try {
						oldChild.cleanup();
					} catch {}
					if (oldChild.nodes) {
						for (const n of oldChild.nodes) {
							try {
								if (
									isBoxelsElement(n) &&
									typeof (n as BoxelsElement).destroy === 'function'
								) {
									(n as BoxelsElement).destroy();
								}
							} catch {}
							try {
								(n as ChildNode).remove();
							} catch {}
						}
					}
				}

				// -------------- Debug overlays (solo sobre los que se crearon o realmente cambiaron por instancia) --------------
				if (debug.isShowChanges()) {
					const overlayCleanups: (() => void)[] = [];

					// 1) overlay en los nuevos creados
					for (const child of createdChildren) {
						for (const n of child.nodes ?? []) {
							try {
								const cleanupOverlay = createChangeOverlay(n);
								overlayCleanups.push(cleanupOverlay);
							} catch {}
						}
					}

					// 2) overlay en reutilizados que cambiaron: comparar prevSig vs nowSig por instancia
					for (const child of nextSequence) {
						const meta = childMeta.get(child);
						if (!meta || meta.isNew) continue;

						const prevSig = meta.prevSig ?? '';
						let nowSig = '';
						try {
							nowSig = snapshotOf(child);
						} catch {
							nowSig = '';
						}

						if (prevSig !== nowSig) {
							for (const n of child.nodes ?? []) {
								try {
									const cleanupOverlay = createChangeOverlay(n);
									overlayCleanups.push(cleanupOverlay);
								} catch {}
							}
						}
					}

					// adjuntar cleanup overlay a la normalized.cleanup
					const orig = normalized.cleanup;
					normalized.cleanup = () => {
						try {
							orig();
						} catch {}
						overlayCleanups.forEach((fn) => {
							try {
								fn();
							} catch {}
						});
					};
				}

				// -------------- Actualizar estado para próximas reconciliaciones --------------
				currentKeyMap = nextKeyMap;
				currentUnkeyed = nextUnkeyed;
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
				// handleValue es idempotento en limpieza/inserción.
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
