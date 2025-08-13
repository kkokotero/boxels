// Importa utilidades del sistema reactivo
import {
	isSignal,
	type ReactiveSignal,
	type ReactiveUnsubscribe,
} from '@core/reactive';

// Importa controladores globales que pueden instalar efectos secundarios o listeners
import '../handlers/global-handlers';

import { __development__, __show_changes__ } from '../../../environment';

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

/**

/* -------------------------
   Utilidades internas
   ------------------------- */

// Inyectar hoja de estilos (solo una vez) para los overlays de cambio.
let __styleInjected = false;
function ensureChangeStyles() {
	if (!__development__ || !__show_changes__ || __styleInjected) return;
	__styleInjected = true;
	const css = `
.______change-overlay {
	position: absolute;
	inset: 0;
	pointer-events: none;
	transition: opacity 380ms ease-out;
	background: rgba(30, 167, 87, 0.28); /* ligeramente verde como antes */
	opacity: 1;
	z-index: 9999;
}
.______change-wrapper {
	position: relative; /* se añade cuando necesitamos overlay dentro del contenedor */
}
`;
	const el = document.createElement('style');
	el.setAttribute('data-boxels-changes', 'true');
	el.textContent = css;
	document.head.appendChild(el);
}

// Intenta marcar un contenedor relativo sin sobrescribir estilos existentes.
// Retorna la clase que añadimos o null si no fue necesario.
function ensureRelativeContainer(parent: HTMLElement): string | null {
	const computed = getComputedStyle(parent);
	// Si el parent no tiene posicionamiento relativo/absolute/fixed/sticky, añadimos nuestra clase
	if (
		!['relative', 'absolute', 'fixed', 'sticky'].includes(computed.position)
	) {
		parent.classList.add('______change-wrapper');
		return '______change-wrapper';
	}
	return null;
}

/* -------------------------
   Helpers de tipo guards (sin cambios)
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

	// Helper para ejecutar onMounts en microtask (evita race conditions con DOM insert)
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
				// Utilizamos Range para borrar el contenido entre los comentarios
				const range = document.createRange();
				range.setStartAfter(start);
				range.setEndBefore(end);
				range.deleteContents();
				end.parentNode?.insertBefore(fragment, end);
			};

			// Visual change overlay creator: crea, anima y devuelve función de cleanup
			// Reemplaza la versión anterior de createChangeOverlay por esta
			const createChangeOverlay = (node: Node): (() => void) => {
				if (!__development__ || !__show_changes__) return () => {};

				// Solo aplicable si existe un parent element donde poner overlays
				const parent = (
					node.nodeType === Node.ELEMENT_NODE
						? (node as Element).parentElement
						: node.parentElement
				) as HTMLElement | null;
				if (!parent) return () => {};

				// Aseguramos wrapper relativo sin sobrescribir estilos
				ensureRelativeContainer(parent);

				const overlay = document.createElement('div');
				overlay.className = '______change-overlay';
				overlay.style.opacity = '1';
				overlay.style.position = 'absolute';
				overlay.style.pointerEvents = 'none';

				// Helper: coloca el overlay usando rect relativo al parent
				const placeOverlayAt = (rect: DOMRect) => {
					const parentRect = parent.getBoundingClientRect();
					const left = rect.left - parentRect.left;
					const top = rect.top - parentRect.top;
					overlay.style.left = `${Math.max(0, Math.round(left))}px`;
					overlay.style.top = `${Math.max(0, Math.round(top))}px`;
					overlay.style.width = `${Math.max(0, Math.round(rect.width))}px`;
					overlay.style.height = `${Math.max(0, Math.round(rect.height))}px`;
				};

				// Si node es Text, usamos Range para medir su rects
				if (node.nodeType === Node.TEXT_NODE) {
					try {
						const range = document.createRange();
						range.selectNodeContents(node);

						// Range.getClientRects devuelve rects por línea; preferimos unirlos o usar el primero
						const rects = Array.from(range.getClientRects());
						if (rects.length > 0) {
							// Unir rects en bounding rect (mejor cubrir todo el texto multilinea)
							let left = Number.POSITIVE_INFINITY;
							let top = Number.POSITIVE_INFINITY;
							let right = -Number.POSITIVE_INFINITY;
							let bottom = -Number.POSITIVE_INFINITY;
							for (const r of rects) {
								left = Math.min(left, r.left);
								top = Math.min(top, r.top);
								right = Math.max(right, r.left + r.width);
								bottom = Math.max(bottom, r.top + r.height);
							}
							const unionRect = new DOMRect(
								left,
								top,
								right - left,
								bottom - top,
							);
							placeOverlayAt(unionRect);
						} else {
							// Fallback: cubrir todo el parent si no hay rects (texto invisible)
							const pr = parent.getBoundingClientRect();
							placeOverlayAt(pr);
						}
					} catch (e) {
						// Medición falló: fallback a parent completo
						const pr = parent.getBoundingClientRect();
						placeOverlayAt(pr);
					}
				} else if (node.nodeType === Node.ELEMENT_NODE) {
					// Si es elemento, usamos su boundingClientRect
					const elRect = (node as Element).getBoundingClientRect();
					placeOverlayAt(elRect);
				} else {
					// Otros nodos: fallback al parent entero
					const pr = parent.getBoundingClientRect();
					placeOverlayAt(pr);
				}

				// Insertar overlay en parent
				parent.appendChild(overlay);

				// Animación: forzar frame y luego fade out
				requestAnimationFrame(() => {
					overlay.style.opacity = '0';
				});

				// Cuando termine la transición, lo eliminamos
				const onEnd = () => {
					overlay.removeEventListener('transitionend', onEnd);
					if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
				};
				overlay.addEventListener('transitionend', onEnd);

				// cleanup
				return () => {
					overlay.removeEventListener('transitionend', onEnd);
					if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
				};
			};

			// Suscribir
			unsub = s.subscribe((val) => {
				// Limpieza del child actual
				if (currentChild) {
					try {
						currentChild.cleanup();
					} catch (e) {
						console.error('Error cleaning currentChild:', e);
					}
					currentChild = null;
				}

				// Normalizar el nuevo valor y generar fragment para insertar
				const normalized = normalizeChildren(val);
				currentChild = normalized;

				const frag = document.createDocumentFragment();
				normalized.nodes.forEach((n) => frag.appendChild(n));

				replaceRangeWith(frag);

				// Visual overlays (si aplica) — registramos cleanups para remover overlays
				const overlayCleanups: (() => void)[] = [];
				if (__development__ && __show_changes__) {
					normalized.nodes.forEach((n) => {
						const cleanupOverlay = createChangeOverlay(n);
						overlayCleanups.push(cleanupOverlay);
					});
					// Extendemos cleanup para remover overlays cuando el child sea limpiado
					const origCleanup = normalized.cleanup;
					normalized.cleanup = () => {
						try {
							origCleanup();
						} catch (e) {
							console.error('Error in normalized.cleanup:', e);
						}
						overlayCleanups.forEach((fn) => {
							try {
								fn();
							} catch (e) {
								console.error('Error cleaning overlay:', e);
							}
						});
					};
				}

				// Si ya está montado, invocamos onMount inmediatamente (en microtask para seguridad)
				if (isMounted) {
					scheduleMount(() => {
						try {
							normalized.onMount();
						} catch (e) {
							console.error('Error in normalized.onMount:', e);
						}
					});
				}
				// Si es la primera ejecución, añadimos a onMounts (se ejecutará cuando corresponda)
				else if (firstRun) {
					onMounts.push(() => {
						if (currentChild) {
							try {
								currentChild.onMount();
							} catch (e) {
								console.error('Error in deferred onMount:', e);
							}
						}
					});
					firstRun = false;
				}
			});

			// Registro de montaje para esta señal
			onMounts.push(() => {
				isMounted = true;
				if (currentChild) {
					try {
						currentChild.onMount();
					} catch (e) {
						console.error('Error running onMount for currentChild:', e);
					}
				}
			});

			// Registro de limpieza
			cleanUps.push(() => {
				if (currentChild) {
					try {
						currentChild.cleanup();
					} catch (e) {
						console.error('Error cleaning currentChild on parent cleanup:', e);
					}
				}
				if (unsub) {
					try {
						unsub();
					} catch (e) {
						console.error('Error unsubscribing signal:', e);
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
					// Reemplazamos el placeholder con los nodos resueltos
					placeholder.replaceWith(...normalized.nodes);
					// Ejecutamos onMount del resolved
					try {
						normalized.onMount();
					} catch (e) {
						console.error('Error in promise resolved onMount:', e);
					}
					// Aseguramos la limpieza posterior
					cleanUps.push(normalized.cleanup);
				});
				// cleanup possibility if the parent cleanup happens before the promise resolves
				cleanUps.push(() => {
					cancelled = true;
				});
			});
			continue;
		}

		// Función: ejecutarla y procesar el resultado
		if (typeof child === 'function') {
			try {
				const result = (child as () => Child | Promise<Child>)();
				// Si result es Promise, lo dejamos en la cola — normalizeChildren lo manejará
				queue.unshift(result as Child);
			} catch (err) {
				console.error('Error executing child function:', err);
			}
			continue;
		}

		// DocumentFragment: clonarlo para no mutar el original
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
				// Detecta si el nodo o su padre es SVG
				const isSvgNode =
					child.namespaceURI === 'http://www.w3.org/2000/svg' ||
					child.tagName.toLowerCase() === 'svg' ||
					child.parentNode instanceof SVGElement;

				if (isSvgNode) {
					// Clonamos con true para incluir hijos y preservar namespace
					const clonedSvgNode = document.importNode(child, true) as SVGElement;
					nodes.push(clonedSvgNode);
					continue;
				}
			}

			// Nodo HTML normal o no-SVG
			nodes.push(child);
			continue;
		}

		// Valores primitivos: crear TextNode
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
			// ejecuta onMounts en orden, protegido por try/catch
			for (const fn of onMounts) {
				try {
					fn();
				} catch (e) {
					console.error('Error in onMount handler:', e);
				}
			}
		},
		cleanup: () => {
			// ejecutar cleanups en orden inverso por seguridad (simular stack-unwinding)
			for (let i = cleanUps.length - 1; i >= 0; i--) {
				try {
					cleanUps[i]();
				} catch (e) {
					console.error('Error in cleanup handler:', e);
				}
			}
		},
	};
}
