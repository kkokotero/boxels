import {
	type ReactiveUnsubscribe,
	type ReactiveSignal,
	isSignal,
} from '@core/reactive';

/**
 * Tipo de valores que se pueden usar para definir si se aplica una clase.
 * 
 * Puede ser:
 * - un booleano estático (`true` o `false`)
 * - una señal reactiva que retorna un booleano
 * - un arreglo que puede contener booleanos o señales booleanas
 */
type ClassValue =
	| boolean
	| ReactiveSignal<boolean>
	| Array<boolean | ReactiveSignal<boolean>>;

/**
 * Mapeo de nombres de clase a condiciones.
 * Cada clave es el nombre de una clase y su valor determina si se aplica.
 */
type ClassMap = Record<string, ClassValue>;

type CssModule = { readonly [key: string]: string | CssModule };

/**
 * Tipos válidos para definir clases en un elemento.
 * - string: "a b c"
 * - string[]: ["a", "b"]
 * - ClassMap: { clase: condición }
 * - null / undefined: no se aplica nada
 */
export type ClassAttr = string | string[] | ClassMap | CssModule | null | undefined;

/**
 * Aplica clases estáticas o reactivas a un elemento DOM.
 * 
 * Las formas válidas de usar el valor son:
 * - **String**: `"a b c"` → agrega clases directamente
 * - **Array de strings**: `["a", "b"]` → agrega clases directamente
 * - **Objeto (ClassMap)**: `{ clase: condición }`, donde la condición puede ser:
 *    - un booleano
 *    - una señal booleana
 *    - un arreglo de booleanos o señales → la clase se aplica solo si **todas** son verdaderas
 * 
 * Si alguna condición es reactiva, se vincula al DOM y se actualiza automáticamente.
 * 
 * @param element - Elemento HTML al que se aplicarán las clases
 * @param value - Definición de clases a aplicar
 * @returns Función para limpiar las suscripciones reactivas creadas
 */
export function handleClassAttribute(
	element: HTMLElement,
	value: ClassAttr,
): ReactiveUnsubscribe {
	// Caso 1: Si es un string como "btn active"
	if (typeof value === 'string') {
		const classes = value.trim().split(/\s+/); // Separa por espacios
		if (classes.length) element.classList.add(...classes); // Agrega las clases al elemento
		return () => {}; // No se necesita limpiar nada
	}

	// Caso 2: Si es un arreglo de strings como ["btn", "active"]
	if (Array.isArray(value)) {
		const classes = value.filter(Boolean); // Filtra elementos nulos o falsos
		if (classes.length) element.classList.add(...classes); // Agrega clases
		return () => {}; // No hay reactividad, no se limpia nada
	}

	// Caso 3: Si es un objeto con clases condicionales
	if (value && typeof value === 'object') {
		const cleanups: ReactiveUnsubscribe[] = [];

		// Itera sobre cada par clase-condición
		for (const [className, condition] of Object.entries(value)) {
			// Subcaso 3.1: Condición booleana estática
			if (typeof condition === 'boolean') {
				element.classList.toggle(className, condition); // Aplica o remueve la clase
			}

			// Subcaso 3.2: Condición es una señal booleana
			else if (isSignal(condition)) {
				// Suscribe al cambio de la señal
				const unsubscribe = condition.subscribe((active) => {
					element.classList.toggle(className, active as boolean);
				});
				cleanups.push(unsubscribe); // Guarda la función de limpieza
			}

			// Subcaso 3.3: Condición es un arreglo de booleanos o señales
			else if (Array.isArray(condition)) {
				const signals: ReactiveSignal<boolean>[] = [];
				let staticAllTrue = true; // Se inicia como verdadero

				// Separa señales y evalúa booleanos estáticos
				for (const item of condition) {
					if (isSignal(item)) {
						signals.push(item as ReactiveSignal<any>);
					} else if (!item) {
						staticAllTrue = false; // Si hay un false estático, marca como falso
					}
				}

				// Función para actualizar el estado de la clase
				const updateClass = () => {
					const allTrue = staticAllTrue && signals.every((s) => s()); // Todas deben ser verdaderas
					element.classList.toggle(className, allTrue); // Aplica o quita clase
				};

				// Estado inicial
				updateClass();

				// Suscripción a señales si hay alguna
				if (signals.length > 0) {
					const unsubscribes = signals.map((s) =>
						s.subscribe(updateClass),
					);
					// Agrupa las funciones de limpieza
					cleanups.push(() =>
						unsubscribes.forEach((u) => u()),
					);
				}
			}

			// Subcaso 3.4: Condición inválida o no soportada
			else {
				console.warn(`Condición de clase no soportada para "${className}":`, condition);
			}
		}

		// Devuelve una función que limpia todas las suscripciones
		return () => cleanups.forEach((fn) => fn());
	}

	// Caso 4: null, undefined o tipo no soportado → no hacer nada
	return () => {};
}
