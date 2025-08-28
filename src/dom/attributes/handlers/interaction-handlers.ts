// Este archivo define manejadores globales personalizados para atributos
// especiales relacionados con interacciones del usuario, como detección de
// proximidad, rastreo del puntero, entrada/salida del mouse y permanencia.

import { addGlobalHandler } from './global-handlers'; // Importa el sistema de registro de manejadores globales.

/**
 * Función auxiliar para obtener un atributo numérico desde el elemento.
 * Primero intenta acceder directamente a la propiedad, luego al atributo HTML.
 * Si no existe o no es válido, se retorna el valor por defecto.
 */
function getNumberAttr(
	el: HTMLElement,
	attr: string,
	fallback: number,
): number {
	const val = (el as any)[attr];
	if (typeof val === 'number') return val;
	const str = el.getAttribute?.(attr);
	if (str != null) {
		const parsed = Number.parseFloat(str);
		return Number.isNaN(parsed) ? fallback : parsed;
	}
	return fallback;
}

/**
 * Calcula la distancia mínima entre un punto (x, y) y los bordes del elemento.
 * Si el punto está dentro del rectángulo del elemento, la distancia es 0.
 */
function getDistanceToElement(el: HTMLElement, x: number, y: number): number {
	const rect = el.getBoundingClientRect();
	const cx = Math.max(rect.left, Math.min(x, rect.right));
	const cy = Math.max(rect.top, Math.min(y, rect.bottom));
	const dx = x - cx;
	const dy = y - cy;
	return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Atributo especial: $interaction:radius
 * Se registra el valor de radio como un atributo interno en el elemento.
 * Este valor será usado por `$interaction:near`.
 */
addGlobalHandler('$interaction:radius', (el, handler) => {
	el.setAttribute('__box_r_i_', String(handler));
	return () => {
		el.removeAttribute('__box_r_i_');
	};
});

/**
 * Atributo especial: $interaction:linger-ms
 * Se registra el valor de duración como un atributo interno en el elemento.
 * Este valor será usado por `$interaction:linger`.
 */
addGlobalHandler('$interaction:linger-ms', (el, handler) => {
	el.setAttribute('__box_l_ms_i_', String(handler));
	return () => {
		el.removeAttribute('__box_l_ms_i_');
	};
});

/**
 * Manejador para: $interaction:near
 * Detecta cuando el puntero del mouse está dentro del radio especificado alrededor del elemento.
 * Se ejecuta en cada movimiento del mouse sobre la ventana.
 */
addGlobalHandler('$interaction:near', (el, handler) => {
	const radius = getNumberAttr(el, '__box_r_i_', 100);

	const onMouseMove = (e: MouseEvent) => {
		const dist = getDistanceToElement(el, e.clientX, e.clientY);
		if (dist <= radius) {
			handler(
				new CustomEvent('$interaction:near', {
					detail: { distance: dist },
					bubbles: false,
				}),
			);
		}
	};

	window.addEventListener('mousemove', onMouseMove);
	return () => window.removeEventListener('mousemove', onMouseMove);
});

/**
 * Manejador para: $interaction:track
 * Permite rastrear el movimiento del mouse dentro del elemento.
 */
addGlobalHandler('$interaction:track', (el, handler) => {
	const onMouseMove = (e: MouseEvent) => {
		handler(e);
	};
	el.addEventListener('mousemove', onMouseMove);
	return () => el.removeEventListener('mousemove', onMouseMove);
});

/**
 * Manejador para: $interaction:mouseenter
 * Dispara un evento cuando el puntero entra en el área del elemento.
 */
addGlobalHandler('$interaction:mouseenter', (el, handler) => {
	const onEnter = (e: MouseEvent) => handler(e);
	el.addEventListener('mouseenter', onEnter);
	return () => el.removeEventListener('mouseenter', onEnter);
});

/**
 * Manejador para: $interaction:mouseleave
 * Dispara un evento cuando el puntero sale del área del elemento.
 */
addGlobalHandler('$interaction:mouseleave', (el, handler) => {
	const onLeave = (e: MouseEvent) => handler(e);
	el.addEventListener('mouseleave', onLeave);
	return () => el.removeEventListener('mouseleave', onLeave);
});

/**
 * Manejador para: $interaction:linger
 * Dispara un evento personalizado si el puntero permanece sobre el elemento
 * por más del tiempo definido en `$interaction:linger-ms`.
 */
addGlobalHandler('$interaction:linger', (el, handler) => {
	let timer: number | undefined;
	const delay = getNumberAttr(el, '__box_l_ms_i_', 1000);

	const onMouseEnter = () => {
		timer = window.setTimeout(() => {
			handler(
				new CustomEvent('$interaction:linger', {
					detail: { duration: delay },
					bubbles: false,
				}),
			);
		}, delay);
	};

	const onMouseLeave = () => {
		if (timer != null) {
			clearTimeout(timer);
			timer = undefined;
		}
	};

	el.addEventListener('mouseenter', onMouseEnter);
	el.addEventListener('mouseleave', onMouseLeave);

	return () => {
		el.removeEventListener('mouseenter', onMouseEnter);
		el.removeEventListener('mouseleave', onMouseLeave);
	};
});

/*
 * Dispara el handler cuando se da click afuera del elemento.
 */
addGlobalHandler(
	'$interaction:click-outside',
	(el, handler: (ev: MouseEvent | TouchEvent) => void) => {
		const listener = (event: MouseEvent | TouchEvent) => {
			if (!el.contains(event.target as Node)) {
				handler(event);
			}
		};

		// Escuchamos tanto click como touchstart
		document.addEventListener('click', listener, true);
		document.addEventListener('touchstart', listener, true);

		// Cleanup
		return () => {
			document.removeEventListener('click', listener, true);
			document.removeEventListener('touchstart', listener, true);
		};
	},
);
