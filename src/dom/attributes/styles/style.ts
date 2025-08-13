import {
  type ReactiveSignal,
  type ReactiveUnsubscribe,
  isSignal,
} from '@core/reactive';

/**
 * Tipo auxiliar que filtra solo las claves de `CSSStyleDeclaration`
 * que son asignables directamente mediante strings, null o undefined.
 * Esto evita incluir propiedades que son métodos o propiedades de solo lectura.
 */
type WritableStyleKeys = {
  [K in keyof CSSStyleDeclaration]: CSSStyleDeclaration[K] extends
    | string
    | null
    | undefined
    ? K
    : never;
}[keyof CSSStyleDeclaration];

/**
 * Tipos posibles para los valores de estilo:
 * - `StaticStyle`: un valor estático de estilo (string o number).
 * - `ReactiveStyle`: una señal reactiva que representa un valor de estilo.
 * - `MixedStyle`: un array que puede mezclar valores estáticos y reactivos.
 * - `StyleValue`: un alias que puede ser cualquiera de los anteriores.
 */
type StaticStyle = string | number;
type ReactiveStyle = ReactiveSignal<StaticStyle>;
type MixedStyle = Array<StaticStyle | ReactiveStyle>;
type StyleValue = StaticStyle | ReactiveStyle | MixedStyle;

/**
 * Mapa de estilos, donde cada clave corresponde a una propiedad de estilo CSS
 * y su valor puede ser estático, reactivo o mixto.
 */
export type StyleMap = Partial<Record<WritableStyleKeys, StyleValue>>;

/**
 * Atributo de estilo que puede ser:
 * - Un mapa de estilo (`StyleMap`)
 * - Una cadena CSS cruda (ej: "color: red;")
 * - Una señal reactiva que contiene una cadena CSS
 * - `null` o `undefined`
 */
export type StyleAttr = StyleMap | string | ReactiveSignal<string> | null | undefined;

/**
 * Aplica un valor de estilo a una propiedad CSS de un elemento HTML.
 * Si el valor es `null`, `undefined` o "unset", la propiedad es eliminada del estilo.
 */
function applyStyle(
  element: HTMLElement | SVGElement,
  property: WritableStyleKeys,
  value: string | number | null | undefined,
): void {
  const normalized = value != null && value !== 'unset' ? String(value) : '';
  if (normalized) {
    element.style[property] = normalized;
  } else {
    element.style.removeProperty(String(property));
  }
}

/**
 * Maneja un atributo de estilo para un elemento HTML, permitiendo valores
 * estáticos, reactivos o combinados. Devuelve una función para limpiar
 * suscripciones reactivas asociadas.
 *
 * @param element - El elemento HTML al que se aplicarán los estilos.
 * @param styles - El atributo de estilo a procesar.
 * @returns Una función que, al llamarse, desuscribe todas las reactividades.
 */
export function handleStyleAttribute(
  element: HTMLElement | SVGElement,
  styles: StyleAttr,
): ReactiveUnsubscribe {
  // Si el valor no es un objeto, se ignora.
  if (!styles || typeof styles !== 'object') {
    return () => {};
  }

  const cleanups: ReactiveUnsubscribe[] = [];

  // Si `styles` es una señal reactiva, se suscribe a ella y vuelve a evaluar el estilo completo.
  if (isSignal(styles)) {
    const current = styles();
    if (!current || typeof current !== 'object') {
      return () => {};
    }

    // Suscripción reactiva: si cambia el objeto, se vuelve a ejecutar la función de estilo.
    const unsub = styles.subscribe((newStyles) => {
      return handleStyleAttribute(element, newStyles as StyleAttr)();
    });

    // Devuelve la función de limpieza de la suscripción.
    return unsub;
  }

  // Itera por cada propiedad de estilo del objeto
  for (const [property, value] of Object.entries(styles) as [
    WritableStyleKeys,
    StyleValue,
  ][]) {
    // Si es un valor estático (string o number), se aplica directamente.
    if (typeof value === 'string' || typeof value === 'number') {
      applyStyle(element, property, value);
    }
    // Si es una señal reactiva, se suscribe y actualiza cuando cambia.
    else if (isSignal(value)) {
      const apply = (v: StaticStyle | null | undefined) =>
        applyStyle(element, property, v);
      const unsubscribe = value.subscribe(apply);
      apply(value());
      cleanups.push(unsubscribe);
    }
    // Si es un arreglo, puede contener valores estáticos y/o señales.
    else if (Array.isArray(value)) {
      const signals: ReactiveSignal<StaticStyle>[] = [];
      const statics: StaticStyle[] = [];

      for (const item of value) {
        if (isSignal(item)) {
          signals.push(item);
        } else {
          statics.push(item);
        }
      }

      // Función que actualiza el estilo uniendo los valores estáticos y los valores actuales de las señales.
      const update = () => {
        const dynamic = signals.map((s) => s());
        const all = [...statics, ...dynamic];
        const valid = all.every(
          (v) => v !== null && v !== undefined && v !== 'unset',
        );
        const valueStr = valid ? all.join(' ') : null;
        applyStyle(element, property, valueStr);
      };

      update(); // Aplica la primera vez

      // Si hay señales, se suscribe a ellas.
      if (signals.length) {
        const unsubscribes = signals.map((s) => s.subscribe(update));
        cleanups.push(() => unsubscribes.forEach((u) => u()));
      }
    }
    // Cualquier otro tipo de valor no es soportado.
    else {
      console.warn(`Unsupported style value for "${property}":`, value);
    }
  }

  // Devuelve una función para limpiar todas las suscripciones cuando ya no se necesiten.
  return () => cleanups.forEach((fn) => fn());
}
