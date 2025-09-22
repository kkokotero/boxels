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
    z-index: 999999; /* máximo aislamiento */
}

.___change-overlay {
    position: absolute;
    pointer-events: none;
    transition: opacity 380ms ease-out;
    opacity: 1;
}
`;
	const el = document.createElement('style');
	el.setAttribute('data-boxels-changes', 'true');
	el.textContent = css;
	document.head.appendChild(el);
}

/* -------------------------
   Asegurar overlay root
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
   Crear overlay
------------------------- */
export function createChangeOverlay(node: Node): () => void {
	if (!debug.isShowChanges()) return () => {};

	ensureChangeStyles();
	const root = ensureOverlayRoot();

	const overlay = document.createElement('div');
	overlay.className = '___change-overlay';
	overlay.style.background = getOverlayColor();

	// Calcular rectángulo global (viewport)
	const placeOverlayAt = (rect: DOMRect) => {
		overlay.style.left = `${Math.round(rect.left)}px`;
		overlay.style.top = `${Math.round(rect.top)}px`;
		overlay.style.width = `${Math.max(0, Math.round(rect.width))}px`;
		overlay.style.height = `${Math.max(0, Math.round(rect.height))}px`;
	};

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
					right = Math.max(right, r.right);
					bottom = Math.max(bottom, r.bottom);
				}
				placeOverlayAt(new DOMRect(left, top, right - left, bottom - top));
			}
		} catch {
			placeOverlayAt((node as Element).getBoundingClientRect());
		}
	} else if (node.nodeType === Node.ELEMENT_NODE) {
		placeOverlayAt((node as Element).getBoundingClientRect());
	} else {
		return () => {};
	}

	// Insertar en capa global
	root.appendChild(overlay);

	// Animación
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
