// Importa el plugin de notificaciones locales de Capacitor
import { LocalNotifications } from '@capacitor/local-notifications';
// Importa el tipo que define la estructura de las opciones para notificaciones
import type { NotifyOptions } from '@core/client/notifier';

// Variable de control para inicializar solo una vez las notificaciones
let initialized = false;

/**
 * Envía una notificación local al dispositivo.
 *
 * @param options - Opciones de configuración de la notificación:
 *    - title: Título visible en la notificación
 *    - body: Cuerpo o mensaje (opcional)
 *    - schedule: Información de programación para mostrar la notificación en un momento específico (opcional)
 *    - icon: Icono pequeño a mostrar junto a la notificación (opcional)
 *
 * @returns Promise<void> - Una promesa que se resuelve cuando la notificación se ha programado.
 *
 * Flujo:
 *  1. Si es la primera vez que se usa, solicita permisos y registra tipos de acción.
 *  2. Programa y muestra (inmediata o programada) la notificación local.
 */
export async function notify(options: NotifyOptions): Promise<void> {
	// 1️⃣ Inicialización única de permisos y tipos de notificación
	if (!initialized) {
		// Solicita permiso al usuario para enviar notificaciones
		await LocalNotifications.requestPermissions();

		// Registra un tipo de acción por defecto para las notificaciones
		await LocalNotifications.registerActionTypes({
			types: [
				{
					id: 'default', // Identificador del tipo de acción
					actions: [],   // Lista de acciones disponibles (vacía por ahora)
				},
			],
		});

		// Marca que ya se ha inicializado para no repetir el proceso
		initialized = true;
	}

	// 2️⃣ Programación/envío de la notificación
	await LocalNotifications.schedule({
		notifications: [
			{
				id: Date.now(),               // ID único basado en la marca de tiempo
				title: options.title,         // Título de la notificación
				body: options.body ?? '',     // Mensaje de la notificación (vacío si no se especifica)
				schedule: options.schedule    // Si se pasa, programa para la fecha indicada
					? { at: options.schedule.at }
					: undefined,
				smallIcon: options.icon,      // Icono pequeño (opcional)
				actionTypeId: 'default',      // Tipo de acción registrado previamente
			},
		],
	});
}
