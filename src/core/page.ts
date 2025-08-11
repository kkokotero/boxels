/**
 * Opciones para abrir una nueva ventana/pestaña.
 */
type OpenOpts = {
	width?: number; // Ancho de la ventana
	height?: number; // Alto de la ventana
	float?: boolean; // Si la ventana debe abrir sin barras de navegación ni menús
	top?: number; // Posición vertical en la pantalla
	left?: number; // Posición horizontal en la pantalla
};

type EventTargetType = Window | Document | HTMLElement;

// Tipado condicional para eventos según el target
type EventMapFor<T> = T extends Window
	? WindowEventMap
	: T extends Document
		? DocumentEventMap
		: T extends HTMLElement
			? HTMLElementEventMap
			: never;

/**
 * Tipo de callback para manejar mensajes recibidos por postMessage.
 * @template T Tipo de datos esperados en el payload.
 */
type MsgCallback<T = unknown> = (payload: T, event: MessageEvent) => void;

/**
 * Módulo `page`: utilidades para manipular y consultar el estado de la página,
 * incluyendo título, visibilidad, ventanas emergentes, mensajes entre ventanas,
 * control de fullscreen, scroll, recarga, vibración, etc.
 */
export const page = (() => {
	/**
	 * Diccionario de listeners agrupados por tipo de mensaje.
	 * Cada clave es el tipo de evento y el valor es un array de callbacks.
	 */
	const listeners: Record<string, MsgCallback<any>[]> = {};

	/**
	 * Obtiene o establece el título del documento.
	 * @overload Si no recibe parámetros, devuelve el título actual.
	 * @overload Si recibe un string, establece un nuevo título.
	 */
	function title(): string;
	function title(newTitle: string): void;
	function title(newTitle?: string): string | void {
		if (newTitle === undefined) return document.title;
		document.title = newTitle;
	}

	/**
	 * Activa la vibración del dispositivo, si es compatible.
	 * @param pattern Duración o patrón de vibración en milisegundos.
	 * @returns true si la vibración fue activada, false si no es soportada.
	 */
	function vibrate(pattern: number | number[]): boolean {
		if ('vibrate' in navigator) return navigator.vibrate(pattern);
		console.warn('No vibrate support');
		return false;
	}

	/**
	 * Abre una nueva ventana o pestaña con opciones configurables.
	 * @param url URL a abrir.
	 * @param name Nombre o target de la ventana (por defecto `_blank`).
	 * @param opts Opciones de apertura como tamaño y posición.
	 */
	function open(url = '', name = '_blank', opts: OpenOpts = {}): Window | null {
		const { width = 800, height = 600, float = false, top, left } = opts;
		let specs = `width=${width},height=${height},resizable=yes,scrollbars=yes`;
		if (float) specs += ',toolbar=no,menubar=no,location=no,status=no';
		if (top !== undefined) specs += `,top=${top}`;
		if (left !== undefined) specs += `,left=${left}`;
		return window.open(url, name, specs);
	}

	/**
	 * Envía un mensaje a otra ventana usando postMessage.
	 * @param target Ventana destino.
	 * @param type Tipo de mensaje.
	 * @param payload Datos a enviar.
	 * @param origin Origen permitido (por defecto '*').
	 */
	function emit<T = unknown>(
		target: Window | null,
		type: string,
		payload?: T,
		origin = '*',
	): void {
		if (target?.postMessage) {
			target.postMessage({ type, payload }, origin);
		} else {
			console.warn('Invalid target window');
		}
	}

	/**
	 * Escucha mensajes recibidos desde otras ventanas por postMessage.
	 * @param type Tipo de mensaje a escuchar.
	 * @param cb Callback que se ejecuta cuando llega el mensaje.
	 * @param options Opciones para addEventListener.
	 * @returns Función para desuscribirse.
	 */
	function on<T = unknown>(
		type: string,
		cb: MsgCallback<T>,
		options?: boolean | AddEventListenerOptions,
	): () => void {
		// Registra el listener global si es el primer evento registrado
		if (Object.keys(listeners).length === 0) {
			window.addEventListener('message', handle, options);
		}

		if (!listeners[type]) {
			listeners[type] = [];
		}
		listeners[type].push(cb);

		// Retorna función de limpieza
		return () => {
			const arr = listeners[type];
			if (!arr) return;

			const index = arr.indexOf(cb);
			if (index !== -1) arr.splice(index, 1);

			// Si no quedan listeners registrados, elimina el listener global
			if (Object.values(listeners).every((a) => a.length === 0)) {
				window.removeEventListener('message', handle, options);
			}
		};
	}

	/**
	 * Handler central para eventos de tipo "message".
	 */
	function handle(event: MessageEvent) {
		if (!event.data || typeof event.data !== 'object') return;
		const { type, payload } = event.data as {
			type?: string;
			payload?: unknown;
		};
		if (!type) return;

		const arr = listeners[type];
		if (!arr) return;

		for (const cb of arr) {
			cb(payload, event);
		}
	}

	/**
	 * Indica si la página está visible en este momento.
	 */
	function visible(): boolean {
		return !document.hidden;
	}

	/**
	 * Escucha cambios en la visibilidad de la página.
	 * @param cb Callback que recibe true si está visible, false si está oculta.
	 * @returns Función para desuscribirse.
	 */
	function onVisible(cb: (visible: boolean) => void): () => void {
		const handler = () => cb(!document.hidden);
		document.addEventListener('visibilitychange', handler);
		return () => document.removeEventListener('visibilitychange', handler);
	}

	/**
	 * Solicita que un elemento (o toda la página) entre en modo fullscreen.
	 * @param el Elemento a poner en fullscreen (por defecto el documento entero).
	 */
	function fullscreen(
		el: HTMLElement = document.documentElement,
	): Promise<void> {
		if (el.requestFullscreen) return el.requestFullscreen();
		return Promise.reject('No fullscreen support');
	}

	/**
	 * Sale del modo fullscreen.
	 */
	function exitFullscreen(): Promise<void> {
		if (document.exitFullscreen) return document.exitFullscreen();
		return Promise.reject('No fullscreen support');
	}

	/**
	 * Indica si actualmente la página está en fullscreen.
	 */
	function isFullscreen(): boolean {
		return !!document.fullscreenElement;
	}

	/**
	 * Hace scroll hasta la parte superior de la página.
	 * @param behavior Tipo de desplazamiento ('smooth' o 'auto').
	 */
	function scrollTop(behavior: ScrollBehavior = 'smooth'): void {
		window.scrollTo({ top: 0, behavior });
	}

	/**
	 * Hace scroll hasta la parte inferior de la página.
	 * @param behavior Tipo de desplazamiento ('smooth' o 'auto').
	 */
	function scrollBottom(behavior: ScrollBehavior = 'smooth'): void {
		window.scrollTo({ top: document.body.scrollHeight, behavior });
	}

	/**
	 * Recarga la página actual.
	 */
	function reload(): void {
		window.location.reload();
	}

	/**
	 * Indica si el script se está ejecutando dentro de un iframe.
	 */
	function inIframe(): boolean {
		return window.self !== window.top;
	}

	/**
	 * Escucha un evento de teclado filtrando por tecla o combinación de teclas con "+".
	 * Ej: "Ctrl+S", "Shift+Alt+ArrowUp", "Escape"
	 */
	function onKey(
		combo: string,
		cb: (event: KeyboardEvent) => void,
		options?: boolean | AddEventListenerOptions,
	): () => void {
		// Normalizamos la combinación
		const parts = combo
			.toLowerCase()
			.split('+')
			.map((k) => k.trim());
		const mainKey = parts.find(
			(k) => !['ctrl', 'alt', 'shift', 'meta'].includes(k),
		);
		const modifiers = {
			ctrl: parts.includes('ctrl'),
			alt: parts.includes('alt'),
			shift: parts.includes('shift'),
			meta: parts.includes('meta'), // Command en Mac
		};

		const handler = (event: KeyboardEvent) => {
			if (
				modifiers.ctrl === event.ctrlKey &&
				modifiers.alt === event.altKey &&
				modifiers.shift === event.shiftKey &&
				modifiers.meta === event.metaKey &&
				(!mainKey || event.key.toLowerCase() === mainKey)
			) {
				cb(event);
			}
		};

		window.addEventListener('keydown', handler, options);
		return () => window.removeEventListener('keydown', handler, options);
	}

	/**
	 * Escucha un evento y devuelve una función para desuscribirse.
	 * Detecta el tipo de evento según el target pasado.
	 */
	function onEvent<T extends EventTargetType, K extends keyof EventMapFor<T>>(
		target: T,
		type: K,
		cb: (event: EventMapFor<T>[K]) => void,
		options?: boolean | AddEventListenerOptions,
	): () => void {
		target.addEventListener(type as string, cb as EventListener, options);
		return () =>
			target.removeEventListener(type as string, cb as EventListener, options);
	}

	return {
		onEvent,
		onKey,
		title,
		vibrate,
		open,
		emit,
		on,
		visible,
		onVisible,
		fullscreen,
		exitFullscreen,
		isFullscreen,
		scrollTop,
		scrollBottom,
		reload,
		inIframe,
	};
})();
