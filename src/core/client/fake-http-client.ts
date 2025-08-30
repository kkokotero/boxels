import type { HttpClientOptions, HttpResponse, ResponseType } from './http-client';

/**
 * ======================================================
 * Tipos de Mock
 * ======================================================
 */

/**
 * @description
 * Representa un mock de respuesta HTTP.
 * Permite simular status, datos, delay y tipo de respuesta.
 */
export type MockEntry<TBody = any, T = any> = {
	/** Código HTTP simulado (por defecto 200 si no se indica) */
	status?: number;
	/** Datos de respuesta:
	 * - Valor estático: se devuelve directamente.
	 * - Función: recibe el body de la request y devuelve T.
	 */
	data: T | ((body?: TBody) => T);
	/** Retardo simulado en milisegundos para la respuesta */
	delay?: number;
	/** Tipo de respuesta opcional para sobrescribir el responseType */
	responseType?: ResponseType;
};

/**
 * ======================================================
 * Almacenamiento de mocks
 * ======================================================
 */

// Objeto que almacena todos los mocks registrados
const mockResponses: Record<string, MockEntry> = {};

/**
 * @description
 * Agrega o actualiza un mock para un método y endpoint específicos.
 * @param method Método HTTP ('GET' | 'POST' | ...)
 * @param endpoint Endpoint de la request
 * @param mock MockEntry con datos, delay y status opcional
 */
export function addFakeResponse<TBody = any, T = any>(
	method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
	endpoint: string,
	mock: MockEntry<TBody, T>,
) {
	const key = `${method}:${endpoint}`;
	mockResponses[key] = mock;
}

/**
 * ======================================================
 * Fake Store para cache
 * ======================================================
 */

const fakeLocal = {
	storage: new Map<string, string>(),
	session: new Map<string, string>(),

	/** Verifica si existe un valor en el store especificado */
	has(store: 'storage' | 'session', key: string) {
		return (store === 'storage' ? this.storage : this.session).has(key);
	},

	/** Obtiene un valor del store o null si no existe */
	get(store: 'storage' | 'session', key: string) {
		return (store === 'storage' ? this.storage : this.session).get(key) ?? null;
	},

	/** Establece un valor en el store especificado */
	set(store: 'storage' | 'session', key: string, value: string) {
		(store === 'storage' ? this.storage : this.session).set(key, value);
	},

	/** Elimina un valor del store */
	delete(store: 'storage' | 'session', key: string) {
		(store === 'storage' ? this.storage : this.session).delete(key);
	},
};

/**
 * ======================================================
 * Función principal: fakeHttpClient
 * ======================================================
 */

/**
 * @description
 * Simula un cliente HTTP:
 * - Permite mocks por método/endpoint.
 * - Soporta cache en memoria (storage/session).
 * - Permite transformar datos y simular progreso.
 * @param endpoint URL del endpoint
 * @param options Opciones de configuración (método, body, cache, etc.)
 * @returns HttpResponse con datos simulados
 */
export async function fakeHttpClient<T = any, TBody = unknown>(
	endpoint: string,
	options: HttpClientOptions<TBody, T> = {},
): Promise<HttpResponse<T>> {
	let {
		method = 'GET',
		body,
		timeout = 1000,
		cache = false,
		cacheTtl = 60000,
		cacheStorage = 'session',
		responseType = 'json',
		transform,
		postResponse,
		onProgress,
	} = options;

	// ----------------- Cache -----------------
	const storeKey = `__fake_http_client_${endpoint}`;
	if (cache && fakeLocal.has(cacheStorage, storeKey)) {
		const { data, expires } = JSON.parse(fakeLocal.get(cacheStorage, storeKey) ?? '{}');
		if (Date.now() < expires) {
			return {
				ok: true,
				status: 200,
				data,
				fromCache: true,
			};
		}
		// Expiró cache → eliminar
		fakeLocal.delete(cacheStorage, storeKey);
	}

	// ----------------- Progreso simulado -----------------
	const startTime = Date.now();
	if (onProgress) {
		// Incrementos del 0% al 100% simulando carga
		for (let p = 0; p <= 100; p += 20) {
			await new Promise((r) => setTimeout(r, timeout / 5));
			onProgress(p / 100);
		}
	}

	// ----------------- Revisar mock -----------------
	const key = `${method}:${endpoint}`;
	const mock = mockResponses[key];

	let rawData: any;

	if (mock) {
		// Delay simulado
		if (mock.delay) await new Promise((r) => setTimeout(r, mock.delay));
		// Datos dinámicos o estáticos
		rawData = typeof mock.data === 'function' ? mock.data(body) : mock.data;
		// Sobrescribir responseType si se definió
		if (mock.responseType) responseType = mock.responseType;
	} else {
		// Fallback genérico según responseType
		switch (responseType) {
			case 'json':
				rawData = { message: `Respuesta simulada de ${endpoint}` };
				break;
			case 'text':
				rawData = `Respuesta de texto simulada de ${endpoint}`;
				break;
			case 'blob':
				rawData = new Blob([`Blob simulado de ${endpoint}`]);
				break;
			case 'arrayBuffer':
				rawData = new TextEncoder().encode(`Buffer simulado de ${endpoint}`).buffer;
				break;
			case 'formData':
				rawData = new FormData();
				rawData.append('fake', 'data');
				break;
		}
	}

	// ----------------- Transformación de datos -----------------
	const data = transform ? transform(rawData) : rawData;

	// ----------------- Guardar en cache -----------------
	if (cache) {
		const expires = Date.now() + cacheTtl;
		fakeLocal.set(cacheStorage, storeKey, JSON.stringify({ data, expires }));
	}

	// ----------------- Construir respuesta -----------------
	const response: HttpResponse<T> = {
		ok: true,
		status: 200,
		data,
		url: endpoint,
		duration: Date.now() - startTime,
	};

	return postResponse ? postResponse(response) : response;
}

/**
 * ======================================================
 * API utilitaria
 * ======================================================
 * Métodos abreviados para cada verbo HTTP
 */
export const fakeHttp = {
	get: <T>(url: string, opts?: Omit<HttpClientOptions<undefined, T>, 'method'>) =>
		fakeHttpClient<T>(url, { ...opts, method: 'GET' }),
	post: <T, B = unknown>(url: string, body: B, opts?: Omit<HttpClientOptions<B, T>, 'method' | 'body'>) =>
		fakeHttpClient<T, B>(url, { ...opts, method: 'POST', body }),
	put: <T, B = unknown>(url: string, body: B, opts?: Omit<HttpClientOptions<B, T>, 'method' | 'body'>) =>
		fakeHttpClient<T, B>(url, { ...opts, method: 'PUT', body }),
	patch: <T, B = unknown>(url: string, body: B, opts?: Omit<HttpClientOptions<B, T>, 'method' | 'body'>) =>
		fakeHttpClient<T, B>(url, { ...opts, method: 'PATCH', body }),
	delete: <T>(url: string, opts?: Omit<HttpClientOptions<undefined, T>, 'method'>) =>
		fakeHttpClient<T>(url, { ...opts, method: 'DELETE' }),
};
