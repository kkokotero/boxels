import { appendChild } from './utils';

export function createLifecycle<T extends Node>(
	node: T,
	build: () => any,
	options: {
		isFragment: boolean;
		props?: any;
		appendChildren?: (node: T, result: any) => void;
		cleanupChildren?: (node: T, result: any) => void;
		onMountResult?: (result: any, node: T) => void;
		onDestroyResult?: (result: any, node: T) => void;
	},
) {
	let result = build();
	let everMounted = false;

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
	};

	const mount = (parent: HTMLElement | DocumentFragment) => {
		// Si ya estaba montado → rerender
		if ((node as any).__mounted) {
			options.cleanupChildren?.(node, result);
			result = build();
			options.appendChildren?.(node, result);

			// 🚀 activar hooks de hijos en fragments
			if (options.isFragment) {
				options.appendChildren?.(node, result);
				result.onMount?.();
			}

			options.props?.['$lifecycle:remount']?.(node);
			return;
		}

		// Primer montaje
		result = build();
		options.appendChildren?.(node, result);

		(node as any).__mounted = true;
		(node as any).__destroyed = false;
		everMounted = true;

		options.props?.['$lifecycle:mount']?.(node);
		appendChild(parent, node);
		options.onMountResult?.(result, node);
	};

	const mountEffect = () => {
		if ((node as any).__mounted) return;
		(node as any).__mounted = true;
		(node as any).__destroyed = false;

		if (everMounted) {
			options.props?.['$lifecycle:remount']?.(node);
		} else {
			options.props?.['$lifecycle:mount']?.(node);
		}

		if (options.isFragment) {
			result = build();
			options.appendChildren?.(node, result);
		}

		options.onMountResult?.(result, node);

		return () => destroy();
	};

	return Object.assign(node, {
		mount,
		destroy,
		mountEffect,
		isFragment: options.isFragment,
		__boxels: true,
		__mounted: false,
		__destroyed: false,
	});
}
