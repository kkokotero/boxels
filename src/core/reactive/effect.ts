// Importa los tipos necesarios: ReactiveSignal representa una señal reactiva,
// y ReactiveUnsubscribe es una función que cancela la suscripción a una señal.
import type { ReactiveSignal, ReactiveUnsubscribe } from './types';

// Importa el programador (scheduler), utilizado para ejecutar funciones en la cola reactiva.
import { queue } from '../scheduler';

/**
 * Ejecuta un efecto reactivo cuando una o más señales cambian.
 *
 * Esta utilidad observa un conjunto de señales reactivas y vuelve a ejecutar
 * la función `run()` cada vez que alguna de ellas se actualiza.
 *
 * Si `run()` devuelve una función de limpieza (sincrónica o asincrónica),
 * esta será llamada antes de la siguiente ejecución.
 *
 * @param dependencies - Un arreglo de señales que se desean observar.
 * @param run - Función efecto que se ejecutará cuando alguna señal cambie.
 *              Puede ser sincrónica o devolver una Promesa (async).
 * @returns Una función que permite cancelar manualmente el efecto y limpiar recursos.
 *
 * @ejemplo
 * ```ts
 * const count = signal(0);
 * const doubled = signal(0);
 *
 * const stop = effect([count], () => {
 *   doubled.set(count() * 2);
 * });
 *
 * count.set(2); // doubled ahora es 4
 * stop(); // Cancela el efecto
 * ```
 *
 * @ejemplo
 * Efecto asincrónico con limpieza:
 * ```ts
 * effect([count], async () => {
 *   const ctrl = new AbortController();
 *   await fetch("/api", { signal: ctrl.signal });
 *   return () => ctrl.abort(); // Llamado antes de la próxima ejecución o limpieza final
 * });
 * ```
 */
export function effect(
	_dependencies: ReactiveSignal<unknown>[] | ReactiveSignal<unknown>,
	run: () => Promise<void> | void,
): ReactiveUnsubscribe {
	const dependencies = Array.isArray(_dependencies)
		? _dependencies
		: [_dependencies];

	let cleanups: ReactiveUnsubscribe[] = [];
	let lastCleanup: (() => void) | void;

	const wrappedRun = async () => {
		// Limpieza previa solo una vez, no repetir después en cleanup global
		if (lastCleanup) {
			try {
				lastCleanup();
			} catch (e) {
				console.error('error en cleanup previo', e);
			}
		}
		lastCleanup = await run();
	};

	// Suscribirse
	if (dependencies.length > 0) {
		cleanups = dependencies.map((dep) => dep.subscribe(wrappedRun));
	} else {
		queue(wrappedRun);
	}

	const cleanup = () => {
		cleanups.forEach((unsub) => unsub());
		cleanups = [];
		if (lastCleanup) {
			try {
				lastCleanup();
			} catch (e) {
				console.error('error en cleanup final', e);
			}
			lastCleanup = undefined;
		}
	};

	return cleanup;
}
