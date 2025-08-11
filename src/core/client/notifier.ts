/**
 * Opciones enriquecidas para mostrar una notificación en el navegador.
 *
 * Esta interfaz extiende la API nativa de `Notification` (mediante `NotificationOptions`)
 * y agrega propiedades adicionales para mejorar la experiencia del usuario:
 * - **Control de sonido** al mostrar la notificación.
 * - **Duración personalizada** (timeout) antes de cerrarse.
 * - **Compatibilidad con banners** o imágenes grandes.
 * - **Callbacks** para manejar eventos de click y cierre.
 * 
 * Esto permite crear notificaciones más interactivas y adaptadas al contexto de la aplicación.
 */
export interface NotifyOptions extends NotificationOptions {
	/** Título visible en la notificación (obligatorio). */
	title: string;

	/** Texto principal que acompaña al título en la notificación. */
	body?: string;

	/** URL de un ícono pequeño que se muestra junto al título. */
	badge?: string;

	/** URL de un sonido que se reproducirá al mostrarse la notificación. */
	sound?: string;

	/**
	 * Tiempo en milisegundos antes de cerrar automáticamente la notificación.
	 * 
	 * - `> 0` → Se cierra automáticamente pasado ese tiempo.
	 * - `0` o `undefined` → La notificación será persistente hasta que el usuario la cierre.
	 */
	timeout?: number;

	/**
	 * Función opcional que se ejecuta cuando el usuario hace click en la notificación.
	 * @param event Evento `click` de la notificación.
	 * @param notification Instancia de la notificación clicada.
	 */
	click?: (event: Event, notification: Notification) => void;

	/**
	 * Función opcional que se ejecuta cuando el usuario cierra la notificación.
	 * @param event Evento `close` de la notificación.
	 * @param notification Instancia de la notificación cerrada.
	 */
	close?: (event: Event, notification: Notification) => void;

	/** URL de una imagen grande para enriquecer el contenido visual (banner). */
	banner?: string;

	/** URL del ícono que se mostrará en la notificación. */
	icon?: string;

	/** Datos adicionales que se pueden asociar a la notificación para su posterior uso. */
	data?: Record<string, any>;
}

/**
 * Muestra una notificación enriquecida en el navegador usando la API nativa `Notification`.
 *
 * ### Flujo de ejecución:
 * 1. **Compatibilidad:** Comprueba si `Notification` está disponible en el navegador.
 * 2. **Permisos:** Solicita al usuario permiso para mostrar notificaciones.
 * 3. **Configuración:** 
 *    - Separa las opciones personalizadas (`sound`, `timeout`, `banner`, `click`, `close`, `title`)
 *      de las opciones nativas (`NotificationOptions`).
 *    - Si `banner` está definido, lo asigna como `image` (o `icon` si no es soportado).
 * 4. **Creación:** Instancia un nuevo `Notification` con el título y opciones configuradas.
 * 5. **Extras:**
 *    - Reproduce el sonido si `sound` está definido.
 *    - Registra listeners para `click` y `close` si se especifican callbacks.
 *    - Configura el cierre automático si `timeout` es mayor que 0.
 *
 * @param options Opciones enriquecidas para la notificación.
 * @returns La instancia de `Notification` creada o `undefined` si no se pudo mostrar.
 */
export async function notify(options: NotifyOptions) {
	// 1. Verificar compatibilidad con la API de notificaciones
	if (!('Notification' in window)) {
		console.warn('Las notificaciones no están soportadas en este navegador.');
		return;
	}

	// 2. Solicitar permiso al usuario
	const permission = await Notification.requestPermission();

	if (permission === 'denied') {
		console.warn('El usuario bloqueó las notificaciones.');
		return;
	}
	if (permission === 'default') {
		console.warn('El usuario no aceptó las notificaciones.');
		return;
	}

	// 3. Extraer propiedades personalizadas y separar las nativas
	const {
		sound,
		timeout,
		banner,
		click,
		close,
		title,
		icon,
		data,
		body,
		badge,
		...nativeOptions
	} = options;

	// Si se especifica un banner, asignarlo como imagen (no estándar pero soportado en algunos navegadores)
	if (banner) {
		(nativeOptions as NotificationOptions & { image?: string }).image = banner;
	}

	// 4. Crear la notificación con el título y opciones nativas
	const notification = new Notification(title, {
		...nativeOptions,
		icon,
		data,
		body,
		badge,
	});

	// 5. Funcionalidades extra
	// 5.1 Reproducir sonido
	if (sound) {
		const audio = new Audio(sound);
		audio
			.play()
			.catch((err) => console.warn('No se pudo reproducir el sonido:', err));
	}

	// 5.2 Callback de click
	if (click) {
		notification.addEventListener('click', (e) => click(e, notification));
	}

	// 5.3 Callback de cierre
	if (close) {
		notification.addEventListener('close', (e) => close(e, notification));
	}

	// 5.4 Cierre automático si timeout > 0
	if (timeout && timeout > 0) {
		setTimeout(() => notification.close(), timeout);
	}

	return notification;
}
