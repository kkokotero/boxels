import { autoCleanup } from '@core/cleanup';
import type { Hook } from '@hooks/hook';

/**
 * Representa un mensaje genérico recibido o enviado por WebSocket.
 * @template T Tipo de los datos contenidos en el mensaje.
 */
type WSMessage<T = unknown> = {
	type: string; // Tipo o nombre del mensaje (puede usarse como identificador de acción)
	data: T; // Datos enviados o recibidos
};

/**
 * Tipo de función que maneja mensajes o eventos.
 * @template T Tipo de datos que recibirá el handler.
 */
type MessageHandler<T = unknown> = (data: T) => void;

/**
 * Mapeo de eventos que puede emitir el WSClient.
 * Cada clave representa un evento y su valor el tipo de datos asociados.
 */
type WSEventMap = {
	open: void; // Cuando la conexión se abre exitosamente.
	close: CloseEvent; // Cuando la conexión se cierra.
	error: Event; // Cuando ocurre un error de WebSocket.
	message: WSMessage; // Cuando se recibe un mensaje válido.
	reconnect: { attempt: number }; // Cuando se intenta reconectar, indicando el número de intento.
	retry: { attempt: number; delay: number }; // Antes de reconectar, indicando intento y delay.
	maxRetriesReached: void; // Cuando se alcanzó el máximo de intentos de reconexión.
};

/**
 * Opciones configurables para la conexión WebSocket.
 */
interface WSOptions {
	reconnect?: boolean; // Reconectar automáticamente si la conexión se cierra.
	maxRetries?: number; // Máximo número de intentos de reconexión.
	retryDelay?: number; // Tiempo de espera entre intentos de reconexión (en milisegundos).
}

/**
 * Implementación de un cliente WebSocket con:
 * - Tipado estricto en eventos y mensajes.
 * - Sistema de suscripción a eventos (on/emit).
 * - Reconexión automática configurable.
 * - Soporte para múltiples tipos de eventos personalizados.
 */
export class WSClient implements Hook {
	private socket?: WebSocket; // Instancia nativa de WebSocket.
	private url: string; // URL del servidor WebSocket.
	private options: Required<WSOptions>; // Opciones de conexión con valores por defecto.
	private retries = 0; // Contador de intentos de reconexión.
	private listeners: {
		[K in keyof WSEventMap]?: MessageHandler<WSEventMap[K]>[];
	} = {}; // Registro de listeners por tipo de evento.

	/**
	 * Crea un nuevo cliente WebSocket tipado.
	 * @param url URL del servidor WebSocket.
	 * @param options Opciones opcionales de configuración.
	 */
	constructor(url: string, options?: WSOptions) {
		this.url = url;
		this.options = {
			reconnect: options?.reconnect ?? true, // Por defecto reconectar.
			maxRetries: options?.maxRetries ?? 5, // Máx. 5 intentos.
			retryDelay: options?.retryDelay ?? 2000, // Esperar 2 segundos entre intentos.
		};

		autoCleanup(this).onCleanup(() => this.destroy());
	}

	/**
	 * Inicia la conexión WebSocket.
	 * Si la conexión se cierra y está habilitada la reconexión, intenta reconectar.
	 */
	connect() {
		this.socket = new WebSocket(this.url);

		// Evento: conexión establecida.
		this.socket.onopen = () => {
			console.info('[WS] Conectado');
			this.retries = 0; // Reinicia contador de intentos.
			this.emit('open', undefined); // Notifica apertura.
		};

		// Evento: mensaje recibido.
		this.socket.onmessage = (event) => {
			try {
				const msg: WSMessage = JSON.parse(event.data); // Intenta parsear a WSMessage.
				this.emit('message', msg);
			} catch (err) {
				console.error('[WS] Error parseando mensaje:', err);
			}
		};

		// Evento: conexión cerrada.
		this.socket.onclose = (ev) => {
			this.emit('close', ev);

			// Si la reconexión está habilitada y no se ha alcanzado el máximo de intentos:
			if (this.options.reconnect && this.retries < this.options.maxRetries) {
				this.retries++;
				this.emit('retry', {
					attempt: this.retries,
					delay: this.options.retryDelay,
				});

				// Espera el tiempo configurado y luego intenta reconectar.
				setTimeout(() => {
					this.emit('reconnect', { attempt: this.retries });
					this.connect();
				}, this.options.retryDelay);
			}
			// Si se alcanzó el máximo de intentos:
			else if (this.retries >= this.options.maxRetries) {
				this.emit('maxRetriesReached', undefined);
			}
		};

		// Evento: error en WebSocket.
		this.socket.onerror = (err) => {
			this.emit('error', err);
		};
	}

	/**
	 * Permite suscribirse a un evento específico del WSClient.
	 * @param event Nombre del evento.
	 * @param handler Función a ejecutar cuando ocurra el evento.
	 */
	on<K extends keyof WSEventMap>(
		event: K,
		handler: MessageHandler<WSEventMap[K]>,
	) {
		if (!this.listeners[event]) {
			this.listeners[event] = [];
		}
		this.listeners[event]!.push(handler);
	}

	/**
	 * Dispara un evento manualmente y ejecuta todos los handlers suscritos.
	 * @param event Nombre del evento.
	 * @param data Datos asociados al evento.
	 */
	private emit<K extends keyof WSEventMap>(event: K, data: WSEventMap[K]) {
		this.listeners[event]?.forEach((handler) => handler(data));
	}

	/**
	 * Envía un mensaje tipado por WebSocket.
	 * @param data Datos a enviar, se serializan a JSON automáticamente.
	 */
	send<T>(data: T) {
		if (this.socket?.readyState === WebSocket.OPEN) {
			this.socket.send(JSON.stringify(data));
		} else {
			console.warn('[WS] No se puede enviar, conexión cerrada.');
		}
	}

	/**
	 * Cierra la conexión y desactiva la reconexión automática.
	 */
	destroy() {
		this.options.reconnect = false;
		this.socket?.close();
	}
}

/**
 * Función auxiliar para crear un WSClient de forma rápida.
 */
export const createWebSocket = (url: string, options?: WSOptions) =>
	new WSClient(url, options);
