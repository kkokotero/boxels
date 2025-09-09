import type { Signal } from './signal';

/**
 * Evita que los literales (true, false, 0, "x") se queden como literales,
 * los ensancha a boolean, number, string.
 */
export type Widen<T> = T extends true | false
	? boolean
	: T extends number
		? number
		: T extends string
			? string
			: T extends bigint
				? bigint
				: T;

/**
 * Una función que recibe el valor actual de una señal y devuelve el nuevo valor.
 * Es usada para actualizar el estado de forma reactiva y derivada del valor anterior.
 *
 * @template T El tipo del valor que mantiene la señal.
 * @example
 * ```ts
 * signal.update(v => v + 1);
 * ```
 */
export type ReactiveUpdate<T> = (v: Widen<T>) => Widen<T>;

/**
 * Función que se devuelve al suscribirse a una señal mediante `subscribe()`.
 * Al ejecutarla, se cancela la suscripción a los cambios del valor.
 *
 * @example
 * ```ts
 * const stop = signal.subscribe(v => console.log(v));
 * stop(); // Detiene la suscripción más tarde
 * ```
 */
export type ReactiveUnsubscribe = () => void;

/**
 * Función que se llama cada vez que el valor de la señal cambia.
 * Se utiliza para escuchar los cambios en una señal reactiva.
 *
 * @template T El tipo del valor mantenido por la señal.
 * @example
 * ```ts
 * const sub: ReactiveSubscribe<number> = (v) => {
 *   console.log("Nuevo valor:", v);
 * };
 * ```
 */
export type ReactiveSubscribe<T> = (newValue: Widen<T>) => void;

export type MaybeSignal<T> = T | Signal<T>;

/**
 * Interfaz que representa una señal reactiva.
 * Una señal es una función que permite obtener su valor actual, además de ser un contenedor de estado
 * con capacidades para suscribirse a cambios y modificar el valor de forma reactiva.
 *
 * @template T El tipo del valor mantenido por la señal.
 */
export interface ReactiveSignal<T> {
	/**
	 * Obtiene el valor actual de la señal.
	 *
	 * @example
	 * ```ts
	 * const count = signal();
	 * ```
	 */
	(): T;
	[Symbol.toPrimitive](): T;

	/** @deprecated solo para que TS lo acepte en if */
	readonly __brand?: T;

	/**
	 * Reemplaza el valor actual de la señal con uno nuevo.
	 * Esto notifica a todos los suscriptores con el nuevo valor.
	 *
	 * @param newValue El nuevo valor a establecer.
	 * @param force Si se pasa como `true`, se notificarán los suscriptores incluso si el valor no cambió.
	 * @example
	 * ```ts
	 * signal.set(10);
	 * ```
	 */
	set(newValue: Widen<T> | T, force?: boolean): void;

	/**
	 * Actualiza el valor de la señal utilizando una función que recibe el valor actual
	 * y devuelve el nuevo valor. Es útil para realizar actualizaciones basadas en el valor anterior.
	 *
	 * @param updater Función que calcula el nuevo valor a partir del anterior.
	 * @example
	 * ```ts
	 * signal.update((v) => v * 2);
	 * ```
	 */
	update(updater: ReactiveUpdate<Widen<T> | T>): void;

	/**
	 * Se suscribe a los cambios del valor de la señal. La función pasada será ejecutada
	 * cada vez que el valor cambie.
	 *
	 * @param subscriber Función que se ejecuta con el nuevo valor cuando cambia.
	 * @returns Una función que, al llamarla, cancela la suscripción.
	 * @example
	 * ```ts
	 * const unsubscribe = signal.subscribe(value => {
	 *   console.log('La señal cambió a:', value);
	 * });
	 *
	 * // Más tarde:
	 * unsubscribe();
	 * ```
	 */
	subscribe(subscriber: ReactiveSubscribe<Widen<T> | T>): ReactiveUnsubscribe;

	/**
	 * Destruye la señal, limpiando todos los suscriptores y referencias internas.
	 * Después de llamar a esta función, la señal ya no puede usarse.
	 *
	 * @example
	 * ```ts
	 * signal.destroy();
	 * ```
	 */
	destroy(): void;

	/**
	 * Bandera booleana que indica si la señal ya fue destruida.
	 * Puede usarse para verificar el estado de la señal.
	 */
	destroyed: boolean;
}

/**
 * Función de utilidad para verificar si un valor es una señal reactiva (`ReactiveSignal`).
 * Actúa como type guard de TypeScript para refinar el tipo en tiempo de ejecución.
 *
 * @param value Cualquier valor a verificar.
 * @returns `true` si el valor cumple con la forma de una señal válida.
 *
 * @example
 * ```ts
 * if (isSignal(thing)) {
 *   console.log('Esto es una señal con valor:', thing());
 * }
 * ```
 */
export function isSignal<T = unknown>(
	value: ReactiveSignal<T> | any,
): value is ReactiveSignal<T> {
	return (
		typeof value === 'function' && // La señal debe ser una función (el getter)
		typeof value.set === 'function' && // Debe tener el método `.set()`
		typeof value.update === 'function' && // Debe tener el método `.update()`
		typeof value.subscribe === 'function' && // Debe tener el método `.subscribe()`
		typeof value.destroy === 'function' // Debe tener el método `.destroy()`
	);
}
