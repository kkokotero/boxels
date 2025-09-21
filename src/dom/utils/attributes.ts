import { handleAttributes, removeAttributes } from "@dom/attributes";
import type { BoxelsElementNode } from "@dom/attributes/elements";

/**
 * Asigna atributos a un elemento HTML usando el sistema de Boxels.
 *
 * @param element - Elemento DOM objetivo.
 * @param props - Atributos a aplicar (incluye atributos de ciclo de vida).
 *
 * Retorna una función de limpieza que ejecuta `$lifecycle:destroy` si existe.
 */
export const setAttribute = <T extends keyof ElementTagNameMap>(
    element: ElementTagNameMap[T] | HTMLElement,
    props: BoxelsElementAttributes<T>,
) => {
    const result = handleAttributes(element, props);
    // Ejecutar hook de montaje si existe
    result['$lifecycle:mount']?.(element as BoxelsElementNode<T>);
    // Retornar función para desmontaje
    return () => result['$lifecycle:destroy']?.(element as BoxelsElementNode<T>);
};

/**
 * Elimina atributos previamente aplicados en un elemento.
 *
 * @param element - Elemento HTML objetivo.
 * @param props - Atributos a eliminar.
 */
export const removeAttribute = <T extends keyof ElementTagNameMap>(
    element: ElementTagNameMap[T] | HTMLElement,
    props: BoxelsElementAttributes<T>,
) => removeAttributes(element, props);