import { createLifecycle } from './lifecycle';
import type { BoxelsElement } from './types';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function createSvg<T extends keyof ElementTagNameMap>(
	selector: T,
	props: BoxelsElementAttributes<'div'>,
): BoxelsElement {
	// Crear nodo en el namespace correcto y con tipado preciso
	const node = document.createElementNS(
		SVG_NS,
		selector,
	) as SVGElementTagNameMap['svg'];

	return createLifecycle(node as any, {
		isFragment: false,
		props,
		cleanupChildren: (node, result) => {
			// limpiar hijos
			node.remove();
			// ejecutar cleanup de atributos
			result['$lifecycle:destroy']?.(node as any);
		},
		onDestroyResult: (result, node) => {
			// evitar duplicados: solo cleanup extra aquí
			if (typeof result['$lifecycle:destroy'] === 'function') {
				result['$lifecycle:destroy'](node as any);
			}
		},
		onMountResult: (result, node) => {
			// asegurar flags correctos
			(node as any).__destroyed = false;

			if ((node as any).__remounted) {
				props?.['$lifecycle:remount']?.(node as any);
			} else {
				result['$lifecycle:mount']?.(node as any);
			}

			// marcar que ya tuvo al menos un mount
			(node as any).__remounted = true;
		},
	}) as unknown as BoxelsElement;
}
