import { Fragment } from './fragment';

/**
 * Propiedades para el componente `Repeat`.
 */
type RepeatProps = {
	/** 
	 * Cantidad de veces que se repetirá el contenido.
	 */
	count: number;

	/** 
	 * Contenido que se repetirá:
	 * - Puede ser un elemento JSX fijo.
	 * - O una función que recibe el índice actual y devuelve un JSX diferente para cada repetición.
	 */
	children: JSX.Element | ((index: number) => JSX.Element);
};

/**
 * Componente `Repeat`
 * 
 * Funciona como un bucle para renderizar el mismo contenido varias veces.
 * Puede recibir:
 * - Un elemento JSX estático (se repite idéntico `count` veces).
 * - Una función que genere dinámicamente un JSX distinto según el índice.
 * 
 * Ejemplos de uso:
 * 
 * ```tsx
 * // Repite un mismo elemento
 * <Repeat count={3}>
 *   <div>Hola</div>
 * </Repeat>
 * 
 * // Genera elementos diferentes según el índice
 * <Repeat count={5}>
 *   {(i) => <div>Elemento {i}</div>}
 * </Repeat>
 * ```
 */
export function Repeat({ count, children }: RepeatProps) {
	// Lista donde se almacenarán los elementos generados
	const elements: JSX.Element[] = [];

	// Bucle que repite el contenido 'count' veces
	for (let i = 0; i < count; i += 1) {
		// Si children es una función, se llama con el índice actual
		// Si es un elemento JSX, se usa tal cual
		elements.push(typeof children === 'function' ? children(i) : children);
	}

	// Devuelve un Fragment que agrupa todos los elementos generados
	return Fragment({ children: elements });
}
