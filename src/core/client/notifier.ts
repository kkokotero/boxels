export interface NotifyOptions {
	title: string;
	body?: string;
	icon?: string;
	schedule?: {
		at: Date;
	};
}

export async function notify(
	options: NotifyOptions,
): Promise<void> {
	if (!('Notification' in window)) {
		console.warn('Notificaciones no soportadas.');
		return;
	}

	const permission =
		Notification.permission === 'granted'
			? 'granted'
			: await Notification.requestPermission();

	if (permission === 'granted') {
		new Notification(options.title, options);
	} else {
		console.warn('Permiso de notificación denegado.');
	}
}
