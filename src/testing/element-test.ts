import type { BoxelsElement } from '@dom/index';

/**
 * Verifica si un elemento ha sido montado en el DOM reactivo de Boxels.
 *
 * @param element - Elemento del tipo `BoxelsElement` que se desea verificar.
 * @returns `true` si el elemento ha sido montado, `false` en caso contrario.
 *
 * Un elemento se considera "montado" cuando ha sido insertado de manera efectiva
 * en el DOM reactivo y está participando en el ciclo de vida del sistema.
 *
 * Esta función es útil para evitar operaciones sobre elementos que aún no han sido
 * renderizados o inicializados completamente.
 */
export function isMounted(element: BoxelsElement) {
	return element.__mounted;
}

/**
 * Verifica si un elemento ha sido destruido dentro del sistema reactivo de Boxels.
 *
 * @param element - Elemento del tipo `BoxelsElement` que se desea verificar.
 * @returns `true` si el elemento ha sido destruido, `false` en caso contrario.
 *
 * Un elemento se considera "destruido" cuando ha sido eliminado del DOM reactivo
 * y ya no forma parte del ciclo de vida del sistema. Esto puede incluir la
 * eliminación de listeners, referencias internas o datos asociados.
 *
 * Esta función permite prevenir interacciones con elementos que ya han sido
 * desasociados del sistema, evitando errores o efectos secundarios inesperados.
 */
export function isDestroyed(element: BoxelsElement) {
	return element.__destroyed;
}
