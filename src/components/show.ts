// Importa utilidades para extraer señales de un conjunto de valores
import { extractSignalsFromValues } from './utils';

// Importa funciones y tipos del sistema reactivo
import { effect, isSignal, signal, type ReactiveSignal } from '@core/reactive';

/**
 * Tipos de valores que pueden usarse como condición:
 * - Un valor cualquiera (booleano, string, número, etc.)
 * - Una función que retorne un valor
 * - Una señal reactiva (ReactiveSignal)
 */
type ConditionValue = unknown | (() => unknown) | ReactiveSignal<unknown>;

// Una condición puede ser un solo valor o un arreglo de valores
type ShowCondition = ConditionValue | ConditionValue[];

/**
 * Propiedades aceptadas por el componente `Show`
 * - `when`: condición (o condiciones) que deben evaluarse como verdaderas para mostrar `children`
 * - `children`: contenido que se mostrará si la condición se cumple
 * - `fallback`: contenido alternativo si la condición NO se cumple
 */
type ShowProps = {
	when: ShowCondition;
	children: JSX.Element | ReactiveSignal<JSX.Element> | string;
	fallback?: JSX.Element | ReactiveSignal<JSX.Element> | string;
};

/**
 * Determina si una condición dada es verdadera.
 * - Si es un arreglo, todas las condiciones deben cumplirse.
 * - Si es una función, se ejecuta para obtener el valor.
 * - Si es una señal, se lee su valor actual.
 * - Se usa coerción booleana (`Boolean(...)`) para validar la "verdad" del resultado.
 */
function isConditionTrue(condition: ShowCondition): boolean {
	const isTruthy = (value: ConditionValue): boolean => {
		try {
			// Si es una señal, se evalúa y se convierte a booleano
			if (isSignal(value)) return Boolean(value());
			// Si es una función, se llama y se convierte a booleano
			if (typeof value === 'function') return Boolean(value());
			// Si es un valor directo, se convierte a booleano
			return Boolean(value);
		} catch {
			// Si ocurre algún error (por ejemplo, al ejecutar una función), se considera como falso
			return false;
		}
	};

	// Si la condición es nula o indefinida, se considera falsa
	if (condition == null) return false;

	// Si es un arreglo, todas las condiciones deben ser verdaderas (operador AND)
	return Array.isArray(condition)
		? condition.every(isTruthy)
		: isTruthy(condition); // Si no, evalúa una sola condición
}

/**
 * Componente reactivo `Show`
 * Este componente controla la renderización condicional de contenido basado en señales u otras condiciones reactivas.
 * 
 * Ejemplo de uso:
 * 
 * ```tsx
 * <Show when={estado}>
 *    <Mensaje />
 * </Show>
 * ```
 * 
 * También puede usar fallback:
 * 
 * ```tsx
 * <Show when={estado} fallback={<Cargando />}>
 *    <Contenido />
 * </Show>
 * ```
 */
export function Show({ when, children, fallback }: ShowProps) {
	// Contenedor reactivo para almacenar el contenido actual a mostrar (children o fallback)
	const content = signal(fallback);

	// Extrae todas las señales contenidas en la condición para poder observarlas
	const dependencies = extractSignalsFromValues(
		Array.isArray(when) ? when : [when],
	);

	// Se crea un efecto reactivo que actualiza el contenido cada vez que cambien las dependencias
	effect(dependencies, () => {
		content.set(isConditionTrue(when) ? children : fallback);
	});

	// Se establece el valor inicial antes de cualquier reactividad
	content.set(isConditionTrue(when) ? children : fallback);

	// Devuelve una señal reactiva que puede ser usada como JSX.Element en otros lugares
	return content;
}
