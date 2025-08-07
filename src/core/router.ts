// Importa utilidades del sistema reactivo
import { isSignal, signal, type ReactiveSignal } from './reactive';

// Tipos para representar los segmentos de una ruta
export type StaticSegment = string; // Segmento estático (ej: 'home')
export type WildcardSegment = '**'; // Segmento comodín que representa cualquier ruta
export type ParamSegment = `:${string}`; // Segmento paramétrico (ej: ':id')
export type PathSegment = StaticSegment | ParamSegment | WildcardSegment;

// Tipo para una ruta base, que comienza con '/'
export type Path = `/${PathSegment}`;

// Guardas que permiten bloquear o permitir navegación condicional
export type RouteGuard = () => boolean | Promise<boolean>;

// Definición de una ruta individual
export interface Route {
	path: Path; // Ruta asociada (ej: /home, /user/:id)

	description?: string; // Descripción opcional
	keywords?: string[]; // Palabras clave para SEO

	redirect?: Path; // Ruta de redirección

	breadcrumb?: string | (() => string); // Miga de pan (breadcrumb) para navegación

	params?: Record<string, string | number>; // Parámetros personalizados de la ruta
	meta?: Record<string, unknown>; // Información adicional arbitraria

	component?: () => JSX.Element; // Componente asociado (sincrónico)
	loadComponent?: () => Promise<
		// Componente cargado de forma perezosa
		((props: unknown) => JSX.Element) | JSX.Element
	>;

	guards?: RouteGuard[]; // Arreglo de guardas de navegación
	title?: string | (() => string) | ReactiveSignal<string>; // Título dinámico o reactivo

	children?: Route[] | (() => Promise<() => Route[]>); // Rutas hijas o anidadas
}

// Configuración global del router
export type RouterConfig = {
	useCache?: boolean; // Usa caché para rutas cargadas
	clearCacheOnNavigate?: boolean; // Limpia la caché al navegar
	routes?: Route[]; // Rutas iniciales

	useViewTransitions?: boolean; // Usa animaciones nativas entre vistas
	basePath?: string; // Ruta base de la app
	preserveScrollOnReload?: boolean; // Mantiene el scroll tras recargar
	scrollTopOnNavigate?: boolean; // Vuelve arriba al navegar
	trackHashChanges?: boolean; // Observa cambios en el hash
};

// Clase principal del enrutador SPA
export class Router {
	public params: Record<string, string> = {}; // Parámetros extraídos de la URL

	// --- almacenamiento interno ligero (no reactivo) ---
	private _urlValue: string; // valor actual de la URL (string simple)
	private _urlSignal?: ReactiveSignal<string>; // señal lazy (si se crea)
	private _actualTitleSignal?: ReactiveSignal<string>; // señal lazy (si se crea)

	constructor(public routerConfig: RouterConfig = {}) {
		// Inicializa valor bruto de la URL, sin crear señales.
		this._urlValue =
			window.location.pathname + window.location.search + window.location.hash;

		// NOTA: No creamos signal() en el constructor para ahorrar recursos.
	}

	// --- Getters lazy para compatibilidad: crean la señal sólo cuando se accede ---
	public get url(): ReactiveSignal<string> {
		if (!this._urlSignal) {
			this._urlSignal = signal(this._urlValue);
		}
		return this._urlSignal;
	}

	public get actualTitle(): ReactiveSignal<string> {
		if (!this._actualTitleSignal) {
			this._actualTitleSignal = signal(document.title || '');
			// Mantén el document.title sincronizado si alguien creó la señal.
			this._actualTitleSignal.subscribe((v) => {
				document.title = v;
			});
		}
		return this._actualTitleSignal;
	}

	// Actualiza el título del documento basado en la ruta actual
	private updateDocumentTitle(route: Route) {
		if (!route.title) return;

		// Si el title es una señal reactiva, suscríbase directamente a ella sin crear nuestra señal
		if (isSignal(route.title)) {
			// suscribir directamente para reflejar en document.title
			route.title.subscribe((v) => {
				document.title = v;
				// si nuestra señal ya existe, mantenla sincronizada también
				if (this._actualTitleSignal) this._actualTitleSignal.set(v);
			});
			return;
		}

		// Si es función, evalúala y asigna título
		if (typeof route.title === 'function') {
			try {
				const t = route.title();
				document.title = t;
				if (this._actualTitleSignal) this._actualTitleSignal.set(t);
			} catch (e) {
				// ignore errores al computar título
			}
			return;
		}

		// Si es string, úsalo directamente
		if (typeof route.title === 'string') {
			document.title = route.title;
			if (this._actualTitleSignal) this._actualTitleSignal.set(route.title);
		}
	}

	// Formatea una ruta con basePath si aplica
	private formatPath(path: string | string[]): string {
		const raw = typeof path === 'string' ? path : `/${path.join('/')}`;
		return this.routerConfig?.basePath
			? `/${this.routerConfig.basePath.replace(/^\/|\/$/g, '')}${raw}`
			: raw;
	}

	// Navega a una ruta agregando al historial
	public navigate(path: string | string[]) {
		const url = this.formatPath(path);
		this.changeUrl(url, false);
	}

	// Reemplaza la ruta actual sin agregar al historial
	public replace(path: string | string[]) {
		const url = this.formatPath(path);
		this.changeUrl(url, true);
	}

	// Retrocede en el historial
	public back() {
		window.history.back();
	}

	// Recarga la página actual
	public reload() {
		window.location.reload();
	}

	// Avanza en el historial
	public forward() {
		window.history.forward();
	}

	// Obtiene el valor de un parámetro
	public get(key: string): string {
		return this.params[key] ?? `${key} Not Found`;
	}

	// Verifica si existe un parámetro
	public has(key: string): boolean {
		return key in this.params;
	}

	// Extrae los parámetros de la query string
	public syncParamsFromQueryString() {
		this.params = {};
		const query = new URLSearchParams(window.location.search);
		for (const [key, value] of query.entries()) {
			this.params[key] = value;
		}
	}

	// Cambia la URL y realiza acciones asociadas (como scroll y título)
	public async changeUrl(url: string, replace = false) {
		const match = await this.matchRoute(url);

		const apply = () => {
			// Manipula el historial
			if (replace) {
				window.history.replaceState(null, '', url);
			} else {
				window.history.pushState(null, '', url);
			}

			// Actualiza el valor interno sin forzar la creación de la señal
			this._urlValue = url;

			// Si la señal ya existe, actualízala; si no, no la creamos.
			if (this._urlSignal) {
				this._urlSignal.set(url);
			}

			if (match) {
				this.updateDocumentTitle(match.route);

				// Scroll automático si está habilitado
				if (this.routerConfig?.scrollTopOnNavigate) {
					window.scrollTo({ top: 0, behavior: 'smooth' });
				}
			}
		};

		// Usa transiciones si están disponibles
		if (this.routerConfig?.useViewTransitions && (document as any).startViewTransition) {
			(document as any).startViewTransition(apply);
		} else {
			apply();
		}
	}

	// Busca una coincidencia de ruta de forma recursiva
	private async matchRoute(
		pathname: string,
		basePath = '',
	): Promise<{ route: Route; params: {} } | null> {
		for (const route of this.routerConfig?.routes || []) {
			let fullPath = basePath + route.path;

			if (fullPath === pathname) {
				return { route, params: {} };
			}

			// Busca en rutas hijas si existen
			if (route.children) {
				const children =
					typeof route.children === 'function'
						? await (await route.children())()
						: route.children;

				for (const childRoute of children) {
					const match = await this.matchRoute(pathname, fullPath);
					if (match) return match;
				}
			}
		}
		return null;
	}

	// --- utilidades de acceso directo al valor raw sin crear señales ---
	/** Devuelve la URL actual como string sin forzar creación de señal. */
	public getUrlValue(): string {
		return this._urlValue;
	}

	/** Devuelve true si la señal de URL ya fue creada (sin crearla). */
	public hasUrlSignal(): boolean {
		return !!this._urlSignal;
	}

	/** Devuelve true si la señal de título ya fue creada (sin crearla). */
	public hasTitleSignal(): boolean {
		return !!this._actualTitleSignal;
	}
}

// Instancia global inicial del enrutador (puede ser reemplazada)
export let router = new Router({});

// Intercepta clicks en enlaces internos para manejar SPA sin recarga
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

// Adjunta eventos del navegador al enrutador
export function attachBrowserEvents() {
	// Cambios de historial (back, forward)
	window.addEventListener('popstate', () => {
		// usamos changeUrl con replace=true para reflectar la URL actual
		router.changeUrl(window.location.pathname + window.location.search + window.location.hash, true);
	});

	// Cambios en el hash si se configuró
	if (router.routerConfig?.trackHashChanges) {
		window.addEventListener('hashchange', () => {
			router.changeUrl(window.location.pathname + window.location.search + window.location.hash, true);
		});
	}

	// Guarda/restaura posición de scroll si se configuró
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

// Reemplaza el enrutador global con nueva configuración
export function setGlobalRouter(config: RouterConfig) {
	router = new Router(config);
}
