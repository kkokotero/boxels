type OpenOpts = {
  width?: number;
  height?: number;
  float?: boolean;
  top?: number;
  left?: number;
};

type MsgCallback<T = unknown> = (payload: T, event: MessageEvent) => void;

export const page = (() => {
  // Diccionario de listeners por tipo, cada tipo tiene array de callbacks genéricos <any>
  const listeners: Record<string, MsgCallback<any>[]> = {};

  function title(): string;
  function title(newTitle: string): void;
  function title(newTitle?: string): string | void {
    if (newTitle === undefined) return document.title;
    document.title = newTitle;
  }

  function vibrate(pattern: number | number[]): boolean {
    if ('vibrate' in navigator) return navigator.vibrate(pattern);
    console.warn('No vibrate support');
    return false;
  }

  function open(
    url = '',
    name = '_blank',
    opts: OpenOpts = {}
  ): Window | null {
    const { width = 800, height = 600, float = false, top, left } = opts;
    let specs = `width=${width},height=${height},resizable=yes,scrollbars=yes`;
    if (float) specs += ',toolbar=no,menubar=no,location=no,status=no';
    if (top !== undefined) specs += `,top=${top}`;
    if (left !== undefined) specs += `,left=${left}`;
    return window.open(url, name, specs);
  }

  function emit<T = unknown>(
    target: Window | null,
    type: string,
    payload?: T,
    origin = '*'
  ): void {
    if (target?.postMessage) {
      target.postMessage({ type, payload }, origin);
    } else {
      console.warn('Invalid target window');
    }
  }

  function on<T = unknown>(
    type: string,
    cb: MsgCallback<T>,
    options?: boolean | AddEventListenerOptions
  ): () => void {
    if (Object.keys(listeners).length === 0) {
      window.addEventListener('message', handle, options);
    }

    if (!listeners[type]) {
      listeners[type] = [];
    }
    listeners[type].push(cb);

    return () => {
      const arr = listeners[type];
      if (!arr) return;

      const index = arr.indexOf(cb);
      if (index !== -1) arr.splice(index, 1);

      // Si no quedan listeners, remueve listener global
      if (Object.values(listeners).every((a) => a.length === 0)) {
        window.removeEventListener('message', handle, options);
      }
    };
  }

  function handle(event: MessageEvent) {
    if (!event.data || typeof event.data !== 'object') return;
    const { type, payload } = event.data as { type?: string; payload?: unknown };
    if (!type) return;

    const arr = listeners[type];
    if (!arr) return;

    for (const cb of arr) {
      cb(payload, event);
    }
  }

  function visible(): boolean {
    return !document.hidden;
  }

  function onVisible(cb: (visible: boolean) => void): () => void {
    const handler = () => cb(!document.hidden);
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }

  function fullscreen(el: HTMLElement = document.documentElement): Promise<void> {
    if (el.requestFullscreen) return el.requestFullscreen();
    return Promise.reject('No fullscreen support');
  }

  function exitFullscreen(): Promise<void> {
    if (document.exitFullscreen) return document.exitFullscreen();
    return Promise.reject('No fullscreen support');
  }

  function isFullscreen(): boolean {
    return !!document.fullscreenElement;
  }

  function scrollTop(behavior: ScrollBehavior = 'smooth'): void {
    window.scrollTo({ top: 0, behavior });
  }

  function scrollBottom(behavior: ScrollBehavior = 'smooth'): void {
    window.scrollTo({ top: document.body.scrollHeight, behavior });
  }

  function reload(): void {
    window.location.reload();
  }

  function inIframe(): boolean {
    return window.self !== window.top;
  }

  return {
    title,
    vibrate,
    open,
    emit,
    on,
    visible,
    onVisible,
    fullscreen,
    exitFullscreen,
    isFullscreen,
    scrollTop,
    scrollBottom,
    reload,
    inIframe,
  };
})();