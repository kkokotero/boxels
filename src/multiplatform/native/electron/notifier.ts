import type { NotifyOptions } from '@core/client/notifier';

/**
 * Muestra una notificación enriquecida en Electron usando la API nativa `Notification`.
 *
 * Mantiene las mismas características que la implementación en navegador:
 * - Soporte para `sound`, `timeout`, `banner`, `click` y `close`.
 * - Integración con opciones nativas de notificación.
 * - Compatibilidad con datos personalizados (`data`).
 *
 * ### Flujo de funcionamiento:
 * 1. **Compatibilidad:** Verifica si `Notification` está disponible en el contexto de Electron.
 * 2. **Configuración:** Separa propiedades personalizadas (`sound`, `timeout`, `banner`, `click`, `close`, `title`)
 *    de las opciones nativas de `Notification`.
 * 3. **Creación de la notificación:** Instancia una nueva `Notification` con el título y opciones.
 * 4. **Comportamientos extra:**
 *    - Reproduce sonido si `sound` está definido.
 *    - Ejecuta callbacks `click` y `close` si se especifican.
 *    - Cierra automáticamente si `timeout` > 0.
 *
 * @param options Opciones enriquecidas para la notificación.
 * @returns La instancia de `Notification` creada o `undefined` si no fue posible mostrarla.
 */
export async function notify(options: NotifyOptions): Promise<void> {
	// 1. Verificar compatibilidad con Notification en Electron
	if (typeof Notification === 'undefined') {
		console.warn('Las notificaciones no están soportadas en este contexto de Electron.');
		return;
	}

	// 2. Extraer propiedades personalizadas y separar opciones nativas
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

	// Si se especifica un banner, usarlo como imagen grande si el sistema lo soporta
	if (banner) {
		(nativeOptions as NotificationOptions & { image?: string }).image = banner;
	}

	// 3. Crear la notificación
	const electronNotification = new Notification(title, {
		...nativeOptions,
		icon,
		data,
		body,
		badge,
	});

	// 4. Comportamientos extra
	// 4.1 Reproducir sonido si se definió
	if (sound) {
		const audio = new Audio(sound);
		audio
			.play()
			.catch((err) => console.warn('No se pudo reproducir el sonido:', err));
	}

	// 4.2 Vincular evento click
	if (click) {
		electronNotification.addEventListener('click', (e) => click(e, electronNotification));
	}

	// 4.3 Vincular evento close
	if (close) {
		electronNotification.addEventListener('close', (e) => close(e, electronNotification));
	}

	// 4.4 Cierre automático si timeout > 0
	if (timeout && timeout > 0) {
		setTimeout(() => electronNotification.close(), timeout);
	}
}
