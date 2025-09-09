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
import { autoCleanup } from '@core/cleanup';

/**
 * ======================================================
 * Enhanced Type Helpers
 * ======================================================
 */

/**
 * @description
 * Maps primitive types to their corresponding wrapper objects while preserving methods
 */
type PrimitiveToObject<T> = T extends string
	? string
	: T extends number
		? number
		: T extends boolean
			? boolean
			: T extends bigint
				? bigint
				: T extends undefined | null
					? never
					: T extends object
						? T
						: never;

/**
 * @description
 * Helper type for method signatures
 */
type MethodType = (...args: unknown[]) => unknown;

/**
 * @description
 * Transforms object properties into signalized versions with proper method typing
 */
type SignalProps<O> = {
	[K in keyof O]: O[K] extends MethodType
		? (...args: Parameters<O[K]>) => Signal<ReturnType<O[K]>>
		: Signal<O[K]>;
};

/**
 * @description
 * Main Signal type that provides better inference for nested properties
 */
export type Signalize<T> = T extends MethodType
	? (...args: Parameters<T>) => Signalize<ReturnType<T>>
	: T extends primitive
		? ReactiveSignal<T> & SignalProps<PrimitiveToObject<T>>
		: T extends (infer U)[] // caso Array especial
			? ReactiveSignal<T> & {
					[index: number]: Signalize<U>; // cada índice es un Signal
					length: Signal<number>; // longitud como Signal
				} & Pick<T, Exclude<keyof T, keyof any[]>> // conserva métodos de Array tal cual
			: T extends object
				? ReactiveSignal<T> & { [K in keyof T]: Signalize<T[K]> }
				: ReactiveSignal<T>;

/**
 * @description
 * Helper type for primitives
 */
type primitive = string | number | boolean | bigint | undefined | null;

/**
 * ======================================================
 * Runtime Implementation
 * ======================================================
 */

export type Signal<T> = Signalize<T> &
	Signalize<Widen<T>> &
	ReactiveSignal<Widen<T>> &
	Widen<T> & {
		[Symbol.toPrimitive](): Widen<T>;
		/** @deprecated solo para que TS lo acepte en if */
		readonly __brand?: T;
	};

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
export function signal<T>(initialValue: T): Signal<T> {
	// Estado interno del valor actual
	let value = initialValue as Widen<T>;

	// Conjunto de suscriptores que reaccionan a cambios
	const subscribers = new Set<ReactiveSubscribe<T>>();

	// Bandera de destrucción
	let destroyed = false;
	let isDisposed = false;

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

		return () => {
			subscribers.delete(subscriber);
			// Solo destruir si ya estamos marcados como disposed *y* no quedan suscriptores
			if (isDisposed && subscribers.size === 0) {
				destroy();
			}
		};
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
		// dentro de new Proxy(baseSignal, { ... })
		get(target, prop, receiver) {
			// Si se accede a una propiedad propia de la API, devolverla
			if (prop in target) {
				return Reflect.get(target, prop, receiver);
			}

			// Valor actual de la propiedad
			const current = value != null ? (value as any)[prop] : undefined;

			// Si es un método: crear wrapper que detecta mutaciones dinámicamente
			if (typeof current === 'function') {
				return (...args: any[]) => {
					// Snapshot superficial del "value" antes de ejecutar el método
					let beforeSnapshot: any = value;
					if (Array.isArray(value)) beforeSnapshot = (value as any).slice();
					else if (value != null && typeof value === 'object')
						beforeSnapshot = Object.assign({}, value as any);

					// Ejecutar el método con el "this" correcto
					// biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
					let result;
					try {
						result = current.apply(value, args);
					} catch (err) {
						// Si la ejecución falla, devolvemos un derived signal con undefined
						const errDerived = signal<any>(undefined);
						// Suscribir para intentar recomputar si padre cambia
						subscribe((v) => {
							try {
								const fn = v != null ? (v as any)[prop] : undefined;
								if (typeof fn === 'function') {
									const res = fn.apply(v, args);
									if (isSignal(errDerived)) errDerived.set(res);
								} else if (isSignal(errDerived)) errDerived.set(undefined);
							} catch {
								if (isSignal(errDerived)) errDerived.set(undefined);
							}
						});
						return errDerived as Signal<any>;
					}

					// Detectar si hubo mutación superficial comparando beforeSnapshot y value actual
					const mutated = !strictDeepEqual(beforeSnapshot, value);

					if (mutated) {
						// Si hubo mutación, notificar al root (no forzamos un nuevo object si la mutación fue in-place)
						// Llamamos set con el mismo objeto para que se actualicen subscribers/children.
						// set hace internamente strictDeepEqual, pero aquí puede ser la misma referencia cambiada,
						// por eso no pasamos `force = true` salvo que quieras forzar siempre la notificación.
						set(value as any, true);
						// Si el método devuelve algo (p. ej. push -> number), devolvemos eso tal cual.
						return result;
					}

					// Si no mutó: devolver un derived signal con el resultado (como antes)
					const initial = result;
					const derived = signal(initial);

					// Resuscribir a cambios del padre para recomputar el resultado dinámicamente
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

					return derived as unknown as Signal<any>;
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

	autoCleanup(proxy).onCleanup(() => {
		destroy();
		isDisposed = true;
	});

	// Retorno final tipado como `Signalize<T>`
	return proxy as unknown as Signal<T>;
}
