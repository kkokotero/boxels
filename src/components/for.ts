import { effect, isSignal, queue, type ReactiveSignal } from '@core/index';
import { strictDeepEqual } from 'fast-equals';
import { Fragment } from './fragment';
import { debug } from '@testing/debugger';
import { $, createChangeOverlay } from '@dom/index';

function normalizeNode(node: any): Node {
	if (node == null) return document.createTextNode('');
	if (node instanceof Node) return node;
	if (Array.isArray(node)) {
		const frag = document.createDocumentFragment();
		for (const n of node) frag.appendChild(normalizeNode(n));
		return frag;
	}
	// Por si devuelve string o número
	if (typeof node === 'string' || typeof node === 'number') {
		return document.createTextNode(String(node));
	}
	throw new Error('[For] El nodo no es válido');
}

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
	cleanUp: () => void;
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
export function For<T>({
	each,
	children,
	fallback = $(document.createDocumentFragment(), {}),
	track,
}: ForProps<T>) {
	// Marcadores para envolver toda la sección del <For />
	const forStartMarker = document.createComment(
		debug.isShowCommentNames() ? 'for:start' : '',
	);
	const forEndMarker = document.createComment(
		debug.isShowCommentNames() ? 'for:end' : '',
	);

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
			isEmpty = true;
			entries.clear();

			if (!forStartMarker.parentElement && ! forEndMarker.parentElement) return;
			const range = document.createRange();
			range.setStartAfter(forStartMarker);
			range.setEndBefore(forEndMarker);
			range.deleteContents();

			// Insertar fallback
			forEndMarker.before(fallback || '');
			return;
		}

		// Si anteriormente estaba vacío, limpiar el fallback
		if (isEmpty) {
			isEmpty = false;

			if (!forStartMarker.parentElement && ! forEndMarker.parentElement) return;

			const range = document.createRange();
			range.setStartAfter(forStartMarker);
			range.setEndBefore(forEndMarker);
			range.deleteContents();
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
				const itemStartMarker = document.createComment(
					debug.isShowCommentNames() ? 'for-item:start' : '',
				);
				const itemEndMarker = document.createComment(
					debug.isShowCommentNames() ? 'for-item:end' : '',
				);

				// Insertar marcadores en el DOM
				forEndMarker.before(itemStartMarker, itemEndMarker);

				// Renderizar el contenido
				let vnode: Node | Node[] | JSX.Element;
				if (typeof children === 'function') {
					vnode = children(item, i);
				} else {
					// children no es función, usamos directamente
					vnode = children;
				}

				if (vnode instanceof Node) {
					vnode = vnode.cloneNode(true);
				}

				itemEndMarker.before(normalizeNode(vnode));

				const cleanups: (() => void)[] = [];

				// Si el item es una señal, crear un efecto reactivo
				if (isSignal(item)) {
					const currentKey = key;
					cleanups.push(
						effect([item], () => {
							const entry = entries.get(currentKey);
							if (!entry) return;

							const range = document.createRange();
							range.setStartAfter(entry.itemStartMarker);
							range.setEndBefore(entry.itemEndMarker);
							range.deleteContents();

							let vnode: Node | Node[] | JSX.Element;
							if (typeof children === 'function') {
								vnode = children(item, i);
							} else {
								// children no es función, usamos directamente
								vnode = children;
							}

							if (vnode instanceof Node) {
								vnode = vnode.cloneNode(true);
							}

							const node = normalizeNode(vnode);

							entry.itemEndMarker.before(node);
							cleanups.push(createChangeOverlay(node));

							entry.nodes = vnode;
						}),
					);
				}

				entry = {
					key,
					item,
					itemStartMarker,
					itemEndMarker,
					nodes: vnode,
					cleanUp: () => cleanups.forEach((fn) => fn()),
				};
			} else {
				// Si el item ha cambiado (profundamente), actualizar su contenido
				if (!strictDeepEqual(entry.item, item)) {
					const cleanups: (() => void)[] = [];
					entry.cleanUp();
					entry.item = item;

					let vnode: Node | Node[] | JSX.Element;
					if (typeof children === 'function') {
						vnode = children(item, i);
					} else {
						// children no es función, usamos directamente
						vnode = children;
					}

					if (vnode instanceof Node) {
						vnode = vnode.cloneNode(true);
					}

					const range = document.createRange();
					range.setStartAfter(entry.itemStartMarker);
					range.setEndBefore(entry.itemEndMarker);
					range.deleteContents();

					const node = normalizeNode(vnode);

					entry.itemEndMarker.before(node);
					cleanups.push(createChangeOverlay(node));

					entry.itemEndMarker.before(normalizeNode(vnode));
					entry.nodes = vnode;
					entry.cleanUp = () => cleanups.forEach((fn) => fn());
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

	let unsub = () => {};

	// Si `each` es una señal reactiva, se crea un efecto que actualiza automáticamente
	if (isSignal(each)) {
		unsub = effect([each], update);
	} else {
		queue(update); // En caso contrario, solo se ejecuta una vez
	}

	// Retornar los nodos marcador para insertar el contenido generado
	return Fragment({
		'$lifecycle:destroy': () => {
			unsub();
			entries.clear();
		},
		children: [forStartMarker, forEndMarker],
	});
}
