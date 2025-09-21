import { detectPlatform } from '@multiplatform/platform';

let notifierPromise: Promise<typeof import('@multiplatform/native/web/notifier')>;

function getNotifierModule() {
  if (!notifierPromise) {
    const platform = detectPlatform();

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
  }

  return notifierPromise;
}

export async function notify(...args: Parameters<(typeof import('@multiplatform/native/web/notifier'))['notify']>) {
  const module = await getNotifierModule();
  return module.notify(...args);
}
