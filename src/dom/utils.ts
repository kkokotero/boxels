import { isSignal, type ReactiveSignal } from '@core/reactive';
import {
	isBoxelsElement,
	type BoxelsElement,
	type BoxelsElementNode,
} from './attributes/elements';
import { $, Fragment } from '.';
import {
	handleAttributes,
	removeAttributes,
} from './attributes';

/**
 * Monta (agrega) uno o varios elementos JSX a un contenedor en el DOM.
 *
 * @param parent - Un nodo del DOM donde se insertarán los hijos. Puede ser un HTMLElement
 *                 (como un <div>, <section>, etc.) o un DocumentFragment.
 * @param children - Uno o más elementos JSX que se desean insertar dentro del contenedor.
 *
 * Este método se utiliza para montar componentes o nodos dentro del DOM de forma explícita.
 * Si alguno de los hijos es una Promesa (por ejemplo, un componente que se carga de forma
 * asíncrona), se espera a su resolución antes de insertarlo.
 *
 * Internamente, se delega la inserción en la función `appendChild`, que se encarga de
 * manejar tanto nodos DOM tradicionales como componentes personalizados del sistema.
 *
 * Ejemplo de uso:
 *   const contenedor = document.getElementById('app');
 *   const componente = <MiComponente />;
 *   mount(contenedor, componente);
 */
export const mount = (
	parent: HTMLElement | DocumentFragment,
	...children: JSX.Element[]
) => {
	children.forEach(async (child) => {
		// Si el hijo es una Promesa, se espera su resolución antes de insertarlo
		const resolved = child instanceof Promise ? await child : child;
		// Inserta el elemento (resuelto o no) en el contenedor
		appendChild(parent, resolved);
	});
};

/**
 * Desmonta (elimina) uno o varios elementos JSX del DOM.
 *
 * @param children - Uno o más elementos JSX que se desean eliminar del DOM.
 *
 * Esta función sirve para eliminar componentes o nodos del árbol DOM de forma segura,
 * considerando si el elemento es un componente personalizado con lógica de limpieza
 * (como suscripciones, efectos, etc.), o un nodo DOM estándar.
 *
 * - Si el elemento es un "BoxelsElement" (componente personalizado):
 *   - Se verifica si está montado (`__mounted` es verdadero).
 *   - Si lo está, se llama a su método `destroy()` para ejecutar limpieza interna.
 *
 * - Si el elemento es un nodo DOM común (no personalizado), simplemente se elimina
 *   mediante `remove()`.
 *
 * La verificación con `isBoxelsElement` permite distinguir entre componentes del sistema
 * (que pueden tener ciclo de vida) y nodos normales del DOM.
 */
export const unmount = (...children: JSX.Element[]) => {
	children.forEach((child) => {
		// Si el elemento es un componente del sistema (con lógica de desmontaje)
		if (isBoxelsElement(child)) {
			// Verifica que esté montado antes de destruirlo para evitar errores o dobles llamadas
			if (child.__mounted) {
				child.destroy(); // Ejecuta limpieza interna (efectos, listeners, etc.)
			}
		} else {
			// Nodo DOM nativo: se elimina directamente del DOM
			(child as ChildNode).remove();
		}
	});
};

/**
 * Interfaz base para un componente del sistema.
 *
 * Cualquier componente que implemente esta interfaz debe definir un método `render()`,
 * que retorna un nodo JSX. Este nodo será lo que se monta en el DOM.
 *
 * @example
 *   class MiComponente implements Component {
 *     render() {
 *       return <div>Hola mundo</div>;
 *     }
 *   }
 */
export interface Component {
	render: () => JSX.Element;
}


export function appendChild(
	parent: HTMLElement | DocumentFragment | Comment | BoxelsElement | SVGElement,
	child: any,
) {
	// Caso: el padre es un comentario → insertar antes del comentario
	if (parent instanceof Comment) {
		parent.parentNode?.insertBefore(
			child instanceof Node ? child : document.createTextNode(String(child)),
			parent,
		);
		return;
	}

	// Caso: SVG → mantener namespace
	if (parent instanceof SVGElement) {
		if (child instanceof Node) {
			parent.appendChild(child);
		} else {
			parent.appendChild(document.createTextNode(String(child)));
		}
		return;
	}

	// Si es un BoxelsElement
	if (isBoxelsElement(child)) {
		if (!child.__mounted && !child.__destroyed) child.mount(parent);
		return;
	}

	// Si es un signal → convertir a fragment para manejarlo de forma reactiva
	if (isSignal(child)) {
		appendChild(parent, $(Fragment, {}, child as ReactiveSignal<any>));
		return;
	}

	// Caso especial: ambos son Fragment → fusionar nodos
	if (parent instanceof DocumentFragment && child instanceof DocumentFragment) {
		parent.append(...child.childNodes);
		return;
	}

	// Caso: padre es Fragment y el hijo es un Node normal
	if (
		parent instanceof DocumentFragment &&
		child instanceof DocumentFragment === false
	) {
		parent.appendChild(
			child instanceof Node ? child : document.createTextNode(String(child)),
		);
		return;
	}

	// Promesa → render diferido
	if (child instanceof Promise) {
		const comment = document.createComment('');
		parent.appendChild(comment);

		(async () => {
			const result = await child;
			appendChild(comment, result);
			comment.remove();
		})();
		return;
	}

	// Fallback normal
	parent.appendChild(
		child instanceof Node ? child : document.createTextNode(String(child)),
	);
}

export const setAttribute = <T extends keyof HTMLElementTagNameMap>(
	element: HTMLElementTagNameMap[T] | HTMLElement,
	props: BoxelsElementAttributes<T>,
) => {
	const result = handleAttributes(element, props);
	result['$lifecycle:mount']?.(element as BoxelsElementNode<T>);
	return () => result['$lifecycle:destroy']?.(element as BoxelsElementNode<T>);
};

export const removeAttribute = <T extends keyof HTMLElementTagNameMap>(
	element: HTMLElementTagNameMap[T] | HTMLElement,
	props: BoxelsElementAttributes<T>,
) => removeAttributes(element, props);

export function replaceElement(
	target: HTMLElement | DocumentFragment | Comment | BoxelsElement | SVGElement,
	child: any,
) {
	const parent = target.parentNode;
	if (!parent) return; // No hay dónde reemplazar

	// Caso: el objetivo es un comentario
	if (target instanceof Comment) {
		parent.insertBefore(
			child instanceof Node ? child : document.createTextNode(String(child)),
			target,
		);
		target.remove();
		return;
	}

	// Caso: SVG → mantener namespace
	if (parent instanceof SVGElement) {
		if (child instanceof Node) {
			parent.replaceChild(child, target);
		} else {
			parent.replaceChild(document.createTextNode(String(child)), target);
		}
		return;
	}

	// Si es un BoxelsElement
	if (isBoxelsElement(child)) {
		if (!child.__mounted && !child.__destroyed) {
			child.mount(parent as HTMLElement);
			if (isBoxelsElement(target)) {
				target.destroy();
			} else if (target instanceof DocumentFragment) {
				while (target.firstChild) target.removeChild(target.firstChild);
			} else {
				target.remove();
			}
		} else {
			parent.replaceChild(child as unknown as Node, target);
		}
		return;
	}

	// Si es un signal → render reactivo
	if (isSignal(child)) {
		replaceElement(target, $(Fragment, {}, child as ReactiveSignal<any>));
		return;
	}

	// Caso: ambos son Fragment → fusionar nodos
	if (target instanceof DocumentFragment && child instanceof DocumentFragment) {
		// Reemplazar el fragment entero por los nodos del nuevo fragment
		parent.insertBefore(child, target);
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

	// Caso: target es Fragment y el hijo es un Node normal
	if (
		target instanceof DocumentFragment &&
		child instanceof DocumentFragment === false
	) {
		parent.insertBefore(
			child instanceof Node ? child : document.createTextNode(String(child)),
			target,
		);
		if (isBoxelsElement(target)) {
			target.destroy();
		} else if (target instanceof DocumentFragment) {
			while (target.firstChild) target.removeChild(target.firstChild);
		} else {
			(target as HTMLElement).remove();
		}
		return;
	}

	// Promesa → render diferido
	if (child instanceof Promise) {
		const comment = document.createComment('');
		parent.replaceChild(comment, target);

		(async () => {
			const result = await child;
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

	// Fallback normal
	parent.replaceChild(
		child instanceof Node ? child : document.createTextNode(String(child)),
		target,
	);
}
