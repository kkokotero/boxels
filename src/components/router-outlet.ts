// Importación de funciones y tipos esenciales del sistema de enrutamiento central.
import {
	setGlobalRouter, // Establece la configuración global del enrutador.
	router, // Objeto reactivo que mantiene la URL y otros datos del enrutador.
	interceptLinks, // Intercepta clics en enlaces para navegación SPA.
	attachBrowserEvents, // Escucha eventos del navegador como popstate.
	type Route, // Tipo de ruta.
	type RouteGuard, // Tipo para las guardas de rutas.
	type RouterConfig, // Tipo para la configuración del enrutador.
} from '@core/router';

import { $, type BoxelsElement } from '@dom/index'; // Utilidades DOM para crear y montar elementos.
import { effect } from '@core/reactive'; // Sistema reactivo para responder a cambios en señales.

// Caché de rutas resueltas para mejorar rendimiento.
const routeCache = new Map<
	string,
	{ route: Route; params: Record<string, string> }
>();

/**
 * Normaliza un path asegurando que empiece con '/' y no tenga barras dobles.
 */
function normalizePath(path: string): string {
	return ('/' + path).replace(/\/+/g, '/');
}

/**
 * Realiza el *matching* entre una ruta patrón (`/user/:id`) y una ruta actual (`/user/42`).
 * Extrae parámetros dinámicos y soporta wildcard (`**`).
 */
function matchRoute(pattern: string, actual: string) {
	if (pattern === actual) return { matched: true, params: {} };

	const patternParts = pattern.split('/').filter(Boolean);
	const actualParts = actual.split('/').filter(Boolean);

	const params: Record<string, string> = {};
	const len = Math.min(patternParts.length, actualParts.length);

	for (let i = 0; i < len; i++) {
		const pp = patternParts[i];
		const ap = actualParts[i];

		if (pp === '**') return { matched: true, params };
		if (pp.startsWith(':')) {
			params[pp.slice(1)] = ap;
		} else if (pp !== ap) {
			return { matched: false, params: {} };
		}
	}

	const matched =
		patternParts.length === actualParts.length ||
		(patternParts.length < actualParts.length && patternParts.at(-1) === '**');

	return { matched, params };
}

/**
 * Carga las rutas hijas de forma perezosa si están definidas como una función `() => () => Route[]`.
 */
async function loadChildren(route: Route): Promise<Route[]> {
	return typeof route.children === 'function'
		? await route.children()
		: route.children || [];
}

/**
 * Resuelve una ruta dada una lista de rutas y una URL actual.
 * Busca recursivamente en rutas hijas concatenando paths,
 * interpretando las rutas hijas que empiezan con '/' como relativas al padre.
 */
async function resolveRoute(
	routes: Route[],
	url: string,
	useCache: boolean,
	basePath = '',
): Promise<{ route: Route; params: Record<string, string> } | null> {
	if (useCache && routeCache.has(url)) return routeCache.get(url)!;

	for (const route of routes) {
		let fullPath = '';

		if (route.path === '/') {
			// Ruta hija igual a '/', significa la misma ruta padre.
			fullPath = normalizePath(basePath);
		} else if (route.path.startsWith('/')) {
			// Ruta hija que comienza con '/', la concatenamos como relativa al padre.
			fullPath = normalizePath(basePath + route.path);
		} else {
			// Ruta hija relativa, concatenación normal con '/'
			fullPath = normalizePath(basePath + '/' + route.path);
		}

		const match = matchRoute(fullPath, url);
		if (match.matched) {
			const result = { route, params: match.params };
			if (useCache) routeCache.set(url, result);
			return result;
		}

		if (route.children) {
			const children = await loadChildren(route);
			const nested = await resolveRoute(children, url, useCache, fullPath);
			if (nested) return nested;
		}
	}

	return null;
}

/**
 * Evalúa las funciones de guardia de una ruta.
 * Si alguna retorna `false`, se deniega el acceso.
 */
async function evaluateGuards(guards: RouteGuard[] = []): Promise<boolean> {
	try {
		for (const guard of guards) {
			if (!(await guard())) return false;
		}
		return true;
	} catch (err) {
		console.error('Guard Error:', err);
		return false;
	}
}

/**
 * Realiza scroll al inicio de la página si la configuración lo permite.
 */
function scrollToTop() {
	if (router.routerConfig.scrollTopOnNavigate ?? true) {
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}
}

/**
 * Establece el título del documento según la ruta actual.
 */
function setTitle(title?: string | (() => string)) {
	if (title) document.title = typeof title === 'function' ? title() : title;
}

/**
 * Crea marcadores (comentarios vacíos) como puntos de montaje para contenido dinámico del router.
 */
function createPlaceholder() {
	return {
		start: document.createComment(''),
		end: document.createComment(''),
	};
}

/**
 * Elimina todo el contenido DOM entre dos nodos (start y end).
 */
function clearContentBetween(start: Node, end: Node) {
	const range = document.createRange();
	range.setStartAfter(start);
	range.setEndBefore(end);
	range.deleteContents();
}

/**
 * Componente que actúa como *outlet* del enrutador.
 * Se encarga de montar el componente correspondiente a la URL actual.
 */
export function RouterOutlet({ config }: { config: RouterConfig }) {
	// Establece la configuración global del router.
	setGlobalRouter(config);

	// Habilita navegación interceptando clics en enlaces y popstate.
	interceptLinks();
	attachBrowserEvents();

	// Crea marcadores DOM donde se insertará el componente de la ruta.
	const { start, end } = createPlaceholder();
	let initialized = false;
	let activeId = 0; // ID para evitar condiciones de carrera en navegaciones asincrónicas.
	let disposers: (() => void)[] = []; // Funciones para desmontar el contenido anterior.

	/**
	 * Lógica principal para navegar a una URL y montar el componente correspondiente.
	 */
	async function navigate(navigationId: number, url: string) {
		if (!initialized) {
			start.parentNode?.insertBefore(end, start.nextSibling);
			initialized = true;
		}

		// Limpia el contenido anterior.
		disposers.forEach((fn) => fn());
		disposers = [];
		clearContentBetween(start, end);

		const useCache = config.useCache ?? false;
		const match = await resolveRoute(config.routes || [], url, useCache);

		// Cancela navegación si cambió mientras se resolvía la ruta.
		if (navigationId !== activeId || router.url() !== url) return;

		// Ruta no encontrada (404).
		if (!match) {
			const notFound = $('b', {}, '404 - Not Found: ', url);
			notFound.mount(end);
			disposers.push(notFound.destroy);
			setTitle('Not Found');
			return;
		}

		const { route, params } = match;
		router.params = params;
		setTitle(route.title);

		// Evaluación de guardias (403 si falla).
		if (route.guards?.length) {
			const access = await evaluateGuards(route.guards);
			if (!access) {
				const forbidden = $('b', {}, '403 - Forbidden: ', url);
				forbidden.mount(end);
				disposers.push(forbidden.destroy);
				setTitle('Forbidden');
				return;
			}
		}

		// Redirección si está definida.
		if (route.redirect) {
			router.navigate(route.redirect);
			return;
		}

		// Carga y montaje del componente asociado a la ruta.
		try {
			let component: BoxelsElement | JSX.Element;

			if (route.loadComponent) {
				const loaded = await route.loadComponent();
				component = typeof loaded === 'function' ? await loaded({}) : loaded;
			} else if (route.component) {
				component = await route.component();
			} else {
				throw new Error(`Route "${route.path}" has no component.`);
			}

			(component as BoxelsElement).mount(end);
			disposers.push((component as BoxelsElement).destroy);
			scrollToTop();
		} catch (err) {
			console.error('Component Error:', err);
			const errorEl = $('b', {}, 'Error: ', (err as Error).message);
			errorEl.mount(end);
			disposers.push(errorEl.destroy);
			setTitle('Error');
		}
	}

	// Reactividad: observa cambios en la URL y navega en consecuencia.
	effect([router.url], () => {
		const nextUrl = router.url();
		activeId++;
		navigate(activeId, nextUrl);
	});

	return start; // Retorna el nodo de inicio como punto de montaje del router.
}
