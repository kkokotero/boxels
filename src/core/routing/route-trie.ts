import type { MaybeSignal, ReactiveSignal } from '@core/reactive/types';

/**
 * Representa un componente que puede ser:
 * - Una función que retorna un `JSX.Element` o una promesa de este.
 * - Directamente un `JSX.Element`.
 */
export type ComponentI = () =>
	| Promise<((props: unknown) => JSX.Element) | JSX.Element>
	| JSX.Element;

/**
 * Resultado esperado de un guard (filtro de acceso a rutas):
 * - `boolean`: true para permitir, false para denegar.
 * - Objeto con:
 *    - `redirect`: Ruta a la que se debe redirigir si falla.
 *    - `message`: Mensaje opcional de contexto.
 */
export type GuardResult =
	| boolean
	| {
			redirect?: string;
			message?: string;
			component?: () => JSX.Element | (() => Promise<JSX.Element>);
	  };

/**
 * Función de guardado (guard) que protege rutas.
 * Puede ser síncrona o asíncrona.
 */
export type Guard = () => Promise<GuardResult> | GuardResult;

/**
 * Configuración asociada a un nodo del árbol de rutas.
 */
export interface NodeHandler {
	/** Componente que se debe renderizar para esta ruta. */
	component?: ComponentI;

	/** Lista de funciones guard que validan si la ruta es accesible. */
	guards?: Guard[];

	/** Título de la página (string, señal reactiva o función). */
	title?: string | ReactiveSignal<string> | (() => string);

	meta?: Record<string, string>;

	/** Ruta a la que redirigir en caso de acceso. */
	redirect?: string;
}

/**
 * Resultado de la búsqueda de una ruta.
 */
export interface FindResult {
	/** Manejador encontrado para la ruta. */
	handler?: NodeHandler;

	/** Parámetros capturados de la ruta. */
	params?: Record<string, any>;

	/** Mensaje adicional, p.ej. de un guard. */
	message?: string;

	redirect?: string;

	meta?: Record<string, string>;

	component?: () => JSX.Element | (() => Promise<JSX.Element>);
}

/**
 * Nodo interno del árbol de rutas.
 *
 * Estructura optimizada para búsqueda rápida:
 * - `staticChildren`: hijos con nombre fijo.
 * - `paramChild`: hijo con parámetro dinámico (ej: `:id`).
 * - `wildcardChild`: hijo comodín (`**`) que captura el resto del path.
 * - `handler`: datos o lógica para manejar la ruta.
 */
class Node {
	staticChildren: Map<string, Node> | null = null;
	paramChild: { key: string; node: Node } | null = null;
	wildcardChild: Node | null = null;
	handler?: NodeHandler | (() => Promise<NodeHandler>) | Promise<NodeHandler>;
}

/**
 * Árbol de rutas tipo trie optimizado para búsqueda y resolución de rutas.
 */
export class TriNode {
	public root: Node = new Node();

	/** Expresión regular para limpiar separadores `/` redundantes. */
	private readonly SEP_RE = /\/+\/|^\/+|\/+$/g;

	/** Límite de redirecciones seguidas para evitar bucles infinitos. */
	private readonly MAX_REDIRECTS = 16;

	/**
	 * Normaliza una ruta dividiéndola en segmentos.
	 * - Elimina `/` extra.
	 * - Retorna un array de segmentos (sin `/` inicial ni final).
	 */
	private normalize(path: string): string[] {
		if (!path) return [];
		const clean = path.replace(this.SEP_RE, (m) => (m === '/' ? '/' : ''));
		if (clean === '/') return []; // Ruta raíz
		const start = clean[0] === '/' ? 1 : 0;
		const end =
			clean[clean.length - 1] === '/' ? clean.length - 1 : clean.length;
		let seg = '';
		const parts: string[] = [];
		for (let i = start; i < end; i++) {
			const c = clean.charCodeAt(i);
			if (c === 47 /* '/' */) {
				if (seg) {
					parts.push(seg);
					seg = '';
				}
			} else seg += clean[i];
		}
		if (seg) parts.push(seg);
		return parts;
	}

	/**
	 * Convierte un string de query en un objeto de parámetros.
	 * - Soporta valores repetidos en arrays.
	 */
	private parseQuery(query: string): Record<string, string | string[]> {
		const params: Record<string, any> = {};
		if (!query) return params;

		for (const [key, value] of new URLSearchParams(query)) {
			if (params[key] !== undefined) {
				if (Array.isArray(params[key])) {
					params[key].push(value);
				} else {
					params[key] = [params[key], value];
				}
			} else {
				params[key] = value;
			}
		}
		return params;
	}

	/**
	 * Agrega un nuevo path y su manejador al trie.
	 * - Soporta rutas estáticas (`/home`).
	 * - Parámetros dinámicos (`/user/:id`).
	 * - Comodines (`/files/**`).
	 * - La ruta raíz `/` se asigna directamente al root.
	 */
	public add(
		path: string,
		handler: NodeHandler | (() => Promise<NodeHandler>) | Promise<NodeHandler>,
	): void {
		const parts = this.normalize(path);

		// Manejar ruta raíz
		if (parts.length === 0) {
			this.root.handler = handler;
			return;
		}

		let node = this.root;

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];

			// Ruta comodín
			if (part === '**') {
				if (!node.wildcardChild) node.wildcardChild = new Node();
				node = node.wildcardChild;
				break;
			}

			// Ruta con parámetro
			if (part.charCodeAt(0) === 58 /* ':' */) {
				const key = part.slice(1);
				if (!node.paramChild) node.paramChild = { key, node: new Node() };
				else node.paramChild.key = key;
				node = node.paramChild.node;
				continue;
			}

			// Ruta estática
			if (!node.staticChildren) node.staticChildren = new Map();
			let next = node.staticChildren.get(part);
			if (!next) {
				next = new Node();
				node.staticChildren.set(part, next);
			}
			node = next;
		}

		node.handler = handler;
	}

	/**
	 * Busca una ruta y retorna su manejador y parámetros.
	 * - Incluye parámetros de query.
	 */
	public async find(
		path: string,
		abortSignal?: AbortSignal,
	): Promise<FindResult> {
		const [pathname, search = ''] = path.split('?');
		const queryParams = this.parseQuery(search);

		const result = await this.resolve(pathname, 0, abortSignal);

		if (result.params) {
			result.params.query = queryParams;
		} else {
			result.params = { query: queryParams };
		}

		return result;
	}

	/**
	 * Obtiene el `NodeHandler` real de un nodo.
	 * - Si es una función, la ejecuta y almacena el resultado.
	 * - Si es una promesa, la resuelve.
	 */
	private async getHandler(node: Node): Promise<NodeHandler | undefined> {
		if (!node.handler) return undefined;

		if (typeof node.handler === 'object' && 'component' in node.handler) {
			return node.handler as NodeHandler;
		}

		if (typeof node.handler === 'function') {
			const result = await (node.handler as () => Promise<NodeHandler>)();
			node.handler = result;
			return result;
		}

		if (node.handler instanceof Promise) {
			const result = await node.handler;
			node.handler = result;
			return result;
		}

		return undefined;
	}

	/**
	 * Resuelve recursivamente una ruta, ejecutando guards y siguiendo redirecciones.
	 */
	private async resolve(
		path: string,
		depth: number,
		abortSignal?: AbortSignal,
		carryMessage?: string,
	): Promise<FindResult> {
		if (depth > this.MAX_REDIRECTS) {
			return { params: {}, message: carryMessage };
		}
		if (abortSignal?.aborted) {
			return { params: {}, message: carryMessage };
		}

		const { node, params, guardsChain, metaChain } =
			await this.matchWithGuardsAndMeta(path);
		if (!node) return { params, message: carryMessage };

		const handler = await this.getHandler(node);

		const redirect =
			handler?.redirect ??
			(typeof node.handler === 'object'
				? (node.handler as NodeHandler).redirect
				: undefined);
		if (redirect) {
			return { redirect, params, message: carryMessage };
		}

		if (!handler) return { params, message: carryMessage };

		// Ejecutar guards acumulados
		for (const guard of guardsChain) {
			if (abortSignal?.aborted) {
				return { params, message: carryMessage };
			}

			const result = await guard();

			if (result === false) {
				return {
					params,
					message: carryMessage ?? 'Acceso denegado',
					meta: metaChain,
				};
			}

			if (typeof result === 'object' && result) {
				const nextMessage = result.message ?? carryMessage;

				if (result.component) {
					return {
						component: result.component,
						params,
						message: nextMessage,
						meta: metaChain,
					};
				}

				if (result.redirect) {
					return {
						redirect: result.redirect,
						params,
						message: nextMessage,
						meta: metaChain,
					};
				}

				if (result.message) {
					return { params, message: nextMessage, meta: metaChain };
				}

				return { params, message: nextMessage, meta: metaChain };
			}
		}

		// ✅ Resultado final incluye meta combinado
		return { handler, params, message: carryMessage, meta: metaChain };
	}

	/**
	 * Busca un nodo que coincida con la ruta dada.
	 * - Además acumula los guards desde la raíz hasta el nodo encontrado.
	 */
	private async matchWithGuardsAndMeta(path: string): Promise<{
		node?: Node;
		params: Record<string, string>;
		guardsChain: Guard[];
		metaChain: Record<string, string>;
	}> {
		const parts = this.normalize(path);
		const params: Record<string, string> = {};
		let node: Node | undefined = this.root;
		const guardsChain: Guard[] = [];
		let metaChain: Record<string, string> = {};

		// Recorre acumulando guards y metas
		const collect = async (n: Node) => {
			const handler = await this.getHandler(n);
			if (handler?.guards?.length) {
				guardsChain.push(...handler.guards);
			}
			if (handler?.meta) {
				// 👉 merge incremental (padre -> hijo sobrescribe)
				metaChain = { ...metaChain, ...handler.meta };
			}
		};

		await collect(this.root);

		for (let i = 0; i < parts.length; i++) {
			if (!node) break;
			const seg = parts[i];

			if (node.staticChildren?.has(seg)) {
				node = node.staticChildren.get(seg)!;
				await collect(node);
				continue;
			}

			if (node.paramChild) {
				params[node.paramChild.key] = seg;
				node = node.paramChild.node;
				await collect(node);
				continue;
			}

			if (node.wildcardChild) {
				const rest = parts.slice(i).join('/');
				if (rest) params.rest = rest;
				node = node.wildcardChild;
				await collect(node);
				break;
			}

			return { node: undefined, params, guardsChain, metaChain };
		}

		return { node, params, guardsChain, metaChain };
	}
}
