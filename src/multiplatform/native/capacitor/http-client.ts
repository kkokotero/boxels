// Capacitor HTTP client wrapper compatible with Boxels core structure
import {
  CapacitorHttp,
  type HttpResponse as CapResponse,
  type HttpResponseType
} from '@capacitor/core';
import type {
  HttpClientOptions,
  HttpResponse
} from '@core/client/http-client';
import { local } from '@data/index';

const storeKey = (url: string) => `__http_client_${url}`;

export async function httpClient<T = any, B = unknown>(
  endpoint: string,
  options: HttpClientOptions<B, T> = {}
): Promise<HttpResponse<T>> {
  const {
    method = 'GET',
    headers = {},
    body,
    retries = 3,
    timeout = 10000,
    responseType = 'json' as HttpResponseType,
    cache = false,
    cacheTtl = 60000,
    cacheStorage = 'session',
    transform,
    preRequest,
    postResponse
  } = options;

  if (cache && local[cacheStorage].has(storeKey(endpoint))) {
    const { data, expires } = JSON.parse(
      local[cacheStorage].get<string>(storeKey(endpoint)) ?? ''
    );
    if (Date.now() < expires)
      return {
        data,
        ok: true,
        status: 200,
        fromCache: true
      };
    local[cacheStorage].delete(storeKey(endpoint));
  }

  let lastError: any = null;
  const startTime = Date.now();

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (preRequest) {
        // Dummy RequestInit for compatibility with preRequest
        const dummyInit: RequestInit = {
          method,
          headers,
          body: JSON.stringify(body)
        };
        preRequest(dummyInit);
      }

      const res: CapResponse = await CapacitorHttp.request({
        url: endpoint,
        method,
        headers,
        data: body,
        responseType: responseType as HttpResponseType
      });

      let data: any = res.data;

      if (transform) {
        data = transform(res.data);
      }

      if (cache && res.status >= 200 && res.status < 300) {
        const expires = Date.now() + cacheTtl;
        local[cacheStorage].set(
          storeKey(endpoint),
          JSON.stringify({ data, expires })
        );
      }

      const response: HttpResponse<T> = {
        ok: res.status >= 200 && res.status < 300,
        status: res.status,
        data,
        headers: new Headers(res.headers),
        url: endpoint,
        duration: Date.now() - startTime
      };

      return postResponse ? postResponse(response) : response;
    } catch (err: any) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 100 * 2 ** attempt));
    }
  }

  return {
    ok: false,
    status: 0,
    data: null,
    error: lastError?.message || 'Request failed',
    duration: Date.now() - startTime
  };
}

export const http = {
  get: <T>(
    url: string,
    opts?: Omit<HttpClientOptions<undefined, T>, 'method'>
  ) => httpClient<T>(url, { ...opts, method: 'GET' }),

  post: <T, B = unknown>(
    url: string,
    body: B,
    opts?: Omit<HttpClientOptions<B, T>, 'method' | 'body'>
  ) => httpClient<T, B>(url, { ...opts, method: 'POST', body }),

  put: <T, B = unknown>(
    url: string,
    body: B,
    opts?: Omit<HttpClientOptions<B, T>, 'method' | 'body'>
  ) => httpClient<T, B>(url, { ...opts, method: 'PUT', body }),

  patch: <T, B = unknown>(
    url: string,
    body: B,
    opts?: Omit<HttpClientOptions<B, T>, 'method' | 'body'>
  ) => httpClient<T, B>(url, { ...opts, method: 'PATCH', body }),

  delete: <T>(
    url: string,
    opts?: Omit<HttpClientOptions<undefined, T>, 'method'>
  ) => httpClient<T>(url, { ...opts, method: 'DELETE' })
};