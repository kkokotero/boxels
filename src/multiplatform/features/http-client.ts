import { detectPlatform } from '@multiplatform/platform';
import { type http as HTTP } from "@core/index"

let clientPromise: Promise<typeof import('@multiplatform/native/web/http-client')>;

function getClientModule() {
  if (!clientPromise) {
    const platform = detectPlatform();

    switch (platform) {
      case 'capacitor':
        clientPromise = import('@multiplatform/native/capacitor/http-client');
        break;
      case 'electron':
        clientPromise = import('@multiplatform/native/electron/http-client');
        break;
      default:
        clientPromise = import('@multiplatform/native/web/http-client');
        break;
    }
  }
  return clientPromise;
}

export async function httpClient(...args: Parameters<(typeof import('@multiplatform/native/web/http-client'))['httpClient']>) {
  const module = await getClientModule();
  return module.httpClient(...args);
}

// Aquí devolvemos un proxy para no usar TLA
export const http: typeof HTTP = new Proxy(
  {} as typeof HTTP,
  {
    get(_target, prop: keyof typeof HTTP) {
      return async (...args: unknown[]) => {
        const module = await getClientModule();
        const value = module.http[prop];

        if (typeof value === 'function') {
          return (value as Function).apply(module.http, args);
        }
        return value;
      };
    },
  } satisfies ProxyHandler<typeof HTTP>,
);

