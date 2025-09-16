import { queue } from '@core/scheduler';
import { handleAttributes } from './attributes';
import type { BoxelsElementNode } from './attributes/elements';
import { appendChild } from './utils';

/* -------------------------
   Global Effects System
------------------------- */

// 🔹 Efectos globales de mount
const globalMountEffects = new Set<(node: Node) => void>();

export function onMount(cb: (node: Node) => void) {
	globalMountEffects.add(cb);
	return () => globalMountEffects.delete(cb);
}

// 🔹 Efectos globales de destroy
const globalDestroyEffects = new Set<(node: Node) => void>();

export function onDestroy(cb: (node: Node) => void) {
	globalDestroyEffects.add(cb);
	return () => globalDestroyEffects.delete(cb);
}

/* -------------------------
   Lifecycle Core
------------------------- */

export function createLifecycle<T extends keyof HTMLElementTagNameMap>(
	node: BoxelsElementNode<T>,
	options: {
		isFragment: boolean;
		props?: any;
		appendChildren?: (node: BoxelsElementNode<T>, result: any) => void;
		cleanupChildren?: (node: BoxelsElementNode<T>, result: any) => void;
		onMountResult?: (result: any, node: BoxelsElementNode<T>) => void;
		onDestroyResult?: (result: any, node: BoxelsElementNode<T>) => void;
	},
) {
	let result = handleAttributes(node, options.props ?? {});

	// 📌 Snapshot inmediato de efectos globales
	const localMountEffects = Array.from(globalMountEffects);
	const localDestroyEffects = Array.from(globalDestroyEffects);

	// 🔥 Limpiar listas globales tras el snapshot
	globalMountEffects.clear();
	globalDestroyEffects.clear();

	if (options.isFragment) {
		options.appendChildren?.(node, result);
	}

	const destroy = () => {
		if ((node as any).__destroyed) return;
		(node as any).__mounted = false;
		(node as any).__destroyed = true;

		options.props?.['$lifecycle:destroy']?.(node);
		options.cleanupChildren?.(node, result);
		options.onDestroyResult?.(result, node);

		// Ejecutar efectos locales de destroy
		queue(() => {
			localDestroyEffects.forEach((cb) => cb(node));
		});
	};

	const mount = (parent: HTMLElement | DocumentFragment) => {
		if ((node as any).__mounted) return;
		(node as any).__mounted = true;
		(node as any).__destroyed = false;

		options.cleanupChildren?.(node, result);
		result = handleAttributes(node, options.props ?? {});
		options.appendChildren?.(node, result);

		if (options.isFragment) {
			result['$lifecycle:mount']?.(node);
		}

		node.key = result.key;

		appendChild(parent, node);

		options.props?.['$lifecycle:mount']?.(node);
		options.onMountResult?.(result, node);

		// Ejecutar efectos locales de mount
		queue(() => {
			localMountEffects.forEach((cb) => cb(node));
		});
	};

	const mountEffect = () => {
		if ((node as any).__mounted) return;
		(node as any).__mounted = true;
		(node as any).__destroyed = false;

		result = handleAttributes(node, options.props ?? {}, false);
		options.appendChildren?.(node, result);

		node.key = result.key;

		options.props?.['$lifecycle:mount']?.(node);
		options.onMountResult?.(result, node);

		// Ejecutar efectos locales de mount
		queue(() => {
			localMountEffects.forEach((cb) => cb(node));
		});

		return () => destroy();
	};

	return Object.assign(node, {
		mount,
		destroy,
		mountEffect,
		isFragment: options.isFragment,
		key: result.key,
		__boxels: true,
		__mounted: false,
		__destroyed: false,
	});
}
