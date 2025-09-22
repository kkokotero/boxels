import { addGlobalHandler, type ExtraEventData } from './global-handlers';

// Utilidad para calcular información adicional sobre un elemento en pantalla
function getExtraInfo(el: HTMLElement): ExtraEventData {
	const rect = el.getBoundingClientRect();
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const visibleX = Math.max(0, Math.min(rect.right, vw) - Math.max(rect.left, 0));
	const visibleY = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
	const percentX = Math.min(1, visibleX / rect.width || 0);
	const percentY = Math.min(1, visibleY / rect.height || 0);
	return {
		percentX,
		percentY,
		rect,
		viewport: { width: vw, height: vh },
	};
}

// Observador de visibilidad utilizando IntersectionObserver
const visibilityObserver = new IntersectionObserver((entries) => {
	for (const entry of entries) {
		const el = entry.target as HTMLElement;
		const visibleHandler = (el as any)['$interface:visible'];
		const invisibleHandler = (el as any)['$interface:invisible'];
		const extra = getExtraInfo(el);
		const enrichedEntry = Object.assign({}, entry, extra);

		if (entry.isIntersecting && typeof visibleHandler === 'function') {
			visibleHandler(enrichedEntry); // Elemento visible
		} else if (!entry.isIntersecting && typeof invisibleHandler === 'function') {
			invisibleHandler(enrichedEntry); // Elemento invisible
		}
	}
});

// Registro de manejador global para `$interface:visible`
addGlobalHandler('$interface:visible', (el, handler) => {
	(el as any)['$interface:visible'] = handler;
	visibilityObserver.observe(el);
	return () => visibilityObserver.unobserve(el);
});

// Registro de manejador global para `$interface:invisible`
addGlobalHandler('$interface:invisible', (el, handler) => {
	(el as any)['$interface:invisible'] = handler;
	visibilityObserver.observe(el);
	return () => visibilityObserver.unobserve(el);
});

// Registro de manejador global para `$interface:resize` utilizando ResizeObserver
addGlobalHandler('$interface:resize', (el, handler) => {
	const observer = new ResizeObserver((entries) => {
		for (const entry of entries) {
			if (entry.target === el) {
				const enrichedEntry = Object.assign({}, entry, getExtraInfo(el));
				handler(enrichedEntry); // Llama al handler con datos adicionales
			}
		}
	});
	observer.observe(el);
	return () => observer.disconnect();
});

// Envuelve un evento de puntero con datos enriquecidos
function pointerWithExtras(handler: (e: MouseEvent & ExtraEventData) => void) {
	return (e: MouseEvent) => {
		const extra = getExtraInfo(e.currentTarget as HTMLElement);
		handler(Object.assign({}, e, extra));
	};
}

// Registro de manejador global para `$interface:enter`
addGlobalHandler('$interface:enter', (el, handler) => {
	const wrapped = pointerWithExtras(handler);
	el.addEventListener('pointerenter', wrapped);
	return () => el.removeEventListener('pointerenter', wrapped);
});

// Registro de manejador global para `$interface:leave`
addGlobalHandler('$interface:leave', (el, handler) => {
	const wrapped = pointerWithExtras(handler);
	el.addEventListener('pointerleave', wrapped);
	return () => el.removeEventListener('pointerleave', wrapped);
});

// Registro de manejador global para `$interface:mutation` utilizando MutationObserver
addGlobalHandler('$interface:mutation', (el, handler) => {
	const observer = new MutationObserver((records) => {
		handler(Object.assign([], records, { el })); // Se le pasa el arreglo de mutaciones y el elemento asociado
	});
	observer.observe(el, {
		childList: true,
		subtree: true,
		attributes: true,
		characterData: true,
	});
	return () => observer.disconnect();
});

// Registro de manejador global para `$interface:idle` utilizando requestIdleCallback
addGlobalHandler('$interface:idle', (_, handler) => {
	const id = requestIdleCallback((deadline) => handler({ time: deadline.timeRemaining() }));
	return () => cancelIdleCallback(id);
});

// Registro de manejador global para `$interface:beforeunload`
addGlobalHandler('$interface:beforeunload', (_, handler) => {
	window.addEventListener('beforeunload', handler);
	return () => window.removeEventListener('beforeunload', handler);
});

// Registro de manejador global para `$interface:pageshow`
addGlobalHandler('$interface:pageshow', (_, handler) => {
	window.addEventListener('pageshow', handler);
	return () => window.removeEventListener('pageshow', handler);
});

// Registro de manejador global para `$interface:pagehide`
addGlobalHandler('$interface:pagehide', (_, handler) => {
	window.addEventListener('pagehide', handler);
	return () => window.removeEventListener('pagehide', handler);
});

// Registro de manejador global para `$interface:visibilitychange`
addGlobalHandler('$interface:visibilitychange', (_, handler) => {
	const cb = () => {
		handler({
			hidden: document.hidden,
			visibilityState: document.visibilityState,
		});
	};
	document.addEventListener('visibilitychange', cb);
	return () => document.removeEventListener('visibilitychange', cb);
});
