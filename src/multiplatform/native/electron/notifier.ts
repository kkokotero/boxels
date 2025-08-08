import type { NotifyOptions } from '@core/client/notifier';

export async function notify(options: NotifyOptions): Promise<void> {
	const electronNotification = new Notification(options.title, {
		body: options.body,
		icon: options.icon,
	});
	electronNotification.onclick = () => {
		console.log('Notificación clickeada');
	};
}
