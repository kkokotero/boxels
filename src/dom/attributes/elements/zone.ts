import { debug } from '@testing/debugger';

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
	if (!debug.isShowChanges() || __styleInjected) return;
	__styleInjected = true;

	const css = `
.______change-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    transition: opacity 380ms ease-out;
    opacity: 1;
    z-index: 9999;
}
.______change-wrapper {
    position: relative;
}
`;
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
	if (!['relative', 'absolute', 'fixed', 'sticky'].includes(computed.position)) {
		parent.classList.add('______change-wrapper');
		return '______change-wrapper';
	}
	return null;
}

/* -------------------------
   Colores para overlays
   ------------------------- */
const overlayColors = [
    'rgba(30, 167, 87, 0.28)',    // verde
    'rgba(255, 99, 71, 0.28)',    // rojo tomate
    'rgba(54, 162, 235, 0.28)',   // azul
    'rgba(255, 206, 86, 0.28)',   // amarillo
    'rgba(153, 102, 255, 0.28)',  // morado
    'rgba(255, 159, 64, 0.28)',   // naranja
    'rgba(75, 192, 192, 0.28)',   // turquesa
    'rgba(199, 199, 199, 0.28)',  // gris
    'rgba(255, 99, 255, 0.28)',   // rosa fuerte
    'rgba(0, 128, 128, 0.28)',    // verde azulado
    'rgba(255, 215, 0, 0.28)',    // dorado
    'rgba(138, 43, 226, 0.28)',   // azul violeta
    'rgba(255, 105, 180, 0.28)',  // hot pink
    'rgba(0, 191, 255, 0.28)',    // deep sky blue
    'rgba(60, 179, 113, 0.28)',   // medium sea green
];


let overlayIndex = 0;
function getOverlayColor(): string {
	const color = overlayColors[overlayIndex % overlayColors.length];
	overlayIndex++;
	return color;
}

/* -------------------------
   Creación de overlays
   ------------------------- */

/**
 * Crea un overlay visual (resaltado translúcido) sobre el nodo indicado,
 * con animación de aparición y desaparición automática.
 *
 * - Se usa para depurar cambios en el DOM.
 * - Funciona tanto con nodos de texto como con elementos HTML.
 *
 * @param node Nodo (texto o elemento) a resaltar.
 * @returns Una función de cleanup para eliminar el overlay manualmente.
 */
export function createChangeOverlay(node: Node): () => void {
	if (!debug.isShowChanges()) return () => {};

	const parent = (
		node.nodeType === Node.ELEMENT_NODE
			? (node as Element).parentElement
			: node.parentElement
	) as HTMLElement | null;
	if (!parent) return () => {};

	ensureChangeStyles();
	ensureRelativeContainer(parent);

	const overlay = document.createElement('div');
	overlay.className = '______change-overlay';
	overlay.style.opacity = '1';
	overlay.style.position = 'absolute';
	overlay.style.pointerEvents = 'none';
	overlay.style.background = getOverlayColor(); // color dinámico

	const placeOverlayAt = (rect: DOMRect) => {
		const parentRect = parent.getBoundingClientRect();
		overlay.style.left = `${Math.max(0, Math.round(rect.left - parentRect.left))}px`;
		overlay.style.top = `${Math.max(0, Math.round(rect.top - parentRect.top))}px`;
		overlay.style.width = `${Math.max(0, Math.round(rect.width))}px`;
		overlay.style.height = `${Math.max(0, Math.round(rect.height))}px`;
	};

	// Posicionamiento del overlay
	if (node.nodeType === Node.TEXT_NODE) {
		try {
			const range = document.createRange();
			range.selectNodeContents(node);
			const rects = Array.from(range.getClientRects());
			if (rects.length > 0) {
				let left = Number.POSITIVE_INFINITY;
				let top = Number.POSITIVE_INFINITY;
				let right = -Number.POSITIVE_INFINITY;
				let bottom = -Number.NEGATIVE_INFINITY;

				for (const r of rects) {
					left = Math.min(left, r.left);
					top = Math.min(top, r.top);
					right = Math.max(right, r.left + r.width);
					bottom = Math.max(bottom, r.top + r.height);
				}
				placeOverlayAt(new DOMRect(left, top, right - left, bottom - top));
			} else {
				placeOverlayAt(parent.getBoundingClientRect());
			}
		} catch {
			placeOverlayAt(parent.getBoundingClientRect());
		}
	} else if (node.nodeType === Node.ELEMENT_NODE) {
		placeOverlayAt((node as Element).getBoundingClientRect());
	} else {
		placeOverlayAt(parent.getBoundingClientRect());
	}

	// Animación de aparición y desaparición
	parent.appendChild(overlay);
	// biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
	requestAnimationFrame(() => (overlay.style.opacity = '0'));

	const onEnd = () => {
		overlay.removeEventListener('transitionend', onEnd);
		overlay.parentNode?.removeChild(overlay);
	};
	overlay.addEventListener('transitionend', onEnd);

	// Cleanup manual
	return () => {
		overlay.removeEventListener('transitionend', onEnd);
		overlay.parentNode?.removeChild(overlay);
	};
}
