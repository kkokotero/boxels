import type { BoxelsElement } from '@dom/elements/types';
import { isSignal, type ReactiveSignal } from './reactive/types';

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

type ModifierKey =
	| 'ctrl'
	| 'alt'
	| 'shift'
	| 'meta' // (⌘ en Mac, Windows en PC)
	| 'altgr'; // Alt derecho (teclados internacionales)

type SpecialKey =
	// control básico
	| 'escape'
	| 'enter'
	| 'tab'
	| 'backspace'
	| 'delete'
	| 'insert'
	| 'capslock'
	| 'numlock'
	| 'scrolllock'
	| 'pause'
	| 'printscreen'
	| 'contextmenu'

	// espacio
	| 'space'

	// flechas
	| 'arrowup'
	| 'arrowdown'
	| 'arrowleft'
	| 'arrowright'

	// navegación
	| 'home'
	| 'end'
	| 'pageup'
	| 'pagedown'

	// edición
	| 'select'
	| 'help'
	| 'clear'

	// funciones F1–F24
	| 'f1'
	| 'f2'
	| 'f3'
	| 'f4'
	| 'f5'
	| 'f6'
	| 'f7'
	| 'f8'
	| 'f9'
	| 'f10'
	| 'f11'
	| 'f12'
	| 'f13'
	| 'f14'
	| 'f15'
	| 'f16'
	| 'f17'
	| 'f18'
	| 'f19'
	| 'f20'
	| 'f21'
	| 'f22'
	| 'f23'
	| 'f24';

type AlphaNumericKey =
	| 'a'
	| 'b'
	| 'c'
	| 'd'
	| 'e'
	| 'f'
	| 'g'
	| 'h'
	| 'i'
	| 'j'
	| 'k'
	| 'l'
	| 'm'
	| 'n'
	| 'ñ'
	| 'o'
	| 'p'
	| 'q'
	| 'r'
	| 's'
	| 't'
	| 'u'
	| 'v'
	| 'w'
	| 'x'
	| 'y'
	| 'z'
	| '0'
	| '1'
	| '2'
	| '3'
	| '4'
	| '5'
	| '6'
	| '7'
	| '8'
	| '9';

type SymbolKey =
	// fila superior
	| '`'
	| '~'
	| '!'
	| '@'
	| '#'
	| '$'
	| '%'
	| '^'
	| '&'
	| '*'
	| '('
	| ')'
	| '-'
	| '_'
	| '='
	| '+'

	// puntuación
	| '['
	| '{'
	| ']'
	| '}'
	| ';'
	| ':'
	| "'"
	| '"'
	| ','
	| '<'
	| '.'
	| '>'
	| '/'
	| '?'
	| '\\'
	| '|'

	// teclas adicionales ISO/ABNT
	| '¡'
	| '¿' // español
	| '§'
	| '±'; // símbolos internacionales

type NumpadKey =
	| 'numpad0'
	| 'numpad1'
	| 'numpad2'
	| 'numpad3'
	| 'numpad4'
	| 'numpad5'
	| 'numpad6'
	| 'numpad7'
	| 'numpad8'
	| 'numpad9'
	| 'numpadadd'
	| 'numpadsubtract'
	| 'numpadmultiply'
	| 'numpaddivide'
	| 'numpaddecimal'
	| 'numpadenter'
	| 'numpadclear'
	| 'numpadequals'; // (en algunos Mac y teclados extendidos)

export type ComboKey =
	| ModifierKey
	| SpecialKey
	| AlphaNumericKey
	| SymbolKey
	| NumpadKey;

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

	let titleUnsubscribe: (() => void) | null = null;

	/**
	 * Obtiene o establece el título del documento.
	 * - Si no recibe parámetros, devuelve el título actual.
	 * - Si recibe un string, establece un nuevo título estático.
	 * - Si recibe un signal o función, lo vincula de forma reactiva y
	 *   actualiza el título cada vez que cambie.
	 */
	function title(
		newTitle?: string | ReactiveSignal<string> | (() => string),
	): string {
		// Getter
		if (newTitle === undefined) return document.title;

		// Limpia suscripción previa
		if (titleUnsubscribe) {
			titleUnsubscribe();
			titleUnsubscribe = null;
		}

		// Caso string estático
		if (typeof newTitle === 'string') {
			document.title = newTitle;
			return document.title;
		}

		// Caso signal
		if (isSignal(newTitle)) {
			titleUnsubscribe = newTitle.subscribe((val) => {
				document.title = val ?? '';
			});
			// setear inicial
			document.title = newTitle();
			return document.title;
		}

		// Caso función "computed"
		if (typeof newTitle === 'function') {
			const computeAndSet = () => {
				document.title = newTitle() ?? '';
			};
			computeAndSet();

			// Si la función depende de signals, podemos wrappearla con un autorun
			// (ej. si tienes un sistema de tracking/autorun en tu reactive core).
			// Si no, basta con ejecutarla una vez.
			// 👇 Si tu core tiene algo como `autorun`, úsalo aquí:
			/*
		titleUnsubscribe = autorun(computeAndSet);
		*/

			return document.title;
		}

		return document.title;
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
	 * Escucha un evento de teclado filtrando por una lista de teclas/modificadores.
	 * Ej: ["ctrl", "s"], ["shift", "alt", "arrowup"], ["escape"]
	 */
	function onKeyCombo(
		element: BoxelsElement | Window | Document | HTMLElement,
		keys: ComboKey[],
		cb: (event: KeyboardEvent) => void,
		options?: boolean | AddEventListenerOptions,
	): () => void {
		const normalized = keys.map((k) => k.toLowerCase());

		const handler = (event: KeyboardEvent) => {
			const expected = {
				ctrl: normalized.includes('ctrl'),
				alt: normalized.includes('alt'),
				shift: normalized.includes('shift'),
				meta: normalized.includes('meta'),
			};
			const mainKey = normalized.find(
				(k) => !['ctrl', 'alt', 'shift', 'meta'].includes(k),
			);

			if (
				expected.ctrl === event.ctrlKey &&
				expected.alt === event.altKey &&
				expected.shift === event.shiftKey &&
				expected.meta === event.metaKey &&
				(!mainKey || event.key.toLowerCase() === mainKey)
			) {
				cb(event);
			}
		};

		// Normalizamos el target (para soportar BoxelsElement)
		const target: any =
			typeof (element as any).addEventListener === 'function'
				? element
				: (element as any).el;

		if (!target || typeof target.addEventListener !== 'function') {
			throw new Error(
				'El elemento proporcionado no soporta eventos de teclado',
			);
		}

		target.addEventListener('keydown', handler, options);
		return () => target.removeEventListener('keydown', handler, options);
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
		onKeyCombo,
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
