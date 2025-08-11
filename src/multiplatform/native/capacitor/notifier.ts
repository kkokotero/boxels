import { LocalNotifications } from '@capacitor/local-notifications';
import type { NotifyOptions } from '@core/client/notifier';

// Control para inicializar notificaciones solo una vez
let initialized = false;

/**
 * Muestra una notificación local en un dispositivo móvil usando Capacitor.
 *
 * Mantiene la misma API y características clave que la implementación web/Electron:
 * - Soporte para `sound`, `timeout`, `click` y `close`.
 * - Soporte para imágenes grandes (`banner`) e íconos (`icon`).
 * - Datos personalizados (`data`).
 *
 * ### Flujo de funcionamiento:
 * 1. **Inicialización** (solo la primera vez):
 *    - Solicita permisos al usuario para enviar notificaciones.
 *    - Registra tipos de acción básicos.
 * 2. **Configuración de opciones**:
 *    - Usa las propiedades definidas en `NotifyOptions` (ej. `title`, `body`, `icon`, `banner`, `sound`).
 * 3. **Programación/envío**:
 *    - Muestra la notificación inmediatamente o en la fecha/hora indicada por `options.schedule`.
 * 4. **Comportamientos extra**:
 *    - Reproduce un sonido si `sound` está definido.
 *    - Simula eventos `click` y `close` mediante listeners de Capacitor.
 *    - Si `timeout` > 0, programa el cierre automático.
 *
 * @param options Opciones enriquecidas para la notificación.
 * @returns Promesa resuelta al programar/mostrar la notificación.
 */
export async function notify(options: NotifyOptions): Promise<void> {
	// Inicialización única
	if (!initialized) {
		await LocalNotifications.requestPermissions();

		await LocalNotifications.registerActionTypes({
			types: [
				{
					id: 'default',
					actions: [], // Se pueden agregar acciones personalizadas aquí
				},
			],
		});

		initialized = true;
	}

	// Extraer opciones personalizadas
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
		...rest
	} = options;

	// Programar la notificación
	const notificationId = Date.now(); // ID único
	await LocalNotifications.schedule({
		notifications: [
			{
				id: notificationId,
				title,
				body: body ?? '',
				smallIcon: icon,
				largeIcon: banner, // No estándar, pero en Android algunos sistemas la muestran
				sound,
				extra: { ...data, ...rest },
				actionTypeId: 'default',
				schedule: {
					at: new Date(),
				},
			},
		],
	});

	// Reproducir sonido manualmente si se especifica y el sistema no lo hace automáticamente
	if (sound) {
		try {
			const audio = new Audio(sound);
			await audio.play();
		} catch (err) {
			console.warn('No se pudo reproducir el sonido personalizado:', err);
		}
	}

	// Listeners para simular click/cierre
	if (click) {
		LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
			if (event.notification.id === notificationId) {
				click(new Event('click'), {} as Notification); // Mock Notification para mantener la API
			}
		});
	}

	if (close) {
		LocalNotifications.addListener('localNotificationReceived', (event) => {
			// No hay evento de "close" nativo en Capacitor, se podría simular si es necesario
			// con timeout o tracking de estado
			if (timeout && timeout > 0) {
				setTimeout(() => {
					close(new Event('close'), {} as Notification);
				}, timeout);
			}
		});
	}

	// Cierre automático (simulado)
	if (timeout && timeout > 0) {
		setTimeout(async () => {
			await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
		}, timeout);
	}
}
