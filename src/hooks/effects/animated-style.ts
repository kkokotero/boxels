import { autoCleanup } from '@core/cleanup';
import {
	isSignal,
	signal,
	type ReactiveSignal,
	type ReactiveUnsubscribe,
} from '@core/reactive';
import type { Hook } from '@hooks/hook';

/**
 * Clase `AnimatedStyle`
 * ---------------------
 * Esta clase permite generar una señal reactiva (`value`) que representa un valor animado
 * a partir de un porcentaje (`percent`). El valor animado se calcula dentro de un rango
 * definido por `from` y `to`, y puede incluir una función de transformación (`transform`)
 * y una función de interpolación o suavizado (`ease`).
 */
export class AnimatedStyle implements Hook {
	// Señal reactiva que contiene el valor animado (como string)
	readonly value = signal('');

	// Función para cancelar la suscripción a la señal de entrada, si es necesario
	private cleanUp?: ReactiveUnsubscribe;

	/**
	 * Constructor de `AnimatedStyle`
	 *
	 * @param percent - Un número estático o una señal reactiva que representa el porcentaje (0 a 1)
	 * @param config - Objeto de configuración con los siguientes campos:
	 *   - `from`: valor numérico inicial del rango de animación
	 *   - `to`: valor numérico final del rango de animación
	 *   - `transform`: (opcional) función que transforma el valor numérico a un string
	 *   - `ease`: (opcional) función para aplicar easing/interpolación al porcentaje
	 */
	constructor(
		public percent: number | ReactiveSignal<number>,
		private config: {
			from: number;
			to: number;
			transform?: (v: number) => string;
			ease?: (x: number) => number;
		},
	) {
		// Si percent es una señal reactiva, suscribirse a los cambios
		if (isSignal(percent)) {
			this.cleanUp = percent.subscribe(this.update.bind(this));
		} else {
			// Si es un valor estático, actualizar directamente
			this.update(percent);
		}

		autoCleanup(this).onCleanup(() => this.destroy());
	}

	/**
	 * Método privado `update`
	 *
	 * Calcula y actualiza el valor animado en función del porcentaje `v`,
	 * aplicando easing y transformaciones si están definidas.
	 *
	 * @param v - porcentaje numérico entre 0 y 1
	 */
	private update(v: number) {
		// Aplicar la función de easing si está definida
		const eased = this.config.ease ? this.config.ease(v) : v;

		// Calcular el valor interpolado entre `from` y `to`
		const value =
			this.config.from + (this.config.to - this.config.from) * eased;

		// Transformar el valor si se especificó una función de transformación
		this.value.set(
			this.config.transform ? this.config.transform(value) : String(value),
		);
	}

	/**
	 * Método público `destroy`
	 *
	 * Libera los recursos internos:
	 * - Cancela la suscripción a la señal de entrada (si existía)
	 * - Destruye la señal reactiva `value`
	 */
	public destroy() {
		this.cleanUp?.(); // Cancelar suscripción si existe
		this.value.destroy(); // Destruir la señal para liberar recursos
	}
}

/**
 * Función de utilidad `createAnimatedStyle`
 *
 * Crea una nueva instancia de `AnimatedStyle` a partir de un porcentaje y una configuración.
 *
 * @param percent - Número o señal que representa el porcentaje (0 a 1)
 * @param config - Objeto de configuración de animación (ver descripción del constructor)
 * @returns Instancia de `AnimatedStyle`
 */
export const createAnimatedStyle = (
	percent: number | ReactiveSignal<number>,
	config: {
		from: number;
		to: number;
		transform?: (v: number) => string;
		ease?: (x: number) => number;
	},
) => new AnimatedStyle(percent, config);
