/** biome-ignore-all lint/suspicious/noAssignInExpressions: <explanation> */
import { debug } from '@testing/debugger';

/* -------------------------
   Estado interno
------------------------- */
let __styleInjected = false;
let __overlayRoot: HTMLDivElement | null = null;

/* -------------------------
   Inyección de estilos
------------------------- */
export function ensureChangeStyles() {
	if (!debug.isShowChanges() || __styleInjected) return;
	__styleInjected = true;

	const css = `
#___boxels-change-layer {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 999999;
}
.___change-overlay {
    position: absolute;
    pointer-events: none;
    transition: opacity 380ms ease-out;
    opacity: 1;
    border-radius: 3px;
}
`;
	const styleEl = document.createElement('style');
	styleEl.setAttribute('data-boxels-changes', 'true');
	styleEl.textContent = css;
	document.head.appendChild(styleEl);
}

/* -------------------------
   Overlay root
------------------------- */
export function ensureOverlayRoot(): HTMLDivElement {
	if (!__overlayRoot) {
		__overlayRoot = document.createElement('div');
		__overlayRoot.id = '___boxels-change-layer';
		document.body.appendChild(__overlayRoot);
	}
	return __overlayRoot;
}

/* -------------------------
   Colores
------------------------- */
const overlayColors = [
	'rgba(30, 167, 87, 0.28)',
	'rgba(255, 99, 71, 0.28)',
	'rgba(54, 162, 235, 0.28)',
	'rgba(255, 206, 86, 0.28)',
	'rgba(153, 102, 255, 0.28)',
	'rgba(255, 159, 64, 0.28)',
	'rgba(75, 192, 192, 0.28)',
	'rgba(199, 199, 199, 0.28)',
	'rgba(255, 99, 255, 0.28)',
	'rgba(0, 128, 128, 0.28)',
	'rgba(255, 215, 0, 0.28)',
	'rgba(138, 43, 226, 0.28)',
	'rgba(255, 105, 180, 0.28)',
	'rgba(0, 191, 255, 0.28)',
	'rgba(60, 179, 113, 0.28)',
];

let overlayIndex = 0;
function getOverlayColor(): string {
	return overlayColors[overlayIndex++ % overlayColors.length];
}

/* -------------------------
   Crear overlay
------------------------- */
export function createChangeOverlay(node: Node): () => void {
	if (!debug.isShowChanges()) return () => {};

	ensureChangeStyles();
	const root = ensureOverlayRoot();

	const overlay = document.createElement('div');
	overlay.className = '___change-overlay';
	overlay.style.background = getOverlayColor();

	const placeOverlayAt = (rect: DOMRect) => {
		overlay.style.left = `${Math.round(rect.left)}px`;
		overlay.style.top = `${Math.round(rect.top)}px`;
		overlay.style.width = `${Math.max(0, Math.round(rect.width))}px`;
		overlay.style.height = `${Math.max(0, Math.round(rect.height))}px`;
	};

	// Manejo de TextNode y Element
	if (node.nodeType === Node.TEXT_NODE) {
		const range = document.createRange();
		range.selectNodeContents(node);
		const rects = Array.from(range.getClientRects());
		if (rects.length > 0) {
			// Combinar todos los rectángulos en uno solo
			const left = Math.min(...rects.map(r => r.left));
			const top = Math.min(...rects.map(r => r.top));
			const right = Math.max(...rects.map(r => r.right));
			const bottom = Math.max(...rects.map(r => r.bottom));
			placeOverlayAt(new DOMRect(left, top, right - left, bottom - top));
		} else {
			// fallback si no hay rects
			const parentEl = node.parentElement;
			if (parentEl) placeOverlayAt(parentEl.getBoundingClientRect());
			else return () => {};
		}
	} else if (node.nodeType === Node.ELEMENT_NODE) {
		placeOverlayAt((node as Element).getBoundingClientRect());
	} else {
		return () => {};
	}

	// Insertar overlay
	root.appendChild(overlay);

	// Animación y auto-eliminación
	requestAnimationFrame(() => (overlay.style.opacity = '0'));
	const cleanup = () => overlay.remove();
	const onTransitionEnd = () => cleanup();

	overlay.addEventListener('transitionend', onTransitionEnd);

	return () => {
		overlay.removeEventListener('transitionend', onTransitionEnd);
		cleanup();
	};
}
