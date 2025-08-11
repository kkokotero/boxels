export {};

import type { ReactiveSignal } from '@core/index';
import type { BoxelsElementNode } from '../elements';

/**
 * Manejadores de eventos del DOM.
 *
 * Esta utilidad transforma cada evento estándar del DOM en una clave de tipo `$on:evento`
 * permitiendo declarar manejadores personalizados dentro del sistema de atributos.
 */
type DOMEventHandlers = {
	[K in keyof HTMLElementEventMap as `$on:${K}`]?: (
		ev: HTMLElementEventMap[K],
	) => void;
};

/**
 * Manejadores de eventos del ciclo de vida del elemento.
 *
 * - `$lifecycle:mount`: se ejecuta cuando el elemento es montado en el DOM.
 * - `$lifecycle:destroy`: se ejecuta cuando el elemento es destruido.
 */
export type LifecycleEventHandlers<T extends keyof HTMLElementTagNameMap> = {
	'$lifecycle:mount'?: (e: BoxelsElementNode<T>) => void;
	'$lifecycle:destroy'?: (e: BoxelsElementNode<T>) => void;
};

/**
 * Tipos permitidos para valores en la clase `class`.
 *
 * Se permite:
 * - un booleano
 * - una señal reactiva que devuelve un booleano
 * - un arreglo con combinaciones de los anteriores
 */
type ClassValue =
	| boolean
	| ReactiveSignal<boolean>
	| Array<boolean | ReactiveSignal<boolean>>;

/**
 * Mapa de clases donde la clave es el nombre de la clase y el valor
 * es un `ClassValue` que determina si la clase se aplica o no.
 */
type ClassMap = Record<string, ClassValue>;

/**
 * Tipos admitidos para el atributo `class` de los elementos:
 * - string o arreglo de strings (estático)
 * - mapa de clases dinámicas
 * - `null` o `undefined` para ausencia
 */
export type ClassAttr = string | string[] | ClassMap | null | undefined;

/**
 * Extrae las claves de `CSSStyleDeclaration` que aceptan valores string o null,
 * para asegurar que sólo estilos válidos y modificables puedan ser definidos.
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
 * Tipos válidos para los estilos:
 * - Valor estático: string o número
 * - Valor reactivo: una señal
 * - Mezcla: un arreglo de valores estáticos y/o reactivos
 */
type StaticStyle = string | number;
type ReactiveStyle = ReactiveSignal<StaticStyle>;
type MixedStyle = Array<StaticStyle | ReactiveStyle>;
type StyleValue = StaticStyle | ReactiveStyle | MixedStyle;

/**
 * Mapa de estilos válidos. Cada clave corresponde a una propiedad de estilo
 * del DOM (filtrada por `WritableStyleKeys`) y acepta valores reactivos o estáticos.
 */
export type StyleMap = Partial<Record<WritableStyleKeys, StyleValue>>;

/**
 * Tipos admitidos para el atributo `style`:
 * - mapa de estilos
 * - string de estilo en línea
 * - señal reactiva con string
 * - `null` o `undefined` para no aplicar estilos
 */
export type StyleAttr =
	| StyleMap
	| string
	| ReactiveSignal<string>
	| null
	| undefined;

/**
 * Atributos estándar que pueden tener los elementos del sistema Boxels.
 * Incluye:
 * - manejadores de eventos DOM (`$on:click`, `$on:input`, etc.)
 * - eventos del ciclo de vida (`$lifecycle:mount`, etc.)
 * - atributos de clase y estilo, incluyendo valores reactivos
 * - `children`: hijos del elemento (puede ser cualquier tipo)
 * - cualquier otro atributo HTML válido como `id`, `name`, `tabindex`, etc.
 */
interface standartAttrs<T extends keyof HTMLElementTagNameMap>
	extends DOMEventHandlers,
		LifecycleEventHandlers<T> {
	class?: ClassAttr;
	style?: StyleAttr;
	children?: any;

	// Acepta atributos arbitrarios para mayor flexibilidad
	[key: string]: any;
}

export type SVGAttributes = Partial<{
  // Atributos comunes SVG
  xmlns: string;
  fill: string;
  stroke: string;
  'stroke-width': string | number;
  viewBox: string;
  width: string | number;
  height: string | number;
  class: string;
  
  // Atributos de formas SVG
  cx: string | number;
  cy: string | number;
  r: string | number;
  x: string | number;
  y: string | number;
  d: string;
  points: string;
  transform: string;
  // etc.

  // Accesibilidad
  role: string;
  'aria-label': string;
  'aria-hidden': boolean | 'true' | 'false';

  // Children usualmente es JSX.Element o similar
  children?: JSX.Element | JSX.Element[] | string;

  [k: string]: any;
}>;


/**
 * Declaraciones globales necesarias para extender el sistema de tipos de JSX
 * y soportar atributos específicos por tipo de etiqueta.
 */
declare global {
	/**
	 * Atributos extendidos por tipo de etiqueta HTML.
	 * Se puede definir atributos personalizados por componente o etiqueta específica.
	 */
	export interface BoxelsElementExtendedAttributes
		extends Record<string, unknown> {
		button: {
			type?: 'button' | 'submit' | 'reset';
		};

		svg: SVGAttributes;
		circle: SVGAttributes;
		path: SVGAttributes;

		// Fragment también puede tener eventos del ciclo de vida
		Fragment: LifecycleEventHandlers<'div'> & {};
	}

	/**
	 * Atributos globales para todos los elementos.
	 * Pueden usarse para definir atributos compartidos por todas las etiquetas.
	 */
	export interface BoxelsElementGlobalAttributes
		extends Record<string, unknown> {}

	/**
	 * Atributos válidos para cada tipo de elemento HTML.
	 * Combina atributos estándar, atributos extendidos específicos del tipo
	 * y atributos globales. También evita sobrescribir propiedades del DOM.
	 */
	export type BoxelsElementAttributes<T extends keyof HTMLElementTagNameMap> =
		standartAttrs<T> &
			BoxelsElementExtendedAttributes[T] &
			BoxelsElementGlobalAttributes & {
				// Evita colisiones con propiedades/métodos nativos del DOM
				[K in keyof HTMLElementTagNameMap[T] as K extends `on${string}`
					? never
					: HTMLElementTagNameMap[T] extends Function
						? never
						: K]?: any;
			};
}

export type BoxelsELementNodeAttributes<T extends keyof HTMLElementTagNameMap> =
	BoxelsElementAttributes<T>;

/**
 * Almacena los manejadores personalizados registrados por tipo de selector (etiqueta).
 * Ejemplo: `handlers['button']['$myHandler'] = (el, value) => { ... }`
 */
export const handlers: Record<string, Record<string, any>> = {};

/**
 * Manejadores personalizados que aplican globalmente a cualquier tipo de elemento.
 */
export const globalHandlers: Record<string, any> = {};

/**
 * Registra manejadores personalizados para una etiqueta específica.
 *
 * @param selector - nombre de la etiqueta (ej: `'button'`, `'input'`)
 * @param newHandlers - objeto donde cada clave es `$nombre` y su valor
 *   es una función que recibe el elemento y el valor del atributo, devolviendo
 *   una función de limpieza (para desmontaje).
 */
export function addCustomHandlers<T extends keyof HTMLElementTagNameMap>(
	selector: T,
	newHandlers: Record<
		`$${string}`,
		(e: BoxelsElementNode<T>, handler: any) => () => void
	>,
) {
	if (!handlers[selector]) {
		handlers[selector] = {};
	}

	for (const [key, fn] of Object.entries(newHandlers)) {
		handlers[selector][key] = fn;
	}
}

/**
 * Registra un manejador global personalizado que se puede aplicar a cualquier tipo de etiqueta.
 *
 * @param key - nombre del atributo personalizado (debe iniciar con `$`)
 * @param newHandler - función que recibe el elemento y el valor del atributo,
 *   y retorna una función de limpieza para cuando el elemento sea destruido.
 */
export function addGlobalHandler(
	key: `$${string}`,
	newHandler: (e: HTMLElement, handler: any) => () => void,
) {
	globalHandlers[key] = newHandler;
}
