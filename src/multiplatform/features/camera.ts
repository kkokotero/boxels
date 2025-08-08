import { detectPlatform } from '@multiplatform/platform';

const platform = detectPlatform();

let storePromise: Promise<typeof import('@multiplatform/native/web/camera')>;

switch (platform) {
    case 'capacitor':
        storePromise = import('@multiplatform/native/capacitor/camera');
        break;
    case 'electron':
        storePromise = import('@multiplatform/native/electron/camera');
        break;
    default:
        storePromise = import('@multiplatform/native/web/camera');
        break;
}

const storeModule = await storePromise;

export const useCamera = storeModule.useCamera;
