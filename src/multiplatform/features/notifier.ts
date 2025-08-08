import { detectPlatform } from '@multiplatform/platform';

const platform = detectPlatform();

let notifierPromise: Promise<typeof import('@multiplatform/native/web/notifier')>;

switch (platform) {
	case 'capacitor':
		notifierPromise = import('@multiplatform/native/capacitor/notifier');
		break;
	case 'electron':
		notifierPromise = import('@multiplatform/native/electron/notifier');
		break;
	default:
		notifierPromise = import('@multiplatform/native/web/notifier');
		break;
}

const notifier = await notifierPromise;

export const notify = notifier.notify;
