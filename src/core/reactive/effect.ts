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
	dependencies: ReactiveSignal<unknown>[], // Lista de señales a observar
	run: () => Promise<void> | void,        // Función efecto a ejecutar cuando cambien
): ReactiveUnsubscribe {
	// Lista de funciones para cancelar suscripciones a las señales observadas
	let cleanups: ReactiveUnsubscribe[] = [];

	// Última función de limpieza devuelta por `run()`, si existe
	let lastCleanup: (() => void) | void;

	/**
	 * Envoltura de la función del usuario (`run`):
	 * - Ejecuta la limpieza previa si existe.
	 * - Llama a `run()`, y si devuelve una función de limpieza, la almacena.
	 */
	const wrappedRun = async () => {
		if (lastCleanup) lastCleanup();      // Llama a la limpieza anterior si existe
		lastCleanup = await run();           // Ejecuta el efecto y guarda la nueva limpieza
	};

	if (dependencies.length > 0) {
		// Si hay señales, se suscribe a cada una y ejecuta el efecto cuando cambien
		cleanups = dependencies.map((dep) => dep.subscribe(wrappedRun));
	} else {
		// Si no hay dependencias, se ejecuta una vez (por ejemplo, al montar)
		queue(wrappedRun);
	}

	/**
	 * Función de limpieza del efecto:
	 * - Cancela todas las suscripciones a señales.
	 * - Ejecuta la última función de limpieza devuelta por `run()`, si existe.
	 */
	return () => {
		cleanups.forEach((unsub) => unsub()); // Cancela todas las suscripciones
		if (lastCleanup) lastCleanup();       // Ejecuta limpieza final
	};
}
