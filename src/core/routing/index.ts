import { signal } from '@core/reactive/signal';
import { TriNode, type FindResult, type NodeHandler } from './route-trie';
import type { ReactiveSignal } from '@core/reactive/types';
import { page } from '../page';

/**
 * Configuración del enrutador.
 *
 * Define comportamiento opcional como:
 * - Si limpiar la caché al navegar.
 * - Si usar transiciones de vista.
 * - Rutas iniciales.
 * - Scroll y hash.
 */
export type RouterConfig = {
	/** Limpia la caché interna del enrutador al navegar */
	clearCacheOnNavigate?: boolean;

	/**
	 * Conjunto de rutas iniciales.
	 * Cada ruta puede tener:
	 * - `path`: ruta relativa.
	 * - `children`: rutas hijas que se pueden cargar de manera estática o lazy.
	 */
	routes?: (NodeHandler & {
		path: string;
		children?:
			| (NodeHandler & { path: string })[]
			| (() => Promise<(NodeHandler & { path: string })[]>)
			| Promise<(NodeHandler & { path: string })[]>;
	})[];

	/** Activa transiciones visuales al cambiar de vista */
	useViewTransitions?: boolean;

	/** Ruta base para todas las rutas del router */
	basePath?: string;

	/** Mantiene la posición de scroll al recargar la página */
	preserveScrollOnReload?: boolean;

	/** Hace scroll al top automáticamente al navegar */
	scrollTopOnNavigate?: boolean;

	/** Escucha cambios en el hash (#) de la URL */
	trackHashChanges?: boolean;
};

/**
 * Clase Router que maneja:
 * - Registro y búsqueda de rutas.
 * - Navegación programática y automática.
 * - Gestión de parámetros y estado reactivo de la URL.
 */
class Router {
	private routes = new TriNode(); // Trie de rutas para búsqueda rápida
	public ready: Promise<void>; // Promise que se resuelve cuando las rutas se han registrado
	private cache = new Map<string, NodeHandler>(); // Cache de rutas resueltas
	public url: ReactiveSignal<string> = signal(''); // URL actual como señal reactiva
	public isNavigating = false; // Indica si el router está navegando actualmente

	public params: Record<string, string> = {}; // Parámetros de la ruta actual
	public actualRoute: ReactiveSignal<FindResult> = signal({}); // Resultado de la ruta encontrada

	constructor(public routerConfig: RouterConfig = {}) {
		// Inicializa las rutas
		this.ready = this.handleRoutes('', this.routerConfig.routes);

		// Si la configuración es vacía, se usa la URL actual del navegador
		if (Object.keys(this.routerConfig).length === 0) {
			this.url.destroy();
			this.actualRoute.destroy();
			this.url = (() => window.location.href) as ReactiveSignal<string>;
		}
	}

	/**
	 * Registra rutas en el trie.
	 * - Maneja rutas hijas de forma recursiva.
	 * - Navega automáticamente a la URL actual.
	 */
	private async handleRoutes(
		parentPath: string,
		_routes?:
			| (NodeHandler & { path: string; children?: any })[]
			| Promise<(NodeHandler & { path: string; children?: any })[]>,
	) {
		if (!_routes) return;
		const routes = await _routes;

		for (const route of routes) {
			const fullPath = this.joinPaths(parentPath, route.path);
			this.routes.add(fullPath, route);

			// Lazy load de hijos
			if (route.children) {
				await this.handleRoutes(fullPath, route.children);
			}
		}

		const { pathname, search, hash } = new URL(
			window.location.href,
			window.location.origin,
		);
		const fullPath = pathname + search + hash;

		await this.changeUrl(fullPath);
	}

	/** Une dos paths eliminando slashes duplicados */
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

	/** Obtiene un parámetro de la ruta */
	public get(key: string): string {
		if (!this.has(key)) return '';
		return this.params[key];
	}

	/** Verifica si existe un parámetro en la ruta */
	public has(key: string): boolean {
		return key in this.params;
	}

	/**
	 * Reemplaza la URL actual sin generar un nuevo historial
	 * @param url URL de destino
	 */
	public async replace(url: string) {
		const { pathname, search, hash } = new URL(url, window.location.origin);
		const fullPath = pathname + search + hash;
		await this.changeUrl(fullPath, true);
	}

	/**
	 * Navega a una URL específica
	 * - Limpia la caché si está configurado.
	 * - Actualiza el estado de navegación.
	 */
	public async navigate(url: string) {
		const { pathname, search, hash } = new URL(url, window.location.origin);
		const fullPath = pathname + search + hash;

		if (this.routerConfig.clearCacheOnNavigate) {
			this.cache.clear();
		}

		this.isNavigating = true;
		await this.changeUrl(fullPath);
		this.isNavigating = false;
	}

	/**
	 * Cambia la URL interna del router
	 * - Actualiza URL reactiva y ruta actual
	 * - Manipula el historial (push o replace)
	 * - Actualiza título de página y parámetros
	 * - Aplica scroll y transiciones si corresponde
	 */
	public async changeUrl(url: string, replace = false) {
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

/** Instancia global inicial del router */
export let router = new Router({});

/**
 * Intercepta clicks en enlaces internos para navegación SPA
 */
export function interceptLinks() {
	document.addEventListener('click', (e) => {
		const target = e.target as HTMLElement;
		if (
			target instanceof HTMLAnchorElement &&
			!target.target &&
			!target.hasAttribute('download') &&
			!target.getAttribute('rel')?.includes('external') &&
			(target.href.startsWith(window.location.origin) ||
				target.href.startsWith('/'))
		) {
			e.preventDefault();
			const href = target.pathname + target.search + target.hash;
			router.navigate(href);
		}
	});
}

/** Adjunta eventos del navegador para sincronizar el router */
export function attachBrowserEvents() {
	// Evento popstate para back/forward del navegador
	window.addEventListener('popstate', () => {
		router.changeUrl(
			window.location.pathname + window.location.search + window.location.hash,
		);
	});

	// Monitorea cambios en el hash (#) si está habilitado
	if (router.routerConfig?.trackHashChanges) {
		window.addEventListener('hashchange', () => {
			router.changeUrl(
				window.location.pathname +
					window.location.search +
					window.location.hash,
			);
		});
	}

	// Preserva scroll al recargar página
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

/** Reemplaza la instancia global del router */
export function setGlobalRouter(config: RouterConfig) {
	router = new Router(config);
}

export * from './route-trie';
