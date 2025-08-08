// Importaciones necesarias:
// - `Store` es un tipo genérico, no usado directamente aquí.
// - `local` representa un sistema de almacenamiento persistente (localStorage o sessionStorage).
// - `createRange` permite gestionar rangos numéricos, usado para seguimiento del progreso de descarga.
import { type Store, local } from '@data/index';
import { createRange } from '@hooks/styles/range';

// Definición de los métodos HTTP disponibles.
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

// Tipos de respuesta que puede retornar el cliente HTTP.
export type ResponseType =
	| 'json'
	| 'text'
	| 'blob'
	| 'arrayBuffer'
	| 'formData';

// Opciones configurables para realizar una solicitud HTTP.
export interface HttpClientOptions<TBody = unknown, T = unknown> {
	method?: HttpMethod; // Método HTTP (GET, POST, etc.)
	headers?: Record<string, string>; // Encabezados personalizados
	body?: TBody; // Cuerpo de la solicitud
	retries?: number; // Número de reintentos ante fallos
	timeout?: number; // Tiempo máximo de espera antes de abortar (ms)
	signal?: AbortSignal; // Señal externa para cancelar la solicitud
	onProgress?: (percent: number) => void; // Callback para notificar progreso de descarga
	cache?: boolean; // Habilitar caché
	cacheTtl?: number; // Tiempo de vida del caché en ms
	cacheStorage?: 'storage' | 'session'; // Tipo de almacenamiento para el caché
	responseType?: ResponseType; // Tipo de respuesta esperado
	transform?: (raw: any) => T; // Transformación personalizada de la respuesta
	preRequest?: (init: RequestInit) => RequestInit; // Hook para modificar la configuración antes de enviar
	postResponse?: (res: HttpResponse<T>) => HttpResponse<T>; // Hook para modificar la respuesta antes de retornar
	keepalive?: boolean; // Permite mantener la conexión viva para ciertas solicitudes (como durante `unload`)
}

// Representa una respuesta estructurada del cliente HTTP.
export interface HttpResponse<T = unknown> {
	ok: boolean; // Indica si la respuesta fue exitosa (status 2xx)
	status: number; // Código de estado HTTP
	data: T | null; // Datos procesados de la respuesta
	error?: string; // Mensaje de error, si aplica
	fromCache?: boolean; // Indica si la respuesta provino de caché
	headers?: Headers; // Encabezados de respuesta
	url?: string; // URL final de la solicitud
	duration?: number; // Duración total de la solicitud en milisegundos
}

// Combina múltiples señales de abortado en una sola.
function mergeAbortSignals(
	...signals: (AbortSignal | undefined)[]
): AbortSignal {
	const controller = new AbortController();
	signals.forEach((s) =>
		s?.addEventListener('abort', () => controller.abort()),
	);
	return controller.signal;
}

// Genera una clave única para caché basado en el endpoint.
const storeKey = (url: string) => `__http_client_${url}`;

/**
 * Cliente HTTP principal, soporta reintentos, caché, transformación, cancelación, timeout y progreso.
 */
export async function httpClient<T = any, TBody = unknown>(
	endpoint: string,
	options: HttpClientOptions<TBody, T> = {},
): Promise<HttpResponse<T>> {
	const {
		method = 'GET',
		headers = {},
		body,
		retries = 3,
		timeout = 10000,
		signal,
		onProgress,
		cache = false,
		cacheTtl = 60000,
		cacheStorage = 'session',
		responseType = 'json',
		transform,
		preRequest,
		postResponse,
		keepalive = false,
	} = options;

	// Verifica si existe una respuesta en caché válida
	if (cache && local[cacheStorage].has(storeKey(endpoint))) {
		const { data, expires } = JSON.parse(
			local[cacheStorage].get<string>(storeKey(endpoint)) ?? '',
		);
		if (Date.now() < expires)
			return {
				data,
				ok: true,
				status: 200,
				fromCache: true,
			};
		// Elimina si expiró
		local[cacheStorage].delete(storeKey(endpoint));
	}

	let lastError: any = null;
	const startTime = Date.now();
	const progressRange = createRange(0, 1); // Para progreso de descarga

	// Intentos de solicitud con reintento automático (exponential backoff)
	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), timeout);
			const finalSignal = signal
				? mergeAbortSignals(signal, controller.signal)
				: controller.signal;

			// Prepara encabezados y cuerpo
			let fetchHeaders = { ...headers };
			let requestBody: BodyInit | undefined;

			if (body instanceof FormData || body instanceof Blob) {
				requestBody = body;
			} else if (body !== undefined) {
				fetchHeaders['Content-Type'] ||= 'application/json';
				requestBody = JSON.stringify(body);
			}

			let init: RequestInit = {
				method,
				headers: fetchHeaders,
				body: requestBody,
				signal: finalSignal,
				keepalive,
			};

			if (preRequest) init = preRequest(init);

			// Solicitud con fetch
			const res = await fetch(endpoint, init);
			clearTimeout(timeoutId);

			const contentType = res.headers.get('Content-Type') || '';
			let rawData: any = null;

			// Si se desea obtener progreso de descarga
			if (onProgress && res.body) {
				const reader = res.body.getReader();
				const contentLength = +res.headers.get('Content-Length')! || 0;
				progressRange.max = contentLength === 0 ? 1 : contentLength;
				let received = 0;
				const chunks: Uint8Array[] = [];

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					if (value) {
						chunks.push(value);
						if (contentLength > 0) {
							received += value.length;
							progressRange.percent(received);
							onProgress(progressRange.current());
						}
					}
				}

				const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
				const merged = new Uint8Array(totalSize);
				let offset = 0;
				for (const chunk of chunks) {
					merged.set(chunk, offset);
					offset += chunk.length;
				}

				// Manejo según responseType
				switch (responseType) {
					case 'blob':
						rawData = new Blob([merged], { type: contentType });
						break;
					case 'arrayBuffer':
						rawData = merged.buffer;
						break;
					case 'text':
						rawData = new TextDecoder().decode(merged);
						break;
					case 'json': {
						const text = new TextDecoder().decode(merged);
						rawData =
							contentType.includes('application/json') && text
								? JSON.parse(text)
								: text;
						break;
					}
					default:
						rawData = merged;
						break;
				}
			} else {
				// Modo normal de lectura según tipo esperado
				switch (responseType) {
					case 'text':
						rawData = await res.text();
						break;
					case 'blob':
						rawData = await res.blob();
						break;
					case 'formData':
						rawData = await res.formData();
						break;
					case 'arrayBuffer':
						rawData = await res.arrayBuffer();
						break;
					default: // json por defecto
						rawData = await res.text();
						if (contentType.includes('application/json')) {
							rawData = rawData ? JSON.parse(rawData) : null;
						}
						break;
				}
			}

			// Aplica transformación si se especificó
			let data = transform ? transform(rawData) : rawData;

			// Guarda en caché si está habilitado y fue exitoso
			if (cache && res.ok) {
				const expires = Date.now() + cacheTtl;
				local[cacheStorage].set(
					storeKey(endpoint),
					JSON.stringify({ data, expires }),
				);
			}

			const response: HttpResponse<T> = {
				ok: res.ok,
				status: res.status,
				data,
				headers: res.headers,
				url: res.url,
				duration: Date.now() - startTime,
			};

			// Aplica post-procesamiento si se definió
			return postResponse ? postResponse(response) : response;
		} catch (err: any) {
			lastError = err;
			if (err.name === 'AbortError') break; // Abortar no reintenta
			await new Promise((r) => setTimeout(r, 100 * 2 ** attempt)); // Espera con backoff exponencial
		}
	}

	// Si todos los intentos fallaron
	return {
		ok: false,
		status: 0,
		data: null,
		error: lastError?.message || 'Request failed',
		duration: Date.now() - startTime,
	};
}

// API utilitaria basada en métodos HTTP para facilitar uso
export const http = {
	// Método GET
	get: <T>(
		url: string,
		opts?: Omit<HttpClientOptions<undefined, T>, 'method'>,
	) => httpClient<T>(url, { ...opts, method: 'GET' }),

	// Método POST
	post: <T, B = unknown>(
		url: string,
		body: B,
		opts?: Omit<HttpClientOptions<B, T>, 'method' | 'body'>,
	) => httpClient<T, B>(url, { ...opts, method: 'POST', body }),

	// Método PUT
	put: <T, B = unknown>(
		url: string,
		body: B,
		opts?: Omit<HttpClientOptions<B, T>, 'method' | 'body'>,
	) => httpClient<T, B>(url, { ...opts, method: 'PUT', body }),

	// Método PATCH
	patch: <T, B = unknown>(
		url: string,
		body: B,
		opts?: Omit<HttpClientOptions<B, T>, 'method' | 'body'>,
	) => httpClient<T, B>(url, { ...opts, method: 'PATCH', body }),

	// Método DELETE
	delete: <T>(
		url: string,
		opts?: Omit<HttpClientOptions<undefined, T>, 'method'>,
	) => httpClient<T>(url, { ...opts, method: 'DELETE' }),
};
