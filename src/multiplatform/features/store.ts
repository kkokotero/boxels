import { detectPlatform } from '@multiplatform/platform';

const platform = detectPlatform();

let storePromise: Promise<typeof import('@multiplatform/native/web/store')>;

switch (platform) {
	case 'capacitor':
		storePromise = import('@multiplatform/native/capacitor/store');
		break;
	case 'electron':
		storePromise = import('@multiplatform/native/electron/store');
		break;
	default:
		storePromise = import('@multiplatform/native/web/store');
		break;
}

const storeModule = await storePromise;

export const store = storeModule.store;
