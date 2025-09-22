import type { BoxelsElement } from "@dom/elements/types";
import { debug } from "@testing/debugger";
import { isBoxelsElement } from "./element";

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
