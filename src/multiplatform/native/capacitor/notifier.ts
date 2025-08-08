import { LocalNotifications } from '@capacitor/local-notifications';
import type { NotifyOptions } from '@core/client/notifier';

let initialized = false;

export async function notify(options: NotifyOptions): Promise<void> {
	if (!initialized) {
		await LocalNotifications.requestPermissions();
		await LocalNotifications.registerActionTypes({
			types: [{ id: 'default', actions: [] }],
		});
		initialized = true;
	}

	await LocalNotifications.schedule({
		notifications: [
			{
				id: Date.now(), // único
				title: options.title,
				body: options.body ?? '',
				schedule: options.schedule
					? { at: options.schedule.at }
					: undefined,
				smallIcon: options.icon,
				actionTypeId: 'default',
			},
		],
	});
}
