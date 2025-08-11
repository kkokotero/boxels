// Importa el tipo NotifyOptions, que define la estructura de datos
// necesaria para crear una notificación (título, cuerpo, icono, etc.)
import type { NotifyOptions } from '@core/client/notifier';

/**
 * Muestra una notificación del sistema utilizando la API de Notifications.
 * 
 * Esta función es asíncrona para permitir integrarla con flujos que
 * puedan requerir permisos previos o integraciones con APIs que
 * devuelvan promesas (aunque en este caso no se espera ningún valor).
 * 
 * @param options - Objeto de configuración que contiene:
 *   - title: Título de la notificación.
 *   - body: Texto del mensaje.
 *   - icon: Ruta o URL de un icono a mostrar.
 * 
 * Ejemplo de uso:
 * ```ts
 * await notify({
 *   title: 'Nuevo mensaje',
 *   body: 'Tienes un mensaje sin leer',
 *   icon: '/icons/mail.png'
 * });
 * ```
 */
export async function notify(options: NotifyOptions): Promise<void> {
	// Crea una nueva instancia de notificación del sistema.
	// Esta API es nativa de navegadores y entornos como Electron.
	const electronNotification = new Notification(options.title, {
		body: options.body, // Contenido principal del mensaje
		icon: options.icon, // Imagen o icono que se mostrará junto al mensaje
	});

	// Asigna un evento que se ejecutará cuando el usuario haga clic en la notificación
	electronNotification.onclick = () => {
		console.log('Notificación clickeada');
		// Aquí se podría abrir una ventana, redirigir a una sección,
		// o realizar cualquier acción según la lógica de la app.
	};
}
