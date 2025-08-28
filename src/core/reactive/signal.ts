// Imports necesarios
import { queue } from '../scheduler';
import { strictDeepEqual } from 'fast-equals';
import {
	isSignal,
	type ReactiveSignal,
	type ReactiveSubscribe,
	type ReactiveUnsubscribe,
	type ReactiveUpdate,
	type Widen,
} from './types';
import { __development__ } from '../../environment';

/**
 * ======================================================
 * Helpers de tipos
 * ======================================================
 */

/**
 * @description
 * Mapea tipos primitivos a sus "objetos wrapper" correspondientes (String, Number, Boolean, ...).
 * Esto permite poder exponer también métodos y propiedades de esos wrappers en los signals.
 */
export type PrimitiveToObject<T> = T extends string
	? String
	: T extends number
		? Number
		: T extends boolean
			? Boolean
			: T extends bigint
				? Object
				: {};

/**
 * @description
 * Convierte todas las propiedades de un objeto en su versión "signalizada".
 * - Si la propiedad es un método, se convierte en una función que devuelve un `Signalize<R>`.
 * - Si la propiedad es un valor, se convierte recursivamente en `Signalize`.
 */
export type SignalProps<O> = {
	[K in keyof O]: O[K] extends (...args: infer P) => infer R
		? (...args: P) => Signalize<R>
		: Signalize<O[K]>;
};

/**
 * @description
 * Tipo principal que transforma T en su versión reactiva (`Signalize<T>`).
 * - Funciones → función que retorna `Signalize<R>`.
 * - Primitivos → `ReactiveSignal<T>` extendido con métodos/props del wrapper.
 * - Objetos → `ReactiveSignal<T>` con cada propiedad envuelta en un `Signalize`.
 */
export type Signalize<T> = T extends (...args: infer P) => infer R
	? (...args: P) => Signalize<R>
	: [T] extends [string | number | boolean | bigint]
		? ReactiveSignal<T> & SignalProps<PrimitiveToObject<T>>
		: T extends object
			? ReactiveSignal<T> & { [K in keyof T]: Signalize<T[K]> }
			: ReactiveSignal<T>;

/**
 * ======================================================
 * Implementación runtime
 * ======================================================
 */

/**
 * @description
 * Crea un `signal` reactivo a partir de un valor inicial.
 * - Expone una API con `set`, `update`, `subscribe`, `destroy`.
 * - Soporta acceso granular a propiedades mediante un `Proxy`.
 * - Propiedades y métodos del valor se convierten en signals hijos.
 *
 * @param initialValue Valor inicial del signal
 * @returns Un `Signalize<T>`, que combina el valor con API reactiva.
 */
export function signal<T>(
	initialValue: Widen<T> | T,
): Signalize<Widen<T>> & ReactiveSignal<Widen<T>> {
	// Estado interno del valor actual
	let value = initialValue as Widen<T>;

	// Conjunto de suscriptores que reaccionan a cambios
	const subscribers = new Set<ReactiveSubscribe<T>>();

	// Bandera de destrucción
	let destroyed = false;

	// Caché de signals hijos (para propiedades del objeto envuelto)
	const childSignals = new Map<PropertyKey, ReactiveSignal<any>>();

	/**
	 * @description Devuelve el valor actual del signal.
	 */
	const read = () => value;

	/**
	 * @description Establece un nuevo valor al signal.
	 * - Si el valor cambió (o `force = true`), notifica a suscriptores.
	 * - También actualiza los signals hijos.
	 */
	const set = (newValue: Widen<T>, force = false) => {
		if (destroyed) return;

		if (!strictDeepEqual(newValue, value) || force) {
			value = newValue;

			// Actualizar hijos (si existen)
			childSignals.forEach((child, key) => {
				try {
					const childValue = value != null ? (value as any)[key] : undefined;
					if (isSignal(child)) child.set(childValue);
				} catch {
					if (isSignal(child)) child.set(undefined);
				}
			});

			// Notificar suscriptores encolados en el scheduler
			queue(() => {
				for (const subscriber of subscribers) {
					if (!destroyed) {
						try {
							subscriber(value);
						} catch (err) {
							console.error('Error en suscriptor de signal:', err);
						}
					}
				}
			});
		}
	};

	/**
	 * @description Actualiza el valor usando una función updater.
	 */
	const update = (updater: ReactiveUpdate<T>) => {
		set(updater(value));
	};

	/**
	 * @description Suscribe una función a cambios del signal.
	 * Devuelve una función `unsubscribe` para eliminar la suscripción.
	 */
	const subscribe = (subscriber: ReactiveSubscribe<T>): ReactiveUnsubscribe => {
		if (destroyed) return () => {};
		subscribers.add(subscriber);

		// Emitir valor inicial en el próximo ciclo
		queue(() => {
			if (!destroyed) {
				try {
					subscriber(value);
				} catch (err) {
					console.error('Error en suscriptor de signal:', err);
				}
			}
		});

		return () => subscribers.delete(subscriber);
	};

	/**
	 * @description Destruye el signal:
	 * - Limpia suscriptores e hijos.
	 * - Marca la señal como inutilizable.
	 */
	const destroy = () => {
		if (destroyed) return;
		destroyed = true;
		subscribers.clear();
		childSignals.forEach((child) => child.destroy());
		childSignals.clear();
	};

	/**
	 * @description API base del signal (objeto principal).
	 */
	const baseSignal = Object.assign(read, {
		set,
		update,
		subscribe,
		destroy,
		get destroyed() {
			return destroyed;
		},
	}) as ReactiveSignal<T>;

	/**
	 * @description Proxy que permite:
	 * - Acceder a la API del signal (`set`, `subscribe`, etc.).
	 * - Acceder a propiedades como signals hijos.
	 * - Acceder a métodos como signals derivados.
	 */
	const proxy = new Proxy(baseSignal, {
		get(target, prop, receiver) {
			// Si se accede a una propiedad propia de la API, devolverla
			if (prop in target) {
				return Reflect.get(target, prop, receiver);
			}

			// Valor actual de la propiedad
			const current = value != null ? (value as any)[prop] : undefined;

			// Si es un método: crear signal derivado
			if (typeof current === 'function') {
				return (...args: any[]) => {
					const initial =
						value != null ? current.apply(value, args) : undefined;
					const derived = signal(initial);

					// Resuscribir a cambios del padre
					subscribe((v) => {
						try {
							const fn = v != null ? (v as any)[prop] : undefined;
							if (typeof fn === 'function' && isSignal(derived)) {
								const res = fn.apply(v, args);
								derived.set(res);
							} else if (isSignal(derived)) {
								derived.set(undefined);
							}
						} catch {
							if (isSignal(derived)) derived.set(undefined);
						}
					});

					return derived as unknown as Signalize<any>;
				};
			}

			// Si es una propiedad normal: crear/caché un signal hijo
			if (!childSignals.has(prop)) {
				const child = signal(current);
				subscribe((v) => {
					const childValue = v != null ? (v as any)[prop] : undefined;
					if (isSignal(child)) child.set(childValue);
				});
				if (isSignal(child)) childSignals.set(prop, child);
			}

			return childSignals.get(prop)!;
		},

		// No se permite asignación directa a propiedades del proxy
		set(target, prop, value, receiver) {
			// Si la propiedad existe en la API del signal (ej: .set, .update, .destroy),
			// asignar directamente al target
			if (prop in target) {
				return Reflect.set(target, prop, value, receiver);
			}

			// Actualizar el valor "crudo" interno
			const current = target(); // obtiene el valor actual del signal raíz
			if (current != null && typeof current === 'object') {
				(current as any)[prop] = value;
				// Notificar al signal raíz para que emita el nuevo objeto
				target.set({ ...current });
			}

			// Si existe un childSignal para esa propiedad → actualizarlo también
			if (childSignals.has(prop)) {
				const child = childSignals.get(prop)!;
				if (isSignal(child)) child.set(value);
			}

			return true;
		},
	});

	/**
	 * @description Registro en devtools (modo desarrollo).
	 */
	if (__development__) {
		if (!(window as any).boxels) (window as any).boxels = {};
		if (!(window as any).boxels.signals) (window as any).boxels.signals = [];
		((window as any).boxels.signals as ReactiveSignal<unknown>[]).push(
			proxy as ReactiveSignal<unknown>,
		);
	}

	// Retorno final tipado como `Signalize<T>`
	return proxy as unknown as Signalize<Widen<T>> & ReactiveSignal<Widen<T>>;
}
