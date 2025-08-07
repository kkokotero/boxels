import { appendChild, isBoxelsElement } from 'src/dom/index';

/**
 * Monta (agrega) uno o varios elementos JSX a un contenedor en el DOM.
 *
 * @param parent - Un nodo del DOM donde se insertarán los hijos. Puede ser un HTMLElement
 *                 (como un <div>, <section>, etc.) o un DocumentFragment.
 * @param children - Uno o más elementos JSX que se desean insertar dentro del contenedor.
 *
 * Este método se utiliza para montar componentes o nodos dentro del DOM de forma explícita.
 * Si alguno de los hijos es una Promesa (por ejemplo, un componente que se carga de forma
 * asíncrona), se espera a su resolución antes de insertarlo.
 *
 * Internamente, se delega la inserción en la función `appendChild`, que se encarga de
 * manejar tanto nodos DOM tradicionales como componentes personalizados del sistema.
 *
 * Ejemplo de uso:
 *   const contenedor = document.getElementById('app');
 *   const componente = <MiComponente />;
 *   mount(contenedor, componente);
 */
export const mount = (
	parent: HTMLElement | DocumentFragment,
	...children: JSX.Element[]
) => {
	children.forEach(async (child) => {
		// Si el hijo es una Promesa, se espera su resolución antes de insertarlo
		const resolved = child instanceof Promise ? await child : child;
		// Inserta el elemento (resuelto o no) en el contenedor
		appendChild(parent, resolved);
	});
};

/**
 * Desmonta (elimina) uno o varios elementos JSX del DOM.
 *
 * @param children - Uno o más elementos JSX que se desean eliminar del DOM.
 *
 * Esta función sirve para eliminar componentes o nodos del árbol DOM de forma segura,
 * considerando si el elemento es un componente personalizado con lógica de limpieza
 * (como suscripciones, efectos, etc.), o un nodo DOM estándar.
 *
 * - Si el elemento es un "BoxelsElement" (componente personalizado):
 *   - Se verifica si está montado (`__mounted` es verdadero).
 *   - Si lo está, se llama a su método `destroy()` para ejecutar limpieza interna.
 *
 * - Si el elemento es un nodo DOM común (no personalizado), simplemente se elimina
 *   mediante `remove()`.
 *
 * La verificación con `isBoxelsElement` permite distinguir entre componentes del sistema
 * (que pueden tener ciclo de vida) y nodos normales del DOM.
 */
export const unmount = (...children: JSX.Element[]) => {
	children.forEach((child) => {
		// Si el elemento es un componente del sistema (con lógica de desmontaje)
		if (isBoxelsElement(child)) {
			// Verifica que esté montado antes de destruirlo para evitar errores o dobles llamadas
			if (child.__mounted) {
				child.destroy(); // Ejecuta limpieza interna (efectos, listeners, etc.)
			}
		} else {
			// Nodo DOM nativo: se elimina directamente del DOM
			(child as ChildNode).remove();
		}
	});
};

/**
 * Interfaz base para un componente del sistema.
 *
 * Cualquier componente que implemente esta interfaz debe definir un método `render()`,
 * que retorna un nodo JSX. Este nodo será lo que se monta en el DOM.
 *
 * @example
 *   class MiComponente implements Component {
 *     render() {
 *       return <div>Hola mundo</div>;
 *     }
 *   }
 */
export interface Component {
	render: () => JSX.Element;
}
