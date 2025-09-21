import { detectPlatform } from '@multiplatform/platform';
import { type Store } from '@data/storage';

let storePromise: Promise<typeof import('@multiplatform/native/web/store')>;
let storeInstance: any;

function getStoreModule() {
  if (!storePromise) {
    const platform = detectPlatform();

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
  }
  return storePromise;
}

export const store: Store = new Proxy(
  {} as Store,
  {
    get(_, prop: string) {
      return async (...args: any[]) => {
        if (!storeInstance) {
          const module = await getStoreModule();
          storeInstance = module.store;
        }
        const target = storeInstance[prop];
        if (typeof target === 'function') {
          return target.apply(storeInstance, args);
        }
        return target;
      };
    },
  }
);
