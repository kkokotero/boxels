import { addGlobalHandler } from './global-handlers';

type TransitionOptions = {
  onUpdate?: () => void | Promise<void>;
  onFinished?: () => void;
  className?: string;
};

const attrName = 'view-transition-name';
const elements: Map<string, TransitionOptions> = new Map(); 

function createOrGetName(el: HTMLElement) {
  let name = el.getAttribute(attrName);
  if (!name) {
    name = generateId();
    el.setAttribute(attrName, name);
  }
  return name;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    return `vt-${(crypto as any).randomUUID()}`;
  return `vt-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

// Handler para $view:name
addGlobalHandler('$view:name', (el, value: string) => {
  if (!document.startViewTransition) return () => {};

  el.setAttribute(attrName, value);
  if (!elements.has(value)) {
    elements.set(value, { className: value });
  }

  return () => {
    elements.delete(value);
  };
});

// Handler para $view:onUpdate
addGlobalHandler('$view:update', (el, handler: TransitionOptions['onUpdate']) => {
  const name = createOrGetName(el);
  const opts = elements.get(name) || {};
  opts.onUpdate = handler;
  elements.set(name, opts);
  return () => {
    const entry = elements.get(name);
    if (entry) elements.delete(name);
  };
});

// Handler para $view:onFinished
addGlobalHandler('$view:finished', (el, handler: TransitionOptions['onFinished']) => {
  const name = createOrGetName(el);
  const opts = elements.get(name) || {};
  opts.onFinished = handler;
  elements.set(name, opts);
  return () => {
    const entry = elements.get(name);
    if (entry) elements.delete(name);
  };
});

// Ejecuta todas las transiciones
export function runViewTransition() {
  if (!document.startViewTransition) return;

  const transition = document.startViewTransition(async () => {
    for (const opts of elements.values()) {
      if (opts.onUpdate) await opts.onUpdate();
    }
  });

  for (const opts of elements.values()) {
    if (opts.className) {
      document.documentElement.classList.add(opts.className);
      transition.finished.finally(() => {
        document.documentElement.classList.remove(opts.className!);
      });
    }
  }

  transition.finished.then(() => {
    for (const opts of elements.values()) {
      if (opts.onFinished) opts.onFinished();
    }
  });
}
