// Tipo que representa una función de limpieza.

import { autoCleanup } from '@core/cleanup';
import type { Hook } from '@hooks/hook';

// Esta función se utiliza para deshacer efectos secundarios cuando un estado cambia o se destruye.
type CleanupFn = () => void;

// Tipo que representa una función manejadora de estado.
// Puede devolver una función de limpieza opcional.
type StateHandler = () => void | CleanupFn;

// Mapa tipado de nombres de estado (tipo cadena) a funciones manejadoras de estado.
type StateMap<T extends string> = Record<T, StateHandler>;

/**
 * Clase `State` que permite manejar un sistema de estados con cambio controlado,
 * manejo de efecto secundario y limpieza al cambiar de estado.
 *
 * @typeParam T - Tipo que extiende `string` e indica los posibles nombres de estados válidos.
 */
export class State<T extends string> implements Hook {
	// Estado actual activo
	private current?: T;

	// Último estado antes del cambio más reciente
	private last?: T;

	// Función de limpieza que se ejecuta al salir de un estado
	private cleanup?: CleanupFn;

	/**
	 * Constructor de la clase State
	 *
	 * @param states - Un objeto donde cada clave representa un estado y su valor es una función manejadora asociada.
	 */
	constructor(public readonly states: StateMap<T>) {
		autoCleanup(this).onCleanup(() => this.destroy());
	}

	/**
	 * Cambia al estado especificado.
	 * Si ya está en ese estado, no hace nada.
	 * Ejecuta la función de limpieza del estado anterior si existe.
	 *
	 * @param to - Nombre del nuevo estado al que se desea cambiar.
	 */
	public go(to: T) {
		if (this.current === to) return; // No hace nada si ya estamos en el estado solicitado.

		// Ejecuta la limpieza del estado anterior si existe.
		this.cleanup?.();

		// Guarda el estado anterior como "last"
		this.last = this.current;

		// Actualiza el estado actual
		this.current = to;

		// Ejecuta el manejador del nuevo estado y almacena la función de limpieza si se proporciona.
		const maybeCleanup = this.states[to]();
		if (typeof maybeCleanup === 'function') {
			this.cleanup = maybeCleanup;
		} else {
			this.cleanup = undefined;
		}
	}

	/**
	 * Vuelve al estado anterior si existe y es diferente al actual.
	 */
	public back() {
		if (!this.last || this.last === this.current) return;
		this.go(this.last);
	}

	/**
	 * Obtiene el estado actual activo.
	 *
	 * @returns El nombre del estado actual o `undefined` si no hay ninguno activo.
	 */
	public getCurrent(): T | undefined {
		return this.current;
	}

	/**
	 * Obtiene el último estado previo al cambio más reciente.
	 *
	 * @returns El nombre del estado anterior o `undefined` si no hay historial.
	 */
	public getLast(): T | undefined {
		return this.last;
	}

	/**
	 * Elimina cualquier estado activo, ejecuta la limpieza actual si existe
	 * y reinicia las referencias internas.
	 */
	public destroy() {
		this.cleanup?.();
		this.current = undefined;
		this.last = undefined;
		this.cleanup = undefined;
	}
}

/**
 * Función de utilidad para crear una instancia de la clase `State` de forma más concisa.
 *
 * @param states - Mapa de estados y sus manejadores asociados.
 * @returns Una instancia de `State`.
 */
export const createState = <T extends string>(states: StateMap<T>) =>
	new State(states);
