// Importamos utilidades y tipos del sistema reactivo personalizado.
import { autoCleanup } from '@core/cleanup';
import {
	computed, // Crea valores derivados de señales reactivas.
	isSignal, // Verifica si un valor es una señal reactiva.
	signal, // Crea una señal reactiva básica.
	type ReactiveSignal, // Tipo para una señal reactiva.
	type ReactiveUnsubscribe, // Tipo para función de limpieza al desuscribirse.
} from '@core/reactive';
import type { Hook } from '@hooks/hook';

/**
 * `WritableStyleKeys` define todas las claves de `CSSStyleDeclaration`
 * que pueden ser escritas y que aceptan valores tipo `string`, `null` o `undefined`.
 * Se utiliza para filtrar las propiedades del objeto `style`.
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
 * Tipo que representa un valor de estilo que puede ser:
 * - un string o número (valor directo),
 * - `null` o `undefined` (valor ignorado),
 * - o una señal reactiva que eventualmente resuelve a un valor de estilo.
 */
type StaticStyle =
	| string
	| number
	| null
	| undefined
	| ReactiveSignal<StaticStyle>;

/**
 * Representa un objeto de estilo CSS parcial, donde cada propiedad puede ser
 * estática o reactiva.
 */
type StyleObject = Partial<Record<WritableStyleKeys, StaticStyle>>;

/**
 * Función auxiliar que convierte un objeto de estilos en un string CSS plano.
 * Ejemplo: { backgroundColor: 'red' } -> "background-color: red"
 */
function parseStyle(style: StyleObject) {
	return Object.entries(style)
		.map(([key, value]) => {
			const kebab = key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
			return `${kebab}: ${value}`;
		})
		.join('; ');
}

/**
 * Clase `Style` permite combinar estilos estáticos y reactivos,
 * generando una cadena de estilo CSS reactiva (`this.value`).
 */
export class Style implements Hook {
	// Almacena funciones de limpieza para eliminar suscripciones reactivas.
	private cleanUps: ReactiveUnsubscribe[] = [];

	// Señal interna que contiene el objeto de estilos actual combinado.
	private styles = signal<StyleObject>({});

	// Computado que transforma el objeto de estilos en string CSS.
	public value = computed([this.styles], () => parseStyle(this.styles()));

	/**
	 * Constructor: acepta múltiples entradas de estilo (estáticas o reactivas),
	 * y las procesa automáticamente.
	 */
	constructor(
		...styles: (StyleObject | null | undefined | ReactiveSignal<StyleObject>)[]
	) {
		for (const style of styles) {
			if (!style) continue; // Ignora valores nulos o indefinidos.

			// Si el estilo es reactivo (señal), se suscribe a sus cambios.
			if (isSignal(style)) {
				this.cleanUps.push(
					style.subscribe((newStyle) => {
						this.processStyle(newStyle);
					}),
				);
			}
			// Si es un objeto normal, lo procesa directamente.
			else if (typeof style === 'object') {
				this.processStyle(style);
			}
			// Si el tipo es inválido, lanza un error.
			else {
				throw new Error(
					`Tipo de estilo inválido: ${typeof style}. Se esperaba StyleObject o ReactiveSignal<StyleObject>.`,
				);
			}
		}

		autoCleanup(this).onCleanup(() => this.destroy());
	}

	/**
	 * Procesa un objeto de estilos estáticos o reactivos.
	 * Si una propiedad es una señal, se suscribe a ella y actualiza
	 * el estilo cuando cambia. Si es un valor directo, se asigna de inmediato.
	 */
	private processStyle(style: StyleObject) {
		for (const [key, value] of Object.entries(style) as [
			WritableStyleKeys,
			StaticStyle,
		][]) {
			// Se ignoran valores nulos, indefinidos o 'unset'.
			if (value != null && value !== undefined && value !== 'unset') {
				// Si el valor es una señal reactiva, se suscribe y actualiza dinámicamente.
				if (isSignal(value)) {
					this.cleanUps.push(
						value.subscribe((newValue) => {
							const current = { ...this.styles() };
							current[key] = String(newValue);
							this.styles.set(current);
						}),
					);
					// Se inicializa con el valor actual de la señal.
					const current = { ...this.styles() };
					current[key] = String(value());
					this.styles.set(current);
				}
				// Si es un valor directo, se convierte a string y se asigna.
				else {
					const current = { ...this.styles() };
					current[key] = String(value);
					this.styles.set(current);
				}
			}
		}
	}

	/**
	 * Elimina todas las suscripciones reactivas creadas durante
	 * la vida de esta instancia. Limpia completamente el estado interno.
	 */
	public destroy() {
		for (const cleanUp of this.cleanUps) {
			cleanUp();
		}
		this.cleanUps = [];
		this.styles.set({});
	}
}

/**
 * Función de utilidad para crear una nueva instancia de `Style`,
 * aceptando múltiples entradas de estilo (estáticas o reactivas).
 */
export const createStyle = (
	...styles: (StyleObject | null | undefined | ReactiveSignal<StyleObject>)[]
) => new Style(...styles);
