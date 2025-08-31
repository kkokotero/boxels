// Importa herramientas de reactividad
import { isSignal, type ReactiveUnsubscribe } from '@core/reactive';

// Importa manejadores y tipos de atributos especiales
import {
	type LifecycleEventHandlers,
	handlers,
	globalHandlers,
	type ClassAttr,
	type StyleAttr,
} from './handlers';

// Manejadores para class y style
import { handleClassAttribute, handleStyleAttribute } from './styles/index';

// Utilidad para hijos de elementos
import { normalizeChildren, type BoxelsElement } from './elements/index';
import { appendChild } from '../utils';

/**
 * Aplica atributos a un elemento HTML o SVG.
 *
 * - Soporta señales reactivas (se desuscriben en destroy).
 * - Aplica handlers específicos de tag o globales.
 * - Controla atributos especiales (`class`, `style`, `$on:`, `$lifecycle`, etc).
 *
 * @template T Etiqueta de HTMLElementTagNameMap
 * @param element Elemento al que se aplicarán atributos
 * @param props Objeto con los atributos
 * @returns Manejadores de ciclo de vida (mount/destroy)
 */
export function handleAttributes<T extends keyof HTMLElementTagNameMap>(
	element: HTMLElementTagNameMap[T] | HTMLElement | SVGElement,
	props: BoxelsElementAttributes<T>,
): LifecycleEventHandlers<T> {
	const cleanUps: ReactiveUnsubscribe[] = [];
	const mounts: (() => void)[] = [];

	const tag = (element.tagName ?? 'fragment').toLowerCase();
	const tagHandlers = handlers[tag] ?? {};

	for (const [key, raw] of Object.entries(props)) {
		// --- hijos ---
		if (key === 'children') {
			const result = normalizeChildren(raw);
			for (const node of result.nodes) appendChild(element, node);
			result.onMount();
			cleanUps.push(() => result.cleanup());
			continue;
		}

		// --- señales reactivas ---
		if (isSignal(raw)) {
			const unsub = raw.subscribe((val) => {
				applyAttr(element, key, val);
			});
			cleanUps.push(unsub);
			continue;
		}

		// --- class ---
		if (key === 'class') {
			cleanUps.push(handleClassAttribute(element, raw as ClassAttr));
			continue;
		}

		// --- style ---
		if (key === 'style') {
			cleanUps.push(handleStyleAttribute(element, raw as StyleAttr));
			continue;
		}

		// --- lifecycle ---
		if (key === '$lifecycle:mount' && typeof raw === 'function') {
			if (!(element as BoxelsElement).__destroyed) raw(element);
			continue;
		}

		if (key === '$lifecycle:remount' && typeof raw === 'function') {
			continue;
		}
		if (key === '$lifecycle:destroy' && typeof raw === 'function') {
			cleanUps.push(() => raw(element));
			continue;
		}

		// --- eventos ---
		if (key.startsWith('$on:') && typeof raw === 'function') {
			const ev = key.slice(4);
			element.addEventListener(ev, raw as EventListener);
			cleanUps.push(() => element.removeEventListener(ev, raw));
			continue;
		}

		// --- handlers globales ---
		if (key in globalHandlers) {
			cleanUps.push(globalHandlers[key](element, raw));
			continue;
		}

		// --- handlers por tag ---
		if (key in tagHandlers) {
			cleanUps.push(tagHandlers[key](element, raw));
			continue;
		}

		// --- atributo desconocido con prefijo especial ---
		if (key.startsWith('$')) {
			throw new Error(
				`[Attributes] Atributo "${key}" no reconocido en <${tag}>.`,
			);
		}

		// --- atributo normal ---
		applyAttr(element, key, raw);
	}

	return {
		'$lifecycle:destroy': () => cleanUps.forEach((fn) => fn()),
		'$lifecycle:mount': () => mounts.forEach((fn) => fn()),
	};
}

/**
 * Elimina un atributo específico de un elemento.
 * Se encarga de casos especiales (`class`, `style`, eventos, handlers, booleanos, etc).
 *
 * @template T Etiqueta de HTMLElementTagNameMap
 * @param element Elemento objetivo
 * @param key Nombre del atributo a eliminar
 * @param value Valor anterior (opcional, usado en casos como class/style)
 */
export function removeAttributeHandler<T extends keyof HTMLElementTagNameMap>(
	element: HTMLElementTagNameMap[T] | HTMLElement | SVGElement,
	key: string,
	value?: unknown,
) {
	const tag = (element.tagName ?? 'fragment').toLowerCase();
	const tagHandlers = handlers[tag] ?? {};

	// --- hijos ---
	if (key === 'children') {
		element.innerHTML = ''; // elimina todos los hijos
		return;
	}

	// --- class ---
	if (key === 'class') {
		if (typeof value === 'string') {
			element.classList.remove(value);
		} else if (Array.isArray(value)) {
			value.forEach((v) => element.classList.remove(v));
		} else if (typeof value === 'object' && value) {
			Object.entries(value).forEach(([cls, active]) => {
				if (active) element.classList.remove(cls);
			});
		} else {
			element.removeAttribute('class');
		}
		return;
	}

	// --- style ---
	if (key === 'style') {
		if (typeof value === 'string') {
			(element as HTMLElement).style.removeProperty(value);
		} else if (typeof value === 'object' && value) {
			Object.keys(value).forEach((prop) =>
				(element as HTMLElement).style.removeProperty(prop),
			);
		} else {
			element.removeAttribute('style');
		}
		return;
	}

	// --- eventos ---
	if (key.startsWith('$on:') && typeof value === 'function') {
		const ev = key.slice(4);
		element.removeEventListener(ev, value as EventListener);
		return;
	}

	// --- globalHandlers ---
	if (key in globalHandlers) {
		if (typeof globalHandlers[key].remove === 'function') {
			globalHandlers[key].remove(element, value);
		} else {
			element.removeAttribute(key);
		}
		return;
	}

	// --- tagHandlers ---
	if (key in tagHandlers) {
		if (typeof tagHandlers[key].remove === 'function') {
			tagHandlers[key].remove(element, value);
		} else {
			element.removeAttribute(key);
		}
		return;
	}

	// --- lifecycle: ignoramos ---
	if (key.startsWith('$lifecycle')) return;

	// --- atributo normal ---
	element.removeAttribute(key);

	// --- booleanos → reset a false ---
	if (key in element && typeof (element as any)[key] === 'boolean') {
		(element as any)[key] = false;
	}
}

/**
 * Elimina múltiples atributos de un elemento HTML o SVG.
 * Es el opuesto de `handleAttributes`.
 *
 * Internamente reutiliza `removeAttributeHandler` para evitar duplicar lógica.
 *
 * @template T Etiqueta de HTMLElementTagNameMap
 * @param element Elemento objetivo
 * @param props Objeto con los atributos a eliminar
 */
export function removeAttributes<T extends keyof HTMLElementTagNameMap>(
	element: HTMLElementTagNameMap[T] | HTMLElement | SVGElement,
	props: Partial<BoxelsElementAttributes<T>>,
) {
	for (const [key, raw] of Object.entries(props)) {
		removeAttributeHandler(element, key, raw);
	}
}

/**
 * Aplica un atributo o lo elimina si es inválido.
 *
 * Casos:
 * - `null`, `undefined`, `false`, `''` o funciones → se eliminan.
 * - Objetos no array → advertencia en consola.
 * - Atributos válidos → se aplican con `setAttribute`.
 *
 * @template T Etiqueta de HTMLElementTagNameMap
 * @param el Elemento objetivo
 * @param key Nombre del atributo
 * @param value Valor del atributo
 */
function applyAttr<T extends keyof HTMLElementTagNameMap>(
	el: HTMLElementTagNameMap[T] | HTMLElement | SVGElement,
	key: string,
	value: unknown,
) {
	if (
		value == null ||
		value === false ||
		typeof value === 'undefined' ||
		value === '' ||
		typeof value === 'function'
	) {
		removeAttributeHandler(el, key, value);
		return;
	}

	if (typeof value === 'object' && !Array.isArray(value)) {
		console.warn(`[Attributes] "${key}" recibió un objeto no válido:`, value);
	}

	el.setAttribute(key, String(value));
}
