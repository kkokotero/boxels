import { queue } from '@core/scheduler';
import { handleAttributes } from './attributes';
import type { BoxelsElementNode } from './attributes/elements';
import { appendChild, simpleUniqueId } from './utils';

/* -------------------------
   Global Effects System (DX)
------------------------- */

// 🔹 Efectos globales (se acumulan mientras se crea un nodo)
// Ahora son arrays en vez de Set
let globalMountEffects: ((node: HTMLElement) => void)[] = [];
let globalDestroyEffects: ((node: HTMLElement) => void)[] = [];

export function onMount(cb: (node: HTMLElement) => void) {
	globalMountEffects.push(cb);
	// devolvemos función para eliminar solo ese callback
	return () => {
		globalMountEffects = globalMountEffects.filter((fn) => fn !== cb);
	};
}

export function onDestroy(cb: (node: HTMLElement) => void) {
	globalDestroyEffects.push(cb);
	return () => {
		globalDestroyEffects = globalDestroyEffects.filter((fn) => fn !== cb);
	};
}

/* -------------------------
   Lifecycle Core
------------------------- */

export function createLifecycle<T extends keyof HTMLElementTagNameMap>(
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
	const localMountEffects = globalMountEffects.slice();   // copia segura
	const localDestroyEffects = globalDestroyEffects.slice();
	
	globalMountEffects = [];
	globalDestroyEffects = [];
	
	let result = handleAttributes(node, options.props ?? {});
	
	// Flags de control (resetables)
	let mountRan = false;
	let destroyRan = false;

	if (!options.props?.$key) {
		options.props!.$key = simpleUniqueId('element');
	}

	/* ----- Ejecutores seguros ----- */
	const runMountEffects = () => {
		if (mountRan) return;
		mountRan = true;
		destroyRan = false; // reset para permitir destruir luego
		queue(() => {
			localMountEffects.forEach((cb) => cb(node));
		});
	};

	const runDestroyEffects = () => {
		if (destroyRan) return;
		destroyRan = true;
		mountRan = false; // reset para permitir montar luego
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

		appendChild(parent, node);

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
