import { type MaybeSignal, type Signal } from '@core/index';
import { $, Fragment } from '@dom/index';

/**
 * Propiedades que acepta el componente `For`, el cual permite renderizar listas de forma reactiva.
 *
 * @template T - Tipo de cada elemento dentro del arreglo.
 */
type ForProps<T> = {
	/**
	 * Fuente de datos a iterar, que puede ser:
	 * - Un `ReactiveSignal` que contiene un arreglo
	 * - Una función que retorna un arreglo
	 * - Un arreglo estático
	 */
	each: MaybeSignal<T[]>;

	/**
	 * Función que se llama por cada elemento del arreglo.
	 * Debe retornar:
	 * - Un JSX.Element directamente
	 * - O un `ReactiveSignal` de JSX.Element si deseas que sea dinámico
	 */
	children: (
		item: T,
		index: number,
	) => JSX.Element | Signal<JSX.Element>;
};

/**
 * Componente `For`, similar al método `map`, pero reactivo y optimizado.
 * Permite renderizar listas, con soporte para claves únicas, actualizaciones diferenciales
 * y vista alternativa cuando la lista está vacía.
 *
 * @example
 * ```tsx
 * const users = signal([{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }]);
 *
 * const view = (
 *   <div>
 *     <For each={users}>
 *       {(user, i) => <p>{user.name}</p>}
 *     </For>
 *   </div>
 * );
 * ```
 *
 * @template T - Tipo de cada elemento en la lista
 */
export function For<T>({ each, children }: ForProps<T>) {
	return $(Fragment, {
		children: each.map(children),
	});
}
