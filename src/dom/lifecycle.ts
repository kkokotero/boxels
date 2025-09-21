import { queue } from '@core/scheduler';
import { handleAttributes } from './attributes';
import type { BoxelsElementNode } from './attributes/elements';
import { simpleUniqueId } from './utils/unique-id';
import { lifecycleStore } from './lifecycle-store';

/* -------------------------
   Lifecycle Core
   ------------------------- */

export function createLifecycle<T extends keyof ElementTagNameMap>(
	node: BoxelsElementNode<T>,
	options: {
		isFragment: boolean;
		props?: BoxelsElementAttributes<T>;
		appendChildren?: (node: BoxelsElementNode<T>, result: any) => void;
		cleanupChildren?: (node: BoxelsElementNode<T>, result: any) => void;
		onMountResult?: (result: any, node: BoxelsElementNode<T>) => void;
		onDestroyResult?: (result: any, node: BoxelsElementNode<T>) => void;
	},
) {
	// Capturamos y "consumimos" los efectos globales solo para este nodo
	const localMountEffects = lifecycleStore.globalMountEffects.slice();
	const localDestroyEffects = lifecycleStore.globalDestroyEffects.slice();

	// Limpiar arrays globales
	lifecycleStore.globalMountEffects.length = 0;
	lifecycleStore.globalDestroyEffects.length = 0;

	let result = handleAttributes(node, options.props ?? {});

	// Flags de control
	let mountRan = false;
	let destroyRan = false;

	if (!options.props?.$key) {
		options.props!.$key = simpleUniqueId('element');
	}

	/* ----- Ejecutores seguros ----- */
	const runMountEffects = () => {
		if (mountRan) return;
		mountRan = true;
		destroyRan = false;
		queue(() => {
			localMountEffects.forEach((cb) => cb(node));
		});
	};

	const runDestroyEffects = () => {
		if (destroyRan) return;
		destroyRan = true;
		mountRan = false;
		queue(() => {
			localDestroyEffects.forEach((cb) => cb(node));
		});
	};

	/* ----- Destroy ----- */
	const destroy = () => {
		if ((node as any).__destroyed) return;
		(node as any).__mounted = false;
		(node as any).__destroyed = true;

		options.props?.['$lifecycle:destroy']?.(node);
		options.cleanupChildren?.(node, result);
		options.onDestroyResult?.(result, node);

		runDestroyEffects();
	};

	/* ----- Mount normal ----- */
	const mount = (parent: HTMLElement | DocumentFragment) => {
		if ((node as any).__mounted) return;
		(node as any).__mounted = true;
		(node as any).__destroyed = false;

		options.cleanupChildren?.(node, result);
		result = handleAttributes(node, options.props ?? {});
		options.appendChildren?.(node, result);

		parent.appendChild(node);

		options.props?.['$lifecycle:mount']?.(node);
		options.onMountResult?.(result, node);

		runMountEffects();
	};

	/* ----- Mount como efecto (retorna destroy) ----- */
	const mountEffect = () => {
		if ((node as any).__mounted) return;
		(node as any).__mounted = true;
		(node as any).__destroyed = false;

		result = handleAttributes(node, options.props ?? {}, false);
		options.appendChildren?.(node, result);

		options.props?.['$lifecycle:mount']?.(node);
		options.onMountResult?.(result, node);

		runMountEffects();

		return () => destroy();
	};

	/* ----- Resultado final ----- */
	return Object.assign(node, {
		mount,
		destroy,
		mountEffect,
		isFragment: options.isFragment,
		key: options.props?.$key,
		__boxels: true,
		__mounted: false,
		__destroyed: false,
	});
}
