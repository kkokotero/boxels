/**
 * Opciones para mostrar una notificación en el navegador.
 */
export interface NotifyOptions {
	/** Título principal de la notificación (obligatorio). */
	title: string;
	/** Texto adicional que se mostrará en el cuerpo de la notificación (opcional). */
	body?: string;
	/** URL o ruta de un ícono para mostrar junto a la notificación (opcional). */
	icon?: string;
	/**
	 * Programación opcional de la notificación.
	 * Permite definir una fecha/hora específica para mostrarla.
	 * (En esta implementación, la programación no se maneja automáticamente;
	 * se debería implementar aparte si se quiere usar).
	 */
	schedule?: {
		at: Date;
	};
}

/**
 * Muestra una notificación en el navegador utilizando la API `Notification`.
 *
 * @param options - Configuración de la notificación (título, cuerpo, icono y programación).
 * @returns Una promesa que se resuelve cuando la notificación es mostrada o el permiso es denegado.
 *
 * @remarks
 * - Si el navegador no soporta la API de notificaciones, se mostrará una advertencia en consola.
 * - Si el permiso no está otorgado, se solicitará al usuario.
 * - Esta función no implementa directamente la programación (`schedule.at`), 
 *   pero se deja en las opciones para integraciones futuras.
 */
export async function notify(
	options: NotifyOptions,
): Promise<void> {
	// Verificar si el navegador soporta la API de notificaciones.
	if (!('Notification' in window)) {
		console.warn('Notificaciones no soportadas.');
		return;
	}

	// Verificar o solicitar permiso al usuario para mostrar notificaciones.
	const permission =
		Notification.permission === 'granted'
			? 'granted'
			: await Notification.requestPermission();

	// Si el permiso fue otorgado, crear y mostrar la notificación.
	if (permission === 'granted') {
		new Notification(options.title, options);
	} else {
		// Si el permiso fue denegado o no concedido, mostrar advertencia.
		console.warn('Permiso de notificación denegado.');
	}
}
