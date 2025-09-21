import { isSignal } from "@core/index";
import { isBoxelsElement, type BoxelsElement, type Child } from "@dom/attributes/elements";
import { debug } from "@testing/debugger";

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
    child: Child,
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