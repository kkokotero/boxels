// Importa una función utilitaria para registrar manejadores globales
import { addGlobalHandler } from './global-handlers';

/**
 * Determina la dirección del deslizamiento con base en dx y dy.
 */
function getSwipeDirection(
	dx: number,
	dy: number,
): 'left' | 'right' | 'up' | 'down' {
	if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
	return dy > 0 ? 'down' : 'up';
}

/**
 * Obtiene un atributo numérico desde el elemento o retorna un valor por defecto.
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

// --- TAP ---
addGlobalHandler('$gesture:tap', (el, handler) => {
	const onTouchEnd = (e: TouchEvent) => handler(e);
	el.addEventListener('touchend', onTouchEnd, { passive: true });
	return () => el.removeEventListener('touchend', onTouchEnd);
});

// --- DOUBLE TAP ---
addGlobalHandler('$gesture:doubletap', (el, handler) => {
	let lastTap = 0;
	const maxDelay = getNumberAttr(el, '$gesture:doubletap-ms', 300);
	const onTouchEnd = (e: TouchEvent) => {
		const now = Date.now();
		if (now - lastTap < maxDelay) handler(e);
		lastTap = now;
	};
	el.addEventListener('touchend', onTouchEnd, { passive: true });
	return () => el.removeEventListener('touchend', onTouchEnd);
});

// --- LONG PRESS ---
addGlobalHandler('$gesture:longpress', (el, handler) => {
	let timeout: number;
	const duration = getNumberAttr(el, '$gesture:longpress-ms', 500);
	const onTouchStart = (e: TouchEvent) => {
		timeout = window.setTimeout(() => handler(e), duration);
	};
	const onTouchEnd = () => clearTimeout(timeout);
	el.addEventListener('touchstart', onTouchStart, { passive: true });
	el.addEventListener('touchend', onTouchEnd, { passive: true });
	return () => {
		el.removeEventListener('touchstart', onTouchStart);
		el.removeEventListener('touchend', onTouchEnd);
	};
});

// --- SWIPE ---
addGlobalHandler('$gesture:swipe', (el, handler) => {
	let startX = 0;
	let startY = 0;
	let active = false;

	const onTouchStart = (e: TouchEvent) => {
		if (e.touches.length !== 1) return;
		active = true;
		startX = e.touches[0].clientX;
		startY = e.touches[0].clientY;
		handler(
			new CustomEvent('$gesture:swipe', {
				detail: {
					state: 'start',
					dx: 0,
					dy: 0,
					distance: 0,
					direction: null,
					target: el,
				},
				bubbles: false,
			}),
		);
	};

	const onTouchMove = (e: TouchEvent) => {
		if (!active) return;
		const dx = e.touches[0].clientX - startX;
		const dy = e.touches[0].clientY - startY;
		const dist = Math.hypot(dx, dy);
		const direction = getSwipeDirection(dx, dy);
		handler(
			new CustomEvent('$gesture:swipe', {
				detail: {
					state: 'move',
					dx,
					dy,
					distance: dist,
					direction,
					target: el,
				},
				bubbles: false,
			}),
		);
	};

	const onTouchEnd = (e: TouchEvent) => {
		if (!active) return;
		active = false;
		const dx = e.changedTouches[0].clientX - startX;
		const dy = e.changedTouches[0].clientY - startY;
		const dist = Math.hypot(dx, dy);
		const min = getNumberAttr(el, '$gesture:min-swipe', 30);
		const max = getNumberAttr(
			el,
			'$gesture:max-swipe',
			Number.MAX_SAFE_INTEGER,
		);
		const direction = getSwipeDirection(dx, dy);
		const state = dist >= min && dist <= max ? 'end' : 'cancel';
		handler(
			new CustomEvent('$gesture:swipe', {
				detail: { state, dx, dy, distance: dist, direction, target: el },
				bubbles: false,
			}),
		);
	};

	el.addEventListener('touchstart', onTouchStart, { passive: true });
	el.addEventListener('touchmove', onTouchMove, { passive: true });
	el.addEventListener('touchend', onTouchEnd, { passive: true });
	el.addEventListener('touchcancel', onTouchEnd, { passive: true });

	return () => {
		el.removeEventListener('touchstart', onTouchStart);
		el.removeEventListener('touchmove', onTouchMove);
		el.removeEventListener('touchend', onTouchEnd);
		el.removeEventListener('touchcancel', onTouchEnd);
	};
});

// --- MULTITAP ---
addGlobalHandler('$gesture:multitap', (el, handler) => {
	let count = 0;
	let timer: number;
	const delay = getNumberAttr(el, '$gesture:multitap-ms', 500);
	const onTouchEnd = () => {
		count++;
		clearTimeout(timer);
		timer = window.setTimeout(() => {
			handler(
				new CustomEvent('$gesture:multitap', {
					detail: { count },
					bubbles: false,
				}),
			);
			count = 0;
		}, delay);
	};
	el.addEventListener('touchend', onTouchEnd, { passive: true });
	return () => el.removeEventListener('touchend', onTouchEnd);
});

// --- CLICK RATE ---
addGlobalHandler('$gesture:clickrate', (el, handler) => {
	let clicks: number[] = [];
	const onClick = () => {
		const now = Date.now();
		clicks.push(now);
		clicks = clicks.filter((t) => now - t < 1000);
		handler(
			new CustomEvent('$gesture:clickrate', {
				detail: { clicksPerSecond: clicks.length },
				bubbles: false,
			}),
		);
	};
	el.addEventListener('click', onClick, { passive: true });
	return () => el.removeEventListener('click', onClick);
});

// --- PINCH ---
addGlobalHandler('$gesture:pinch', (el, handler) => {
	let initialDist = 0;

	const getDistance = (e: TouchEvent) => {
		const [a, b] = e.touches;
		const dx = a.clientX - b.clientX;
		const dy = a.clientY - b.clientY;
		return Math.hypot(dx, dy);
	};

	const onStart = (e: TouchEvent) => {
		if (e.touches.length !== 2) return;
		initialDist = getDistance(e);
		handler(
			new CustomEvent('$gesture:pinch', {
				detail: { state: 'start', scale: 1 },
				bubbles: false,
			}),
		);
	};

	const onMove = (e: TouchEvent) => {
		if (e.touches.length !== 2 || initialDist === 0) return;
		const dist = getDistance(e);
		const scale = dist / initialDist;
		handler(
			new CustomEvent('$gesture:pinch', {
				detail: { state: 'move', scale },
				bubbles: false,
			}),
		);
	};

	const onEnd = () => {
		if (initialDist !== 0) {
			handler(
				new CustomEvent('$gesture:pinch', {
					detail: { state: 'end', scale: 1 },
					bubbles: false,
				}),
			);
			initialDist = 0;
		}
	};

	el.addEventListener('touchstart', onStart, { passive: true });
	el.addEventListener('touchmove', onMove, { passive: true });
	el.addEventListener('touchend', onEnd, { passive: true });
	el.addEventListener('touchcancel', onEnd, { passive: true });
	return () => {
		el.removeEventListener('touchstart', onStart);
		el.removeEventListener('touchmove', onMove);
		el.removeEventListener('touchend', onEnd);
		el.removeEventListener('touchcancel', onEnd);
	};
});

// --- ROTATE ---
addGlobalHandler('$gesture:rotate', (el, handler) => {
	let startAngle = 0;

	const getAngle = (e: TouchEvent) => {
		const [a, b] = e.touches;
		return (
			Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) * (180 / Math.PI)
		);
	};

	const onStart = (e: TouchEvent) => {
		if (e.touches.length !== 2) return;
		startAngle = getAngle(e);
		handler(
			new CustomEvent('$gesture:rotate', {
				detail: { state: 'start', angle: 0 },
				bubbles: false,
			}),
		);
	};

	const onMove = (e: TouchEvent) => {
		if (e.touches.length !== 2) return;
		const angle = getAngle(e) - startAngle;
		handler(
			new CustomEvent('$gesture:rotate', {
				detail: { state: 'move', angle },
				bubbles: false,
			}),
		);
	};

	const onEnd = () => {
		handler(
			new CustomEvent('$gesture:rotate', {
				detail: { state: 'end', angle: 0 },
				bubbles: false,
			}),
		);
		startAngle = 0;
	};

	el.addEventListener('touchstart', onStart, { passive: true });
	el.addEventListener('touchmove', onMove, { passive: true });
	el.addEventListener('touchend', onEnd, { passive: true });
	el.addEventListener('touchcancel', onEnd, { passive: true });
	return () => {
		el.removeEventListener('touchstart', onStart);
		el.removeEventListener('touchmove', onMove);
		el.removeEventListener('touchend', onEnd);
		el.removeEventListener('touchcancel', onEnd);
	};
});
