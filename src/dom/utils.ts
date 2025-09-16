import { isSignal, type ReactiveSignal } from '@core/reactive';
// `isSignal`: función para verificar si un valor es una señal reactiva.
// `ReactiveSignal`: tipo que representa una señal reactiva.

import {
	isBoxelsElement, // Verifica si un nodo es un componente personalizado del sistema (BoxelsElement).
	type BoxelsElement, // Tipo base de un componente Boxels.
	type BoxelsElementNode, // Nodo específico que extiende de un elemento HTML con propiedades Boxels.
} from './attributes/elements';

import { $, Fragment, onDestroy, type BoxelsElementSelector } from '.';
// `$`: función auxiliar para crear elementos reactivos.
// `Fragment`: tipo especial que representa un contenedor de nodos sin un elemento padre real.

import {
	handleAttributes, // Maneja atributos personalizados y de ciclo de vida en elementos.
	removeAttributes, // Elimina atributos previamente aplicados.
} from './attributes';
import { debug } from '@testing/debugger';

export type Placeholder = HTMLDivElement | null;

let placeholderContainer: Placeholder = null;

/**
 * Obtiene o crea un contenedor oculto para placeholders
 */
function getPlaceholderContainer() {
	if (!placeholderContainer) {
		placeholderContainer = document.createElement('div');
		placeholderContainer.style.position = 'absolute';
		placeholderContainer.style.top = '0';
		placeholderContainer.style.left = '0';
		placeholderContainer.style.width = '0';
		placeholderContainer.style.height = '0';
		placeholderContainer.style.overflow = 'visible'; // permite que los placeholders se posicionen fuera
		placeholderContainer.style.pointerEvents = 'none';
		document.body.appendChild(placeholderContainer);
	}
	return placeholderContainer;
}

/**
 * Opciones de creación de placeholder
 */
interface PlaceholderOptions {
	/** Estilos extra aplicados directamente */
	styles?: Partial<CSSStyleDeclaration>;
	/** Posición absoluta (independiente de un elemento) */
	position?: Position;
	/** Elemento al que se atacha */
	attachTo?: string | HTMLElement;
	/** Si copiar ancho/alto del elemento atachado */
	matchSize?: boolean;
}

type Position =
	| 'top-left'
	| 'top-center'
	| 'top-right'
	| 'left-center'
	| 'right-center'
	| 'bottom-left'
	| 'bottom-center'
	| 'bottom-right'
	| 'center'
	| { top: number; left: number }; // porcentajes 0–100

interface PlaceholderOptions {
	styles?: Partial<CSSStyleDeclaration>;
	position?: Position;
	attachTo?: string | HTMLElement;
	matchSize?: boolean;
}

/**
 * Crea un placeholder flexible
 */
export function createPlaceholder(
	options: PlaceholderOptions = {},
): HTMLDivElement {
	const ph = document.createElement('div');
	ph.style.position = 'absolute';
	ph.style.pointerEvents = 'none';
	ph.style.opacity = '0';
	ph.style.zIndex = '9999';

	if (options.styles) Object.assign(ph.style, options.styles);

	getPlaceholderContainer().appendChild(ph);

	const element =
		typeof options.attachTo === 'string'
			? document.querySelector(options.attachTo)
			: options.attachTo;

	const update = () => {
		if (element) {
			// Si está atachado a un elemento
			const rect = element.getBoundingClientRect();
			ph.style.top = `${rect.top + window.scrollY}px`;
			ph.style.left = `${rect.left + window.scrollX}px`;

			if (options.matchSize) {
				ph.style.width = `${rect.width}px`;
				ph.style.height = `${rect.height}px`;
			}
		} else if (options.position) {
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			const phRect = ph.getBoundingClientRect();

			if (typeof options.position === 'string') {
				switch (options.position) {
					case 'top-left':
						ph.style.top = '0px';
						ph.style.left = '0px';
						break;
					case 'top-center':
						ph.style.top = '0px';
						ph.style.left = `${vw / 2 - phRect.width / 2}px`;
						break;
					case 'top-right':
						ph.style.top = '0px';
						ph.style.left = `${vw - phRect.width}px`;
						break;
					case 'left-center':
						ph.style.top = `${vh / 2 - phRect.height / 2}px`;
						ph.style.left = '0px';
						break;
					case 'right-center':
						ph.style.top = `${vh / 2 - phRect.height / 2}px`;
						ph.style.left = `${vw - phRect.width}px`;
						break;
					case 'bottom-left':
						ph.style.top = `${vh - phRect.height}px`;
						ph.style.left = '0px';
						break;
					case 'bottom-center':
						ph.style.top = `${vh - phRect.height}px`;
						ph.style.left = `${vw / 2 - phRect.width / 2}px`;
						break;
					case 'bottom-right':
						ph.style.top = `${vh - phRect.height}px`;
						ph.style.left = `${vw - phRect.width}px`;
						break;
					case 'center':
						ph.style.top = `${vh / 2 - phRect.height / 2}px`;
						ph.style.left = `${vw / 2 - phRect.width / 2}px`;
						break;
				}
			} else {
				// Números => porcentaje
				const { top, left } = options.position;
				ph.style.top = `${(vh * top) / 100 - phRect.height / 2}px`;
				ph.style.left = `${(vw * left) / 100 - phRect.width / 2}px`;
			}
		}
	};

	// Inicializamos posición
	requestAnimationFrame(update);

	// Escuchar cambios si está atachado
	if (element) {
		window.addEventListener('resize', update);
		window.addEventListener('scroll', update);
	}

	// Limpiar al destruir
	onDestroy(() => {
		if (element) {
			window.removeEventListener('resize', update);
			window.removeEventListener('scroll', update);
		}
		ph.remove();

		if (placeholderContainer?.childElementCount === 0) {
			placeholderContainer.remove();
			placeholderContainer = null;
		}
	});

	return ph;
}


export function uniqueId(name?: string): string {
	// número aleatorio en base36 de 4 caracteres
	const rand = Math.random().toString(36).slice(2, 10);
	// timestamp en base36 para acortar
	const time = Date.now().toString(36);
	return `${name}${rand}${time}`;
}

export function parseHTML(html: string): Node | HTMLElement {
	// Caso documento completo
	if (html.includes('<html')) {
		const doc = new DOMParser().parseFromString(html, 'text/html');
		return renderFromNodes(doc.body.childNodes);
	}

	// Caso fragmento o elemento
	const tpl = document.createElement('template');
	tpl.innerHTML = html.trim();
	return renderFromNodes(tpl.content.childNodes);
}

function renderFromNodes(nodes: NodeList | ChildNode[]): Node | HTMLElement {
	const arr = Array.from(nodes);

	// Si hay un solo nodo, lo renderizamos directo con $
	if (arr.length === 1) {
		const node = arr[0];
		if (node.nodeType === Node.TEXT_NODE) {
			return document.createTextNode(node.textContent || '');
		}
		return $(
			mapTag(node) as BoxelsElementSelector<keyof HTMLElementTagNameMap>,
			mapAttrs(node),
			...mapChildren(node),
		);
	}

	// Si hay múltiples nodos → devolvemos un Fragment
	return $(
		Fragment,
		{},
		arr.map((n) => {
			if (n.nodeType === Node.TEXT_NODE) {
				return n.textContent || '';
			}
			return $(
				mapTag(n) as BoxelsElementSelector<keyof HTMLElementTagNameMap>,
				mapAttrs(n),
				...mapChildren(n),
			);
		}),
	);
}

function mapTag(node: Node): string {
	return (node as HTMLElement).tagName?.toLowerCase() || 'div';
}

function mapAttrs(node: Node): Record<string, any> {
	if (!(node instanceof HTMLElement)) return {};
	const attrs: Record<string, any> = {};
	for (const { name, value } of Array.from(node.attributes)) {
		attrs[name] = value;
	}
	return attrs;
}

function mapChildren(node: Node): any[] {
	return Array.from(node.childNodes).map((child) => {
		if (child.nodeType === Node.TEXT_NODE) {
			return child.textContent || '';
		}
		return $(
			mapTag(child) as BoxelsElementSelector<keyof HTMLElementTagNameMap>,
			mapAttrs(child),
			...mapChildren(child),
		);
	});
}

type CSSProperties = Partial<
	Record<keyof CSSStyleDeclaration, string | number>
>;

export function injectStyle(
	css: string | Record<string, CSSProperties>,
	id?: string,
): HTMLStyleElement {
	let style: HTMLStyleElement | null = null;

	// Evitar duplicados por id
	if (id) {
		style = document.getElementById(id) as HTMLStyleElement | null;
	}

	if (!style) {
		style = document.createElement('style');
		if (id) style.id = id;
		document.head.appendChild(style);
	}

	// Si es un objeto, convertir a CSS string
	if (typeof css === 'object') {
		const lines: string[] = [];
		for (const selector in css) {
			const props = css[selector];
			const propLines = Object.entries(props)
				.map(([key, value]) => {
					// convertir camelCase a kebab-case
					const kebabKey = key.replace(
						/[A-Z]/g,
						(match) => '-' + match.toLowerCase(),
					);
					return `  ${kebabKey}: ${value};`;
				})
				.join('\n');
			lines.push(`${selector} {\n${propLines}\n}`);
		}
		style.textContent = lines.join('\n');
	} else {
		// si es string, usar tal cual
		style.textContent = css;
	}

	return style;
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
export const mount = (
	parent: HTMLElement | DocumentFragment,
	...children: JSX.Element[]
) => {
	children.forEach(async (child) => {
		// Insertar hijo en el contenedor
		appendChild(parent, await (typeof child === 'function' ? child() : child));
	});
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
export const unmount = (...children: JSX.Element[]) => {
	children.forEach((child) => {
		if (isBoxelsElement(child)) {
			// Solo destruir si estaba montado
			if (child.__mounted) {
				child.destroy();
			}
		} else {
			// Eliminar nodo DOM estándar
			(child as ChildNode).remove();
		}
	});
};

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

/**
 * Inserta un hijo dentro de un contenedor (padre).
 * Gestiona casos especiales como:
 * - Comentarios (se inserta antes de ellos).
 * - SVG (se conserva el namespace adecuado).
 * - BoxelsElement (se monta en lugar de hacer append directo).
 * - Signals (se envuelven en un Fragment para reactividad).
 * - DocumentFragment (se fusionan o anidan).
 * - Promesas (se insertan diferidas con marcador temporal).
 * - Valores primitivos (se convierten en nodos de texto).
 *
 * @param parent - Nodo padre donde insertar
 * @param child - Contenido a insertar
 * @param position - Posición relativa: 'before', 'after' o 'last' (por defecto)
 */
export function appendChild(
	parent: HTMLElement | DocumentFragment | Comment | BoxelsElement | SVGElement,
	child: any,
	position: 'before' | 'after' | 'last' = 'last',
) {
	// Helper para normalizar el hijo a Node
	const normalizeChild = (value: any) =>
		value instanceof Node ? value : document.createTextNode(String(value));

	// ---------------------------------------------------------------------
	// Caso: padre es SVG → mantener namespace
	// ---------------------------------------------------------------------
	if (parent instanceof SVGElement) {
		insertNode(parent, normalizeChild(child), position);
		return;
	}

	// ---------------------------------------------------------------------
	// Caso: padre es un comentario → insertar ANTES o DESPUÉS según position
	// ---------------------------------------------------------------------
	if (parent instanceof Comment) {
		const refNode = position === 'before' ? parent : parent.nextSibling;
		parent.parentNode?.insertBefore(normalizeChild(child), refNode);
		return;
	}

	// ---------------------------------------------------------------------
	// Caso: hijo es un componente BoxelsElement
	// ---------------------------------------------------------------------
	if (isBoxelsElement(child)) {
		if (!child.__mounted && !child.__destroyed) {
			child.mount(parent as HTMLElement);
		} else {
			insertNode(parent, child, position);
		}
		return;
	}

	// ---------------------------------------------------------------------
	// Caso: hijo es una señal reactiva → envolver en Fragment
	// ---------------------------------------------------------------------
	if (isSignal(child)) {
		appendChild(
			parent,
			$(Fragment, {}, child as ReactiveSignal<any>),
			position,
		);
		return;
	}

	// ---------------------------------------------------------------------
	// Caso: hijo es Promesa → insertar marcador temporal
	// ---------------------------------------------------------------------
	if (child instanceof Promise) {
		const marker = document.createComment(
			debug.isShowCommentNames() ? 'promise:placeholder' : '',
		);
		appendChild(parent, marker, position);

		(async () => {
			const resolved = await child;
			appendChild(marker, resolved);
			marker.remove();
		})();
		return;
	}

	// ---------------------------------------------------------------------
	// Caso: DocumentFragment (fusión o inserción)
	// ---------------------------------------------------------------------
	if (parent instanceof DocumentFragment && child instanceof DocumentFragment) {
		insertNode(parent, child, position);
		return;
	}

	if (child instanceof DocumentFragment) {
		const children = Array.from(child.childNodes);
		children.forEach((n) => insertNode(parent, n, position));
		return;
	}

	// ---------------------------------------------------------------------
	// Caso general: HTMLElement / DocumentFragment
	// ---------------------------------------------------------------------
	insertNode(parent, normalizeChild(child), position);
}

/**
 * Inserta un nodo en una posición específica.
 * @param parent Nodo padre
 * @param node Nodo a insertar
 * @param position 'before', 'after', 'last'
 */
function insertNode(
	parent: HTMLElement | DocumentFragment | SVGElement,
	node: Node,
	position: 'before' | 'after' | 'last',
) {
	if (position === 'last') {
		parent.appendChild(node);
		return;
	}

	const refNode =
		position === 'before'
			? parent.firstChild
			: parent.lastChild?.nextSibling || null;

	if (refNode) {
		parent.insertBefore(node, refNode);
	} else {
		parent.appendChild(node);
	}
}

/**
 * Asigna atributos a un elemento HTML usando el sistema de Boxels.
 *
 * @param element - Elemento DOM objetivo.
 * @param props - Atributos a aplicar (incluye atributos de ciclo de vida).
 *
 * Retorna una función de limpieza que ejecuta `$lifecycle:destroy` si existe.
 */
export const setAttribute = <T extends keyof HTMLElementTagNameMap>(
	element: HTMLElementTagNameMap[T] | HTMLElement,
	props: BoxelsElementAttributes<T>,
) => {
	const result = handleAttributes(element, props);
	// Ejecutar hook de montaje si existe
	result['$lifecycle:mount']?.(element as BoxelsElementNode<T>);
	// Retornar función para desmontaje
	return () => result['$lifecycle:destroy']?.(element as BoxelsElementNode<T>);
};

/**
 * Elimina atributos previamente aplicados en un elemento.
 *
 * @param element - Elemento HTML objetivo.
 * @param props - Atributos a eliminar.
 */
export const removeAttribute = <T extends keyof HTMLElementTagNameMap>(
	element: HTMLElementTagNameMap[T] | HTMLElement,
	props: BoxelsElementAttributes<T>,
) => removeAttributes(element, props);

/**
 * Reemplaza un nodo `target` en el DOM por otro hijo.
 * Maneja casos similares a `appendChild`, pero destruyendo/limpiando el nodo previo.
 */
export function replaceElement(
	target: HTMLElement | DocumentFragment | Comment | BoxelsElement | SVGElement,
	child: any,
) {
	const parent = target.parentNode;
	if (!parent) return; // No hay contenedor → nada que hacer

	// Caso: target es un comentario
	if (target instanceof Comment) {
		parent.insertBefore(
			child instanceof Node ? child : document.createTextNode(String(child)),
			target,
		);
		target.remove();
		return;
	}

	// Caso: target dentro de SVG
	if (parent instanceof SVGElement) {
		if (child instanceof Node) {
			parent.replaceChild(child, target);
		} else {
			parent.replaceChild(document.createTextNode(String(child)), target);
		}
		return;
	}

	// Caso: hijo es BoxelsElement
	if (isBoxelsElement(child)) {
		if (!child.__mounted && !child.__destroyed) {
			// Montar el nuevo elemento
			child.mount(parent as HTMLElement);

			// Destruir target previo según su tipo
			if (isBoxelsElement(target)) {
				target.destroy();
			} else if (target instanceof DocumentFragment) {
				while (target.firstChild) target.removeChild(target.firstChild);
			} else {
				target.remove();
			}
		} else {
			// Ya está montado → solo reemplazar
			parent.replaceChild(child as unknown as Node, target);
		}
		return;
	}

	// Caso: hijo es una señal → transformar a Fragment reactivo
	if (isSignal(child)) {
		replaceElement(target, $(Fragment, {}, child as ReactiveSignal<any>));
		return;
	}

	// Caso: reemplazo de Fragment con otro Fragment
	if (target instanceof DocumentFragment && child instanceof DocumentFragment) {
		parent.insertBefore(child, target);
		// Limpiar target previo
		if (isBoxelsElement(target)) {
			target.destroy();
		} else if (target instanceof DocumentFragment) {
			while (target.firstChild) target.removeChild(target.firstChild);
		} else {
			(target as HTMLElement).remove();
		}
		parent.insertBefore(child, target);
		return;
	}

	// Caso: target es Fragment y el hijo es un Node
	if (
		target instanceof DocumentFragment &&
		child instanceof DocumentFragment === false
	) {
		parent.insertBefore(
			child instanceof Node ? child : document.createTextNode(String(child)),
			target,
		);
		// Limpiar target
		if (isBoxelsElement(target)) {
			target.destroy();
		} else if (target instanceof DocumentFragment) {
			while (target.firstChild) target.removeChild(target.firstChild);
		} else {
			(target as HTMLElement).remove();
		}
		return;
	}

	// Caso: hijo es una Promesa → render diferido
	if (child instanceof Promise) {
		const comment = document.createComment(
			debug.isShowCommentNames() ? 'promise:placeholder' : '',
		);
		parent.replaceChild(comment, target);

		(async () => {
			const result = await child;
			// Limpiar el target después de resolver
			if (isBoxelsElement(target)) {
				target.destroy();
			} else if (target instanceof DocumentFragment) {
				while (target.firstChild) target.removeChild(target.firstChild);
			} else {
				(target as HTMLElement).remove();
			}
		})();
		return;
	}

	// Caso general → reemplazo directo
	parent.replaceChild(
		child instanceof Node ? child : document.createTextNode(String(child)),
		target,
	);
}

/**
 * Inserta un hijo en el `parent` en una posición específica (índice).
 *
 * @param parent - Contenedor donde insertar (HTMLElement, Fragment, SVG, etc).
 * @param child - Nodo o valor a insertar.
 * @param index - Posición en la lista de hijos. Si es mayor al número de hijos, se inserta al final.
 *
 * Casos especiales manejados (igual que `appendChild`):
 * - Comentarios → inserción antes del comentario.
 * - BoxelsElement → se monta.
 * - Signals → se envuelven en un Fragment.
 * - Promesas → render diferido con marcador.
 * - DocumentFragment → fusión o inserción.
 * - Texto/valores primitivos → se convierten en TextNode.
 */
export function insertChildAt(
	parent: HTMLElement | DocumentFragment | Comment | BoxelsElement | SVGElement,
	child: any,
	index: number,
) {
	// Si el padre es un comentario → insertar antes del comentario
	if (parent instanceof Comment) {
		parent.parentNode?.insertBefore(
			child instanceof Node ? child : document.createTextNode(String(child)),
			parent,
		);
		return;
	}

	// Normalizar index
	const targetNode = (parent as ParentNode).childNodes[index] ?? null;

	// Caso: BoxelsElement
	if (isBoxelsElement(child)) {
		if (!child.__mounted && !child.__destroyed) {
			child.mount(parent as HTMLElement);
		}
		if (targetNode) {
			(parent as ParentNode).insertBefore(child as unknown as Node, targetNode);
		} else {
			(parent as ParentNode).appendChild(child as unknown as Node);
		}
		return;
	}

	// Caso: Signal
	if (isSignal(child)) {
		insertChildAt(parent, $(Fragment, {}, child as ReactiveSignal<any>), index);
		return;
	}

	// Caso: Promesa → marcador temporal
	if (child instanceof Promise) {
		const marker = document.createComment(
			debug.isShowCommentNames() ? 'promise:placeholder' : '',
		);
		insertChildAt(parent, marker, index);

		(async () => {
			const resolved = await child;
			insertChildAt(
				parent,
				resolved,
				Array.from((parent as ParentNode).childNodes).indexOf(marker),
			);
			marker.remove();
		})();
		return;
	}

	// Caso: DocumentFragment
	if (child instanceof DocumentFragment) {
		if (targetNode) {
			(parent as ParentNode).insertBefore(child, targetNode);
		} else {
			(parent as ParentNode).appendChild(child);
		}
		return;
	}

	// Caso: SVG
	if (parent instanceof SVGElement) {
		if (targetNode) {
			parent.insertBefore(
				child instanceof Node ? child : document.createTextNode(String(child)),
				targetNode,
			);
		} else {
			parent.appendChild(
				child instanceof Node ? child : document.createTextNode(String(child)),
			);
		}
		return;
	}

	// Caso general
	if (targetNode) {
		(parent as ParentNode).insertBefore(
			child instanceof Node ? child : document.createTextNode(String(child)),
			targetNode,
		);
	} else {
		(parent as ParentNode).appendChild(
			child instanceof Node ? child : document.createTextNode(String(child)),
		);
	}
}
