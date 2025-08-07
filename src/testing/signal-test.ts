// testing/signalTestUtils.ts

// Importa el tipo ReactiveSignal, que representa un valor reactivo que puede emitir actualizaciones.
import type { ReactiveSignal } from '@core/reactive/types';

// Importa la función 'queue', que permite encolar tareas para ejecutarse en el siguiente ciclo del scheduler.
import { queue } from '@core/scheduler';

/**
 * Captura las emisiones (valores emitidos) de un `signal` de manera acumulativa.
 *
 * Esta utilidad es especialmente útil durante pruebas (tests) para verificar qué valores
 * ha emitido un `ReactiveSignal` a lo largo del tiempo.
 *
 * @param signal El `ReactiveSignal` que se desea observar.
 * @returns Un objeto que contiene:
 *   - `values`: un arreglo con los valores emitidos en orden.
 *   - `stop()`: una función para cancelar la suscripción.
 *   - `clear()`: una función para limpiar los valores capturados.
 */
export function captureSignal<T>(signal: ReactiveSignal<T>) {
	// Arreglo donde se almacenarán los valores emitidos por el signal.
	const values: T[] = [];

	// Se suscribe al signal y agrega cada nuevo valor al arreglo.
	const unsubscribe = signal.subscribe((v) => {
		values.push(v);
	});

	// Devuelve un objeto con:
	// - El arreglo de valores capturados.
	// - Una función para detener la suscripción (evita más capturas).
	// - Una función para limpiar el historial de valores capturados.
	return {
		values,
		stop: unsubscribe,
		clear: () => {
			// Limpia el arreglo sin cambiar su referencia.
			values.length = 0;
		},
	};
}

/**
 * Suscribe una función "espía" (spy) a un `signal` y captura cada llamada.
 *
 * Esta función es útil para verificar si un `signal` se ha emitido, cuántas veces,
 * y con qué valores, generalmente dentro de pruebas automatizadas.
 *
 * @param signal El `ReactiveSignal` que se desea observar.
 * @returns Un objeto que contiene:
 *   - `calls`: un arreglo con los valores que se han recibido.
 *   - `spy`: la función que se usó como callback, por si se requiere inspección adicional.
 *   - `stop()`: función para cancelar la suscripción al `signal`.
 *   - `clear()`: función para vaciar el arreglo de llamadas capturadas.
 */
export function spySignal<T>(signal: ReactiveSignal<T>) {
	// Arreglo para almacenar los valores con los que fue llamada la función espía.
	const calls: T[] = [];

	// Función que actuará como callback del signal, y registrará cada valor recibido.
	const spy = (v: T) => {
		calls.push(v);
	};

	// Se suscribe al signal usando la función espía.
	const unsubscribe = signal.subscribe(spy);

	// Devuelve un objeto con:
	// - El historial de llamadas (valores).
	// - La función espía en sí (por si se necesita pasar a otro lugar).
	// - stop(): para cancelar la suscripción.
	// - clear(): para vaciar el historial.
	return {
		calls,
		spy,
		stop: unsubscribe,
		clear: () => {
			calls.length = 0;
		},
	};
}

/**
 * Espera de forma asíncrona la próxima emisión de un `signal`.
 *
 * Esto es útil cuando se desea comprobar un único cambio en el `signal`,
 * por ejemplo, cuando se espera que un evento reactive se dispare exactamente una vez.
 *
 * @param signal El `ReactiveSignal` que se desea observar.
 * @returns Una promesa que se resuelve con el siguiente valor emitido por el `signal`.
 */
export function once<T>(signal: ReactiveSignal<T>): Promise<T> {
	// Retorna una promesa que se resolverá en cuanto el signal emita un valor.
	return new Promise<T>((resolve) => {
		// Se suscribe al signal. Apenas se emita un valor, se cancela la suscripción y se resuelve la promesa.
		const stop = signal.subscribe((v) => {
			stop();     // Cancela la suscripción inmediatamente después de la primera emisión.
			resolve(v); // Resuelve la promesa con el valor emitido.
		});
	});
}

/**
 * Verifica si un `signal` ha sido destruido.
 *
 * @param signal El `ReactiveSignal` que se desea inspeccionar.
 * @returns `true` si el signal está destruido, `false` en caso contrario.
 */
export function isSignalDestroyed(signal: ReactiveSignal<unknown>): boolean {
	return signal.destroyed;
}

/**
 * Destruye un `signal` y espera de forma asíncrona hasta que esté completamente destruido.
 *
 * Esta función es útil para pruebas donde se requiere garantizar que la destrucción de un signal
 * ha ocurrido y se ha propagado correctamente.
 *
 * @param signal El `ReactiveSignal` a destruir.
 * @returns Una promesa que se resuelve en cuanto el signal es destruido.
 */
export function destroySignalAndWait(
	signal: ReactiveSignal<unknown>,
): Promise<boolean> {
	return new Promise<boolean>((resolve) => {
		let destroyed = false; // Marca si se debe proceder a resolver tras la próxima emisión.

		// Se suscribe al signal para detectar su próxima emisión (puede ser consecuencia de la destrucción).
		const subscriber = signal.subscribe(() => {
			if (destroyed) {
				// Si ya fue marcado como destruido, se resuelve la promesa y se cancela la suscripción.
				resolve(true);
				subscriber(); // Cancela la suscripción.
			}
		});

		// Encola la destrucción para ejecutarla en el próximo ciclo del scheduler.
		queue(() => {
			destroyed = true;
			signal.destroy(); // Marca el signal como destruido.
		});
	});
}
