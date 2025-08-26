import type { MaybeSignal, ReactiveSignal } from '@core/index';
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
	xmlns: MaybeSignal<string>;
	fill: MaybeSignal<string>;
	stroke: MaybeSignal<string>;
	'stroke-width': MaybeSignal<string | number>;
	viewBox: MaybeSignal<string>;
	width: MaybeSignal<string | number>;
	height: MaybeSignal<string | number>;
	class: MaybeSignal<string>;

	// Atributos de formas SVG
	cx: MaybeSignal<string | number>;
	cy: MaybeSignal<string | number>;
	r: MaybeSignal<string | number>;
	x: MaybeSignal<string | number>;
	y: MaybeSignal<string | number>;
	d: MaybeSignal<string>;
	points: MaybeSignal<string>;
	transform: MaybeSignal<string>;
	// etc.

	// Accesibilidad
	role: MaybeSignal<string>;
	'aria-label': MaybeSignal<string>;
	'aria-hidden': MaybeSignal<boolean | 'true' | 'false'>;

	// Children usualmente es JSX.Element o similar
	children?: MaybeSignal<JSX.Element | JSX.Element[] | string>;

	[k: string]: MaybeSignal<any>;
}>;

// Datos extra calculados para enriquecer eventos
export type ExtraEventData = {
	percentX: number; // Porcentaje horizontal visible respecto al elemento
	percentY: number; // Porcentaje vertical visible respecto al elemento
	rect: DOMRect; // Bounding client rect del elemento
	viewport: { width: number; height: number }; // Dimensiones actuales del viewport
};

// Tipos enriquecidos para eventos con intersección y resize
export type ExtendedIntersectionEvent = IntersectionObserverEntry &
	ExtraEventData;
export type ExtendedResizeEvent = ResizeObserverEntry & ExtraEventData;

/**
 * Evento personalizado para gestos de deslizamiento (swipe).
 */
export type GestureSwipe = CustomEvent<{
	state: 'start' | 'move' | 'end' | 'cancel'; // Estado del gesto
	dx: number; // Diferencia horizontal desde el punto de inicio
	dy: number; // Diferencia vertical desde el punto de inicio
	distance: number; // Distancia total del movimiento
	direction: 'left' | 'right' | 'up' | 'down' | null; // Dirección del deslizamiento
	target: HTMLElement; // Elemento objetivo
}>;

/**
 * Evento personalizado que indica la tasa de clics por segundo.
 */
export type GestureClickrate = CustomEvent<{ clicksPerSecond: number }>;

/**
 * Evento personalizado para gestos de pellizco (pinch).
 */
export type gesturePinch = CustomEvent<{
	state: 'start' | 'move' | 'end'; // Estado del gesto
	scale: number; // Escala de ampliación o reducción
}>;

/**
 * Evento personalizado para gestos de rotación (rotate).
 */
export type GestureRotate = CustomEvent<{
	state: 'start' | 'move' | 'end'; // Estado del gesto
	angle: number; // Ángulo de rotación en grados
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

		// Elementos SVG principales
		svg: SVGAttributes;
		circle: SVGAttributes;
		ellipse: SVGAttributes;
		line: SVGAttributes;
		path: SVGAttributes;
		polygon: SVGAttributes;
		polyline: SVGAttributes;
		rect: SVGAttributes;

		// Contenedores / estructurales
		g: SVGAttributes;
		symbol: SVGAttributes;
		defs: SVGAttributes;
		use: SVGAttributes;

		// Texto
		text: SVGAttributes;
		tspan: SVGAttributes;
		textPath: SVGAttributes;

		// Gradientes y patrones
		linearGradient: SVGAttributes;
		radialGradient: SVGAttributes;
		stop: SVGAttributes;
		pattern: SVGAttributes;
		clipPath: SVGAttributes;
		mask: SVGAttributes;

		// Filtros
		filter: SVGAttributes;
		feBlend: SVGAttributes;
		feColorMatrix: SVGAttributes;
		feComponentTransfer: SVGAttributes;
		feComposite: SVGAttributes;
		feConvolveMatrix: SVGAttributes;
		feDiffuseLighting: SVGAttributes;
		feDisplacementMap: SVGAttributes;
		feDropShadow: SVGAttributes;
		feFlood: SVGAttributes;
		feGaussianBlur: SVGAttributes;
		feImage: SVGAttributes;
		feMerge: SVGAttributes;
		feMorphology: SVGAttributes;
		feOffset: SVGAttributes;
		feSpecularLighting: SVGAttributes;
		feTile: SVGAttributes;
		feTurbulence: SVGAttributes;

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
			} & {
				'$interface:visible'?: (e: ExtendedIntersectionEvent) => void; // Se dispara cuando el elemento entra en el viewport
				'$interface:invisible'?: (e: ExtendedIntersectionEvent) => void; // Se dispara cuando el elemento sale del viewport
				'$interface:resize'?: (e: ExtendedResizeEvent) => void; // Se dispara cuando el tamaño del elemento cambia
				'$interface:enter'?: (e: MouseEvent & ExtraEventData) => void; // Se dispara cuando el puntero entra al elemento
				'$interface:leave'?: (e: MouseEvent & ExtraEventData) => void; // Se dispara cuando el puntero sale del elemento
				'$interface:mutation'?: (
					e: MutationRecord[] & { el: HTMLElement },
				) => void; // Se dispara cuando el DOM del elemento cambia
				'$interface:idle'?: (e: { time: DOMHighResTimeStamp }) => void; // Se dispara cuando el navegador está en estado ocioso

				// Atributos nuevos
				'$interface:beforeunload'?: (e: BeforeUnloadEvent) => void; // Se dispara antes de que la página se descargue
				'$interface:pageshow'?: (e: PageTransitionEvent) => void; // Se dispara cuando se muestra la página (incluido desde caché)
				'$interface:pagehide'?: (e: PageTransitionEvent) => void; // Se dispara cuando la página se oculta (navegación o descarga)
				'$interface:visibilitychange'?: (e: {
					hidden: boolean;
					visibilityState: DocumentVisibilityState;
				}) => void; // Se dispara cuando cambia la visibilidad del documento
				// Evento disparado cuando el puntero está cerca del elemento.
				'$interaction:near'?: (e: CustomEvent<{ distance: number }>) => void;

				// Evento disparado continuamente cuando el puntero se mueve sobre el elemento.
				'$interaction:track'?: (e: MouseEvent) => void;

				// Evento disparado cuando el puntero entra al área del elemento.
				'$interaction:mouseenter'?: (e: MouseEvent) => void;

				// Evento disparado cuando el puntero sale del área del elemento.
				'$interaction:mouseleave'?: (e: MouseEvent) => void;

				// Evento disparado cuando el puntero permanece sobre el elemento
				// por un cierto tiempo (definido por `$interaction:linger-ms`).
				'$interaction:linger'?: (e: CustomEvent<{ duration: number }>) => void;

				// Atributo que define el radio de proximidad para `$interaction:near`.
				'$interaction:radius'?: number;

				// Atributo que define la duración en milisegundos para `$interaction:linger`.
				'$interaction:linger-ms'?: number;

				// Eventos de gesto
				'$gesture:tap'?: (e: TouchEvent) => void;
				'$gesture:doubletap'?: (e: TouchEvent) => void;
				'$gesture:longpress'?: (e: TouchEvent) => void;
				'$gesture:swipe'?: (e: GestureSwipe) => void;
				'$gesture:multitap'?: (e: CustomEvent<{ count: number }>) => void;
				'$gesture:clickrate'?: (e: GestureClickrate) => void;
				'$gesture:pinch'?: (e: gesturePinch) => void;
				'$gesture:rotate'?: (e: GestureRotate) => void;

				// Configuración personalizada para gestos
				'$gesture:min-swipe'?: number; // Distancia mínima para swipe válido
				'$gesture:max-swipe'?: number; // Distancia máxima para swipe válido
				'$gesture:longpress-ms'?: number; // Duración mínima para activar longpress
				'$gesture:doubletap-ms'?: number; // Intervalo máximo entre taps para doubletap
				'$gesture:multitap-ms'?: number; // Intervalo entre toques para multitap

				'$view:name'?: string;
				'$view:update'?: () => void;
				'$view:finished'?: () => void;
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
