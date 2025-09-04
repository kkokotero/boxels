import { signal, type Signal, type Signalize } from './signal';
import type { ReactiveSignal, Widen } from './types';
import { autoCleanup } from '@core/cleanup';

/**
 * Crea una **señal computada** (`computed signal`) basada en una o más dependencias reactivas.
 * El valor computado se actualiza automáticamente cada vez que alguna de las dependencias cambia.
 *
 * @template T Tipo del valor computado.
 *
 * @param dependencies Un arreglo de instancias `ReactiveSignal` que se observarán para detectar cambios.
 * @param compute Una función que devuelve el valor computado. Esta función se ejecuta cada vez que
 *                una dependencia cambia.
 * @returns Una nueva `ReactiveSignal<T>` que representa el valor computado y se actualiza de forma reactiva.
 *
 * @example
 * ```ts
 * const first = signal('John');
 * const last = signal('Doe');
 *
 * const fullName = computed([first, last], () => `${first()} ${last()}`);
 *
 * console.log(fullName()); // "John Doe"
 *
 * first.set('Jane');
 * console.log(fullName()); // "Jane Doe"
 * ```
 */
export function computed<T>(
	dependencies: Signal<unknown>[],
	compute: () => T | Widen<T>,
): Signal<T> {
	// Crea una señal base que almacena el resultado inicial de la función computada.
	// Esta señal se comporta como cualquier otra, pero su valor será controlado internamente.
	const result = signal(compute());

	/**
	 * Función interna `update`.
	 * Esta función se llama automáticamente cada vez que alguna de las dependencias cambia.
	 * Se encarga de recalcular el valor computado y actualizar la señal `result`.
	 */
	const update = () => {
		const value = compute(); // Vuelve a calcular el valor
		result.set(value as Widen<T>); // Actualiza el valor de la señal resultante
	};

	// Se suscribe a todas las señales dependientes. Cada vez que alguna cambie, se ejecutará `update`.
	// La función `subscribe` devuelve una función de limpieza (`unsubscribe`) para cancelar la suscripción.
	const cleanups = dependencies.map((dep) => dep.subscribe(update));

	/**
	 * Método de destrucción mejorado (`destroy`).
	 * Este método limpia todas las suscripciones a las dependencias y también destruye la señal interna.
	 * Se asegura de que `destroy` solo se ejecute una vez, gracias al flag `destroyed`.
	 */
	const destroy = () => {
		if (result.destroyed) return; // Evita destruir más de una vez
		result.destroyed = true; // Marca la señal como destruida

		// Llama a cada función de limpieza para cancelar las suscripciones
		cleanups.forEach((unsub) => unsub());

		// Destruye la señal interna (libera memoria, listeners, etc.)
		result.destroy();
	};

	autoCleanup(result).onCleanup(destroy);

	// Devuelve la señal computada (`result`), pero con el método `destroy` incorporado.
	// Esto permite que los consumidores puedan limpiar manualmente si lo necesitan.
	return Object.assign(result, { destroy }) as Signal<T>;
}
