import { __development__, __show_changes__ } from '../../../environment';

/* -------------------------
   Utilidades internas
   ------------------------- */

/**
 * Bandera interna para asegurarnos de inyectar estilos CSS solo una vez.
 */
let __styleInjected = false;

/**
 * Inyecta en el `<head>` la hoja de estilos necesaria
 * para los overlays de cambio visual.
 *
 * - Solo se ejecuta en entorno de desarrollo.
 * - Solo se ejecuta si la opción `__show_changes__` está activa.
 * - Garantiza inyección única (no duplica estilos).
 */
export function ensureChangeStyles() {
	if (!__development__ || !__show_changes__ || __styleInjected) return;
	__styleInjected = true;

	// CSS que define estilos básicos para overlays y wrappers
	const css = `
.______change-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    transition: opacity 380ms ease-out;
    background: rgba(30, 167, 87, 0.28); 
    opacity: 1;
    z-index: 9999;
}
.______change-wrapper {
    position: relative;
}
`;

	// Crear elemento <style> y añadirlo al head
	const el = document.createElement('style');
	el.setAttribute('data-boxels-changes', 'true');
	el.textContent = css;
	document.head.appendChild(el);
}

/* -------------------------
   Helpers de posicionamiento
   ------------------------- */

/**
 * Garantiza que el contenedor padre tenga posicionamiento relativo.
 *
 * - Si ya tiene `relative`, `absolute`, `fixed` o `sticky` → no hace nada.
 * - Si no, añade una clase (`______change-wrapper`) con `position: relative`.
 *
 * @param parent Elemento padre a verificar.
 * @returns El nombre de la clase añadida o `null` si no fue necesario.
 */
export function ensureRelativeContainer(parent: HTMLElement): string | null {
	const computed = getComputedStyle(parent);

	// Verificar si ya tiene posicionamiento válido
	if (
		!['relative', 'absolute', 'fixed', 'sticky'].includes(computed.position)
	) {
		parent.classList.add('______change-wrapper');
		return '______change-wrapper';
	}
	return null;
}

/* -------------------------
   Creación de overlays
   ------------------------- */

/**
 * Crea un overlay visual (resaltado verde translúcido) sobre el nodo indicado,
 * con animación de aparición y desaparición automática.
 *
 * - Se usa para depurar cambios en el DOM.
 * - Funciona tanto con nodos de texto como con elementos HTML.
 *
 * @param node Nodo (texto o elemento) a resaltar.
 * @returns Una función de cleanup para eliminar el overlay manualmente.
 */
export function createChangeOverlay(node: Node): () => void {
	// Solo habilitado en desarrollo y si se activa la flag
	if (!__development__ || !__show_changes__) return () => {};

	// Determinar el parent donde se insertará el overlay
	const parent = (
		node.nodeType === Node.ELEMENT_NODE
			? (node as Element).parentElement
			: node.parentElement
	) as HTMLElement | null;
	if (!parent) return () => {};

	// Inyectar CSS base (si no estaba ya)
	ensureChangeStyles();

	// Garantizar que el parent tenga posicionamiento relativo
	ensureRelativeContainer(parent);

	// Crear el overlay
	const overlay = document.createElement('div');
	overlay.className = '______change-overlay';
	overlay.style.opacity = '1';
	overlay.style.position = 'absolute';
	overlay.style.pointerEvents = 'none';

	/**
	 * Helper: ubica el overlay en el espacio relativo al parent.
	 */
	const placeOverlayAt = (rect: DOMRect) => {
		const parentRect = parent.getBoundingClientRect();
		const left = rect.left - parentRect.left;
		const top = rect.top - parentRect.top;
		overlay.style.left = `${Math.max(0, Math.round(left))}px`;
		overlay.style.top = `${Math.max(0, Math.round(top))}px`;
		overlay.style.width = `${Math.max(0, Math.round(rect.width))}px`;
		overlay.style.height = `${Math.max(0, Math.round(rect.height))}px`;
	};

	/* -------------------------
	   Calcular posición del overlay
	   ------------------------- */

	if (node.nodeType === Node.TEXT_NODE) {
		// Caso: nodo de texto → medimos con Range
		try {
			const range = document.createRange();
			range.selectNodeContents(node);

			const rects = Array.from(range.getClientRects());
			if (rects.length > 0) {
				// Unir todos los rects en uno solo (texto multilínea)
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

				const unionRect = new DOMRect(left, top, right - left, bottom - top);
				placeOverlayAt(unionRect);
			} else {
				// Fallback: cubrir todo el parent si no hay rects (texto invisible)
				const pr = parent.getBoundingClientRect();
				placeOverlayAt(pr);
			}
		} catch (e) {
			// Si la medición falla, fallback al parent completo
			const pr = parent.getBoundingClientRect();
			placeOverlayAt(pr);
		}
	} else if (node.nodeType === Node.ELEMENT_NODE) {
		// Caso: elemento → usamos su boundingClientRect
		const elRect = (node as Element).getBoundingClientRect();
		placeOverlayAt(elRect);
	} else {
		// Otros tipos de nodo → fallback al parent completo
		const pr = parent.getBoundingClientRect();
		placeOverlayAt(pr);
	}

	/* -------------------------
	   Insertar y animar overlay
	   ------------------------- */

	// Añadir overlay al DOM
	parent.appendChild(overlay);

	// Forzar un frame y luego iniciar fade out
	requestAnimationFrame(() => {
		overlay.style.opacity = '0';
	});

	// Eliminar overlay al terminar transición
	const onEnd = () => {
		overlay.removeEventListener('transitionend', onEnd);
		if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
	};
	overlay.addEventListener('transitionend', onEnd);

	/* -------------------------
	   Cleanup manual
	   ------------------------- */
	return () => {
		overlay.removeEventListener('transitionend', onEnd);
		if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
	};
}
