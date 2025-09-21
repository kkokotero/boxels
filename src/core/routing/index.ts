import { signal } from '@core/reactive/signal';
import { TriNode, type FindResult, type NodeHandler } from './route-trie';
import type { MaybeSignal, ReactiveSignal, Signal } from '@core/reactive/types';
import { page } from '../page';

/**
 * @description
 * Definición de una ruta.
 * - `path`: ruta relativa o absoluta.
 * - `children`: subrutas opcionales (array o función/promise que devuelve rutas).
 * - Se extiende con `NodeHandler` para manejar título, componente u otras propiedades.
 */
export type Route = {
	path: string;
	children?: Route[] | (() => Promise<Route[]>) | Promise<Route[]>;
} & NodeHandler;

/**
 * @description
 * Configuración opcional del router.
 * - `clearCacheOnNavigate`: limpia cache de rutas al navegar.
 * - `routes`: listado inicial de rutas.
 * - `useViewTransitions`: si se usan transiciones de vista nativas.
 * - `basePath`: prefijo global de rutas.
 * - `preserveScrollOnReload`: mantener scroll al recargar.
 * - `scrollTopOnNavigate`: ir al top al navegar.
 * - `trackHashChanges`: escuchar cambios en el hash.
 */
export type RouterConfig = {
	clearCacheOnNavigate?: boolean;
	routes?: Route[];
	useViewTransitions?: boolean;
	basePath?: string;
	preserveScrollOnReload?: boolean;
	scrollTopOnNavigate?: boolean;
	trackHashChanges?: boolean;
	onNotFound?: () => JSX.Element | (() => Promise<JSX.Element>);
	onError?: ({
		msg,
	}: {
		msg?: string;
	}) => JSX.Element | (({ msg }: { msg?: string }) => Promise<JSX.Element>);
};

/**
 * @description
 * Clase Router que gestiona rutas y navegación SPA.
 */
class Router {
	private routes = new TriNode(); // Trie para buscar rutas
	public ready: Promise<void>; // Promesa que se resuelve al cargar rutas
	private cache = new Map<string, NodeHandler>(); // Cache interna
	public url: Signal<string> = signal(window.location.href); // URL actual
	public isNavigating = false; // Estado de navegación
	public params: Record<string, string> = {}; // Parámetros dinámicos
	public actualRoute: Signal<FindResult> = signal({}); // Ruta actual encontrada

	constructor(public routerConfig: RouterConfig = {}) {
		// Inicializa rutas y navega automáticamente a la URL actual
		this.ready = this.handleRoutes('', this.routerConfig.routes);
	}

	/**
	 * @description
	 * Procesa rutas recursivamente y las agrega al trie.
	 * @param parentPath Ruta padre para concatenar paths.
	 * @param _routes Rutas a procesar (array, promise o función).
	 */
	private async handleRoutes(
		parentPath: string,
		_routes?: Route[] | Promise<Route[]> | (() => Promise<Route[]>),
	) {
		if (!_routes) return;
		const routes =
			typeof _routes === 'function' ? await _routes() : await _routes;

		for (const route of routes) {
			const fullPath = this.joinPaths(parentPath, route.path);
			this.routes.add(fullPath, route);
			if (route.children) {
				await this.handleRoutes(fullPath, route.children);
			}
		}

		// Navega automáticamente a la URL actual al inicializar
		await this.navigate(
			window.location.pathname + window.location.search + window.location.hash,
			true,
		);
	}

	/**
	 * @description
	 * Une dos paths eliminando slashes redundantes.
	 */
	private joinPaths(a: string, b: string) {
		return [a, b]
			.map((s) => s.replace(/^\/|\/$/g, ''))
			.filter(Boolean)
			.join('/');
	}

	/** Navega hacia atrás en el historial */
	public back() {
		window.history.back();
	}

	/** Navega hacia adelante en el historial */
	public forward() {
		window.history.forward();
	}

	/** Devuelve el valor de un parámetro dinámico de la ruta */
	public get(key: string): string {
		return this.params[key] ?? '';
	}

	/** Verifica si un parámetro dinámico existe */
	public has(key: string): boolean {
		return key in this.params;
	}

	/** Navega reemplazando la URL actual */
	public async replace(url: string) {
		await this.navigate(url, true);
		return url;
	}

	/**
	 * @description
	 * Función principal de navegación.
	 * - Actualiza cache si es necesario.
	 * - Cambia URL y actualiza estado de ruta actual.
	 */
	public async navigate(url: string, replace = false) {
		if (this.routerConfig.clearCacheOnNavigate) {
			this.cache.clear();
		}

		this.isNavigating = true;
		await this.changeUrl(url, replace);
		this.isNavigating = false;
		return url;
	}

	/**
	 * @description
	 * Cambia la URL y aplica la ruta correspondiente.
	 * - Actualiza signal de URL y ruta actual.
	 * - Actualiza historial con push o replace.
	 * - Actualiza título y parámetros.
	 * - Aplica scroll si está configurado.
	 */
	private async changeUrl(url: string, replace = false) {
		const match = await this.routes.find(url);
		this.url.set(url);
		this.actualRoute.set(match);

		const apply = () => {
			if (replace) {
				window.history.replaceState(null, '', url);
			} else {
				window.history.pushState(null, '', url);
			}

			if (match.handler) {
				page.title(match.handler.title);
				this.params = match.params ?? {};

				if (this.routerConfig?.scrollTopOnNavigate) {
					window.scrollTo({ top: 0, behavior: 'smooth' });
				}
			}
		};

		if (
			this.routerConfig?.useViewTransitions &&
			(document as any).startViewTransition
		) {
			(document as any).startViewTransition(apply);
		} else {
			apply();
		}
	}
}

/** Instancia global del router */
export let router = new Router({});

/**
 * @description
 * Intercepta clicks en enlaces internos y evita recarga de página.
 * - Realiza navegación SPA usando el router.
 */
export function interceptLinks() {
	document.addEventListener('click', (e) => {
		const target = e.target as HTMLElement;
		const anchor = target.closest('a') as HTMLAnchorElement | null;
		if (
			anchor &&
			!anchor.target &&
			!anchor.hasAttribute('download') &&
			!anchor.getAttribute('rel')?.includes('external') &&
			(anchor.href.startsWith(window.location.origin) ||
				anchor.href.startsWith('/'))
		) {
			e.preventDefault();
			const href = anchor.pathname + anchor.search + anchor.hash;
			router.navigate(href);
		}
	});
}

/**
 * @description
 * Adjunta eventos del navegador para sincronizar el router:
 * - popstate para back/forward.
 * - hashchange opcional si está configurado.
 * - preservación de scroll en recarga si está habilitado.
 */
export function attachBrowserEvents() {
	// popstate para back/forward
	window.addEventListener('popstate', () => {
		router.navigate(
			window.location.pathname + window.location.search + window.location.hash,
			true,
		);
	});

	// hashchange opcional
	if (router.routerConfig?.trackHashChanges) {
		window.addEventListener('hashchange', () => {
			router.navigate(
				window.location.pathname +
					window.location.search +
					window.location.hash,
				true,
			);
		});
	}

	// preservar scroll en recarga
	if (router.routerConfig?.preserveScrollOnReload) {
		window.addEventListener('beforeunload', () => {
			sessionStorage.setItem('__router_scrollX', String(window.scrollX));
			sessionStorage.setItem('__router_scrollY', String(window.scrollY));
		});
		window.addEventListener('load', () => {
			const x = +sessionStorage.getItem('__router_scrollX')!;
			const y = +sessionStorage.getItem('__router_scrollY')!;
			window.scrollTo(x || 0, y || 0);
		});
	}
}

/**
 * @description
 * Reemplaza la instancia global del router por una nueva con la configuración indicada.
 */
export function setGlobalRouter(config: RouterConfig) {
	router = new Router(config);
}

export * from './route-trie';
