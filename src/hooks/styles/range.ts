// Importaciones desde el sistema reactivo central
import { autoCleanup } from '@core/cleanup';
import {
	isSignal, // Verifica si un valor es una señal reactiva
	signal, // Crea una señal reactiva
	type ReactiveSignal, // Tipo para señales reactivas
	type ReactiveUnsubscribe, // Tipo para funciones de limpieza de suscripción
} from '@core/reactive';
import type { Hook } from '@hooks/hook';

// Tipo que representa una zona dentro del rango con un manejador asociado
export type RangeZone = {
	from: number; // Porcentaje mínimo (0 a 1) del rango donde se activa el handler
	to: number; // Porcentaje máximo (0 a 1) del rango donde se activa el handler
	handler: () => void; // Función que se ejecuta cuando el valor actual está en el rango
};

// Tipo auxiliar para declarar rangos de porcentaje, permite:
// - Un solo número (ej. `0.3`)
// - Un rango en tupla (ej. `[0.2, 0.5]`)
// - Un objeto con propiedades `from` y `to` (ej. `{ from: 0.2, to: 0.5 }`)
export type RangeZonePercent =
	| number
	| [number, number]
	| { from: number; to: number };

/**
 * Clase Range: permite manejar valores normalizados dentro de un rango
 * definido (entre `min` y `max`) y asociar zonas de activación por porcentaje.
 * También se integra con señales reactivas para actualizar el porcentaje en tiempo real.
 */
export class Range implements Hook {
	private zones: RangeZone[] = []; // Zonas de activación registradas
	private cleanUps: ReactiveUnsubscribe[] = []; // Funciones para limpiar suscripciones reactivas

	readonly current = signal(0); // Señal reactiva que almacena el porcentaje actual normalizado (entre 0 y 1)

	constructor(
		public min: number, // Valor mínimo absoluto del rango
		public max: number, // Valor máximo absoluto del rango
	) {
		// Validación: min debe ser estrictamente menor que max
		if (min >= max) throw new Error('min debe ser menor que max');

		autoCleanup(this).onCleanup(() => this.destroy());
	}

	/**
	 * Registra una zona dentro del rango que ejecutará el handler cuando
	 * el valor actual normalizado esté dentro de ella.
	 * @param range - Porcentaje o rango de porcentaje (0 a 1)
	 * @param handler - Función a ejecutar cuando el valor esté dentro del rango
	 */
	public on(range: RangeZonePercent, handler: () => void) {
		let from: number;
		let to: number;

		// Interpreta el tipo de entrada para extraer los valores `from` y `to`
		if (typeof range === 'number') {
			from = to = range; // Un solo número representa un punto exacto
		} else if (Array.isArray(range)) {
			[from, to] = range; // Tupla [from, to]
		} else {
			from = range.from;
			to = range.to; // Objeto { from, to }
		}

		// Validaciones: rango debe estar entre 0 y 1, y from <= to
		if (from < 0 || to < 0 || from > 1 || to > 1 || from > to) {
			throw new Error(`Rango inválido: [${from}, ${to}]`);
		}

		// Registra la zona con su handler
		this.zones.push({ from, to, handler });
	}

	/**
	 * Asigna un valor absoluto (o una señal) y calcula el porcentaje
	 * correspondiente dentro del rango definido. Ejecuta los handlers
	 * correspondientes si el porcentaje cae dentro de alguna zona registrada.
	 * @param value - Valor absoluto o señal reactiva
	 * @returns - Señal reactiva con el valor actual normalizado
	 */
	public percent(value: number | ReactiveSignal<number>) {
		// Si es una señal, se suscribe a ella y actualiza en cada cambio
		if (isSignal(value)) {
			this.cleanUps.push(
				value.subscribe((v: number) => {
					this.percent(v); // Recursivamente actualiza el valor
				}),
			);
			return this.current;
		}

		// Calcula y actualiza el valor normalizado
		this.current.set(this.clamp(value));

		// Ejecuta los handlers correspondientes si el valor cae en alguna zona activa
		for (const { from, to, handler } of this.zones) {
			if (this.current() >= from && this.current() <= to) {
				handler();
			}
		}

		return this.current;
	}

	/**
	 * Limpia todas las suscripciones reactivas, borra las zonas registradas
	 * y resetea el valor actual.
	 */
	public destroy() {
		this.cleanUps.forEach((fn) => fn()); // Ejecuta todas las funciones de limpieza
		this.zones = []; // Elimina todas las zonas
		this.current.set(-1); // Resetea el valor actual
	}

	/**
	 * Convierte un valor absoluto en un porcentaje normalizado dentro del rango.
	 * @param value - Valor absoluto
	 * @returns - Valor normalizado entre 0 y 1
	 */
	private clamp(value: number): number {
		return Math.min(1, Math.max(0, (value - this.min) / (this.max - this.min)));
	}
}

/**
 * Función auxiliar para crear una nueva instancia de Range.
 * @param min - Valor mínimo del rango
 * @param max - Valor máximo del rango
 * @returns - Nueva instancia de Range
 */
export const createRange = (min: number, max: number) => new Range(min, max);
