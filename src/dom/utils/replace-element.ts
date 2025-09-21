import { isSignal, type Signal } from "@core/index";
import { isBoxelsElement, type BoxelsElement } from "@dom/attributes/elements";
import { debug } from "@testing/debugger";

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