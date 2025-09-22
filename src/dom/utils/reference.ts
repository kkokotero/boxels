export interface Reference<T> {
  readonly native: T | null;
  set(newEl: T | null): void;
  clear(): void;
}

/**
 * Crea un objeto de referencia (similar a React.createRef pero extendido)
 */
export function reference<T = any>(initial?: T | null): Reference<T> {
  let element: T | null = initial ?? null;

  return {
    get native() {
      return element;
    },
    set(newEl: T | null) {
      element = newEl;
    },
    clear() {
      element = null;
    },
  };
}

/**
 * Hook / type guard para saber si un valor es un Reference
 */
export function isReference<T = any>(value: unknown): value is Reference<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "set" in value &&
    typeof (value as any).set === "function" &&
    "native" in value
  );
}
