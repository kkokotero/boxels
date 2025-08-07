import { effect, isSignal, queue, type ReactiveSignal } from '@core/index';
import { $, Fragment, isBoxelsElement } from '@dom/index';
import { strictDeepEqual } from 'fast-equals';

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
	each: ReactiveSignal<T[]> | (() => T[]) | T[];

	/**
	 * Función que se llama por cada elemento del arreglo.
	 * Debe retornar:
	 * - Un JSX.Element directamente
	 * - O un `ReactiveSignal` de JSX.Element si deseas que sea dinámico
	 */
	children: (
		item: T,
		index: number,
	) => JSX.Element | ReactiveSignal<JSX.Element>;

	/**
	 * Elemento a renderizar si el arreglo está vacío.
	 */
	fallback?: JSX.Element;

	/**
	 * Función opcional que retorna una clave única para cada item.
	 * Se usa para identificar los elementos y optimizar el reordenamiento del DOM.
	 */
	track?: (item: T, index: number) => unknown;
};

/**
 * Representa la estructura interna para mantener el estado de cada item renderizado.
 */
type Entry<T> = {
	key: unknown; // Clave única para identificar el item
	item?: ReactiveSignal<T> | T; // El valor del item (reactivo o no)
	itemStartMarker: Comment; // Marcador inicial en el DOM para el item
	itemEndMarker: Comment; // Marcador final en el DOM para el item
	nodes: Node[] | Node | JSX.Element | ReactiveSignal<JSX.Element>; // Representación renderizada
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
 *     <For each={users} track={(user) => user.id} fallback={<p>No users</p>}>
 *       {(user, i) => <p>{user.name}</p>}
 *     </For>
 *   </div>
 * );
 * ```
 *
 * @template T - Tipo de cada elemento en la lista
 */
export function For<T>({ each, children, fallback, track }: ForProps<T>) {
	// Marcadores para envolver toda la sección del <For />
	const forStartMarker = document.createComment('');
	const forEndMarker = document.createComment('');

	// Mapa actual de entradas renderizadas
	let entries = new Map<unknown, Entry<T>>();

	// Bandera para saber si se está mostrando el fallback
	let isEmpty = false;

	/**
	 * Función principal que actualiza el contenido del componente
	 * en respuesta a cambios en los datos.
	 */
	const update = async () => {
		// Extrae los elementos según el tipo de `each`
		const items = isSignal(each)
			? each()
			: typeof each === 'function'
				? each()
				: each;

		// Si el arreglo está vacío, limpiar DOM y mostrar fallback
		if (items.length === 0) {
			const range = document.createRange();
			range.setStartAfter(forStartMarker);
			range.setEndBefore(forEndMarker);
			range.deleteContents();

			// Insertar fallback
			forEndMarker.before($(Fragment, {}, fallback || ''));
			entries.clear();
			isEmpty = true;
			return;
		}

		// Si anteriormente estaba vacío, limpiar el fallback
		if (isEmpty) {
			const range = document.createRange();
			range.setStartAfter(forStartMarker);
			range.setEndBefore(forEndMarker);
			range.deleteContents();
			isEmpty = false;
		}

		const newMap = new Map<unknown, Entry<T>>();
		const usedKeys = new Set<unknown>();
		let lastNode: Node = forStartMarker;

		// Itera sobre cada nuevo item
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			const key = track ? track(item, i) : i;

			if (usedKeys.has(key)) {
				console.warn('[For] Clave duplicada:', key);
				continue;
			}
			usedKeys.add(key);

			let entry = entries.get(key);

			// Si no existe, crear una nueva entrada
			if (!entry) {
				const itemStartMarker = document.createComment('');
				const itemEndMarker = document.createComment('');

				// Insertar marcadores en el DOM
				forEndMarker.before(itemStartMarker, itemEndMarker);

				// Renderizar el contenido
				const vnode = isBoxelsElement(children)
					? (children as unknown as (...args: any) => Node)(item, i)
					: children(item, i);

				itemEndMarker.before(vnode as Node);

				// Si el item es una señal, crear un efecto reactivo
				if (isSignal(item)) {
					const currentKey = key;
					effect([item], () => {
						const entry = entries.get(currentKey);
						if (!entry) return;

						const range = document.createRange();
						range.setStartAfter(entry.itemStartMarker);
						range.setEndBefore(entry.itemEndMarker);
						range.deleteContents();

						const vnode = isBoxelsElement(children)
							? (children as unknown as (...args: any) => Node)(item, i)
							: children(item, i);

						entry.itemEndMarker.before($(Fragment, {}, vnode));
						entry.nodes = vnode;
					});
				}

				entry = {
					key,
					item,
					itemStartMarker,
					itemEndMarker,
					nodes: vnode,
				};
			} else {
				// Si el item ha cambiado (profundamente), actualizar su contenido
				if (!strictDeepEqual(entry.item, item)) {
					entry.item = item;

					const vnode = isBoxelsElement(children)
						? (children as unknown as (...args: any) => Node)(item, i)
						: children(item, i);

					const range = document.createRange();
					range.setStartAfter(entry.itemStartMarker);
					range.setEndBefore(entry.itemEndMarker);
					range.deleteContents();

					entry.itemEndMarker.before(vnode as Node);
					entry.nodes = vnode;
				}
			}

			// Asegurarse de que los nodos están en el lugar correcto del DOM
			if (entry.itemStartMarker.previousSibling !== lastNode) {
				const range = document.createRange();
				range.setStartBefore(entry.itemStartMarker);
				range.setEndAfter(entry.itemEndMarker);
				const nodesToMove = range.extractContents();
				lastNode.parentNode?.insertBefore(nodesToMove, lastNode.nextSibling);
			}

			// Guardar la nueva entrada
			newMap.set(key, entry);
			lastNode = entry.itemEndMarker;
		}

		// Eliminar las entradas que ya no están presentes
		for (const [key, oldEntry] of entries) {
			if (!newMap.has(key)) {
				const range = document.createRange();
				range.setStartBefore(oldEntry.itemStartMarker);
				range.setEndAfter(oldEntry.itemEndMarker);
				range.deleteContents();
			}
		}

		// Reemplazar el mapa antiguo con el nuevo
		entries = newMap;
	};

	// Si `each` es una señal reactiva, se crea un efecto que actualiza automáticamente
	if (isSignal(each)) {
		effect([each], update);
	} else {
		queue(update); // En caso contrario, solo se ejecuta una vez
	}

	// Retornar los nodos marcador para insertar el contenido generado
	return [forStartMarker, forEndMarker];
}
