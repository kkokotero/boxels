import { detectPlatform } from '@multiplatform/platform';

let storePromise: Promise<typeof import('@multiplatform/native/web/camera')>;

export function getCameraModule() {
  if (!storePromise) {
    const platform = detectPlatform();

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
  }

  return storePromise;
}

export async function useCamera(...args: Parameters<(typeof import('@multiplatform/native/web/camera'))['useCamera']>) {
  const module = await getCameraModule();
  return module.useCamera(...args);
}
