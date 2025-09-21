export function parseHTML(html: string): Node | DocumentFragment {
    // Caso documento completo
    if (html.includes('<html')) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body;
    }

    // Caso fragmento o elemento
    const tpl = document.createElement('template');
    tpl.innerHTML = html.trim();

    // Si hay un solo nodo → devolverlo directo
    if (tpl.content.childNodes.length === 1) {
        return tpl.content.firstChild as Node;
    }

    // Si hay múltiples nodos → devolver un DocumentFragment
    return tpl.content.cloneNode(true) as DocumentFragment;
}
