import { isSignal, type ReactiveSignal } from "@core/reactive";

/**
 * Extrae todas las señales reactivas (`ReactiveSignal`) presentes directa o indirectamente en un arreglo.
 * 
 * Esta función permite detectar y recolectar cualquier señal reactiva (`ReactiveSignal`) que se encuentre:
 *  - Directamente en el arreglo (`values`)
 *  - Indirectamente si es el resultado del llamado a una función contenida en el arreglo
 * 
 * Casos de uso:
 *  - Evaluar propiedades dinámicas que podrían ser señales o funciones que devuelven señales
 *  - Preparar una lista de dependencias reactivas para efectos o computaciones derivadas
 * 
 * @param values Arreglo de elementos desconocidos. Pueden ser valores estáticos, señales o funciones que retornan señales.
 * @returns Un arreglo plano con todas las señales encontradas.
 */
export function extractSignalsFromValues(values: unknown[]): ReactiveSignal<unknown>[] {
	// Arreglo acumulador donde se almacenan las señales detectadas
	const collected: ReactiveSignal<unknown>[] = [];

	/**
	 * Intenta extraer una señal del valor dado.
	 * - Si es una señal, se añade directamente.
	 * - Si es una función, se invoca y se analiza el resultado.
	 * - Si lanza error o no retorna una señal, se ignora silenciosamente.
	 * 
	 * @param item Valor a analizar: puede ser una señal, una función o cualquier otro valor.
	 */
	const collect = (item: unknown) => {
		if (isSignal(item)) {
			// Si el ítem es una señal reactiva, se agrega
			collected.push(item);
		} else if (typeof item === 'function') {
			try {
				// Intenta ejecutar la función
				const result = item();

				// Si el resultado es una señal, se agrega
				if (isSignal(result)) {
					collected.push(result);
				}
			} catch {
				// Se ignoran funciones que generan errores o que no retornan señales
			}
		}
	};

	// Recorre todos los valores del arreglo recibido
	for (const val of values) {
		collect(val); // Intenta recolectar señales de cada valor
	}

	// Retorna todas las señales encontradas
	return collected;
}
