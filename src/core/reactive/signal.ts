// Importa la cola de ejecución reactiva para asegurar que las notificaciones a los suscriptores
// se hagan de forma ordenada y fuera del ciclo actual de ejecución.
import { queue } from '../scheduler';

// Importa una función para comparar profundamente dos valores y verificar si son estrictamente iguales.
// Esto evita actualizaciones innecesarias cuando el nuevo valor es igual al actual.
import { strictDeepEqual } from 'fast-equals';

// Importa los tipos para señales reactivas:
// - ReactiveSignal<T>: interfaz que define el contrato de una señal reactiva.
// - ReactiveSubscribe<T>: tipo de función que se llama cuando el valor cambia.
// - ReactiveUnsubscribe: tipo de función que cancela una suscripción.
// - ReactiveUpdate<T>: función que actualiza el valor actual basado en su estado anterior.
import type {
	ReactiveSignal,
	ReactiveSubscribe,
	ReactiveUnsubscribe,
	ReactiveUpdate,
} from './types';

import { __development__ } from '../../environment';

/**
 * Crea una señal reactiva, que es una abstracción para manejar un valor que puede cambiar
 * en el tiempo y notificar a los suscriptores cuando dicho valor cambia.
 *
 * @param initialValue - Valor inicial de la señal.
 * @returns Un objeto que representa la señal, con métodos para leer, escribir, actualizar, suscribirse y destruirla.
 */
export function signal<T>(initialValue: T): ReactiveSignal<T> {
	// Valor interno de la señal, inicialmente igual al valor recibido.
	let value: T = initialValue;

	// Conjunto de funciones (subscriptores) que serán notificadas cuando el valor cambie.
	const subscribers = new Set<ReactiveSubscribe<T>>();

	// Indicador de si esta señal ha sido destruida. Sirve para evitar operaciones posteriores.
	let destroyed = false;

	/**
	 * Función de lectura del valor actual.
	 * @returns El valor actual de la señal.
	 */
	const read = () => value;

	/**
	 * Establece un nuevo valor en la señal. Si el nuevo valor es diferente al actual (según comparación profunda),
	 * o si se fuerza la actualización, se notifica a todos los suscriptores.
	 *
	 * @param newValue - El nuevo valor a asignar.
	 * @param force - Si es `true`, forzará la actualización aunque el valor sea igual.
	 */
	const set = (newValue: T, force = false) => {
		// Evita operaciones si la señal fue destruida.
		if (destroyed) {
			console.warn('Tried to set a value on a destroyed signal.');
			return;
		}

		// Solo actualiza si el valor ha cambiado o se ha indicado forzar la actualización.
		if (!strictDeepEqual(newValue, value) || force) {
			value = newValue;

			// Encola la notificación a los suscriptores.
			queue(() => {
				for (const subscriber of subscribers) {
					if (!destroyed) {
						try {
							subscriber(value); // Notifica al suscriptor con el nuevo valor.
						} catch (err) {
							console.error('Signal subscriber error:', err);
						}
					}
				}
			});
		}
	};

	/**
	 * Actualiza el valor de la señal con base en su valor actual.
	 * Es una forma conveniente de hacer una operación tipo `signal.set(signal() + 1)`.
	 *
	 * @param updater - Función que recibe el valor actual y devuelve el nuevo valor.
	 */
	const update = (updater: ReactiveUpdate<T>) => {
		set(updater(value));
	};

	/**
	 * Permite suscribirse a los cambios de la señal.
	 * Se llama inmediatamente con el valor actual, y luego cada vez que cambia.
	 *
	 * @param subscriber - Función que se llama con el nuevo valor cada vez que cambia.
	 * @returns Función para cancelar la suscripción.
	 */
	const subscribe = (subscriber: ReactiveSubscribe<T>): ReactiveUnsubscribe => {
		// No permite suscripciones si la señal está destruida.
		if (destroyed) {
			console.warn('Tried to subscribe to a destroyed signal.');
			return () => {};
		}

		// Agrega el suscriptor al conjunto.
		subscribers.add(subscriber);

		// Encola una notificación inmediata con el valor actual.
		queue(() => {
			if (!destroyed) {
				try {
					subscriber(value);
				} catch (err) {
					console.error('Signal subscriber error:', err);
				}
			}
		});

		// Devuelve una función para eliminar el suscriptor cuando ya no se necesita.
		return () => {
			subscribers.delete(subscriber);
		};
	};

	/**
	 * Destruye la señal: limpia todos los suscriptores y marca la señal como destruida.
	 * Una señal destruida no puede volver a usarse.
	 */
	const destroy = () => {
		if (destroyed) return;
		destroyed = true;
		subscribers.clear();
	};

	const newSignal = Object.assign(read, {
		set,
		update,
		subscribe,
		destroy,
		destroyed,
	}) as ReactiveSignal<T>;

	if (__development__) {
		if (!(window as any).boxels.signals) (window as any).boxels.signals = [];
		((window as any).boxels.signals as ReactiveSignal<unknown>[]).push(
			newSignal,
		);
	}

	// Devuelve la función de lectura (`read`) extendida con métodos de escritura, suscripción y control de vida útil.
	// Esto permite usar la señal como función (`signal()`) para leer, o como objeto para modificar.
	return newSignal;
}
