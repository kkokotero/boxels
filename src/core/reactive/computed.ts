import { signal, type Signal } from './signal';
import type { Widen } from './types';
import { autoCleanup } from '@core/cleanup';
import { getTrackedSignals, clearTrackedSignals } from './tracked-signal';

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
	dependenciesOrCompute: Signal<unknown>[] | (() => T | Widen<T>),
	maybeCompute?: () => T | Widen<T>,
): Signal<T> {
	let dependencies: Signal<unknown>[] = [];
	let compute: () => T | Widen<T>;

	// Determinar si se pasaron dependencias explícitas
	if (typeof dependenciesOrCompute === 'function') {
		compute = dependenciesOrCompute;
		dependencies = getTrackedSignals();
		clearTrackedSignals();
	} else {
		if (!maybeCompute) {
			throw new Error(
				'compute callback es requerido si se pasan dependencias explícitas',
			);
		}
		dependencies = dependenciesOrCompute;
		compute = maybeCompute;
	}

	// Señal base que almacenará el resultado computado
	const result = signal(compute());

	// Flag para evitar destrucción múltiple
	let destroyed = false;

	// Función de actualización
	const update = () => {
		if (destroyed) return;
		const value = compute();
		result.set(value as Widen<T>);
	};

	// Suscripciones a las dependencias
	const cleanups = dependencies.map((dep) => dep.subscribe(update));

	// Método de destrucción
	const destroy = () => {
		if (destroyed) return;
		destroyed = true;

		// Limpiar todas las suscripciones
		cleanups.forEach((unsub) => unsub());

		// Destruir la señal interna
		result.destroy();
	};

	// Registrar limpieza automática
	autoCleanup(result).onCleanup(destroy);

	// Devolver señal computada con método destroy
	return Object.assign(result, { destroy }) as Signal<T>;
}
