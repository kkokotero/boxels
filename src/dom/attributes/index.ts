// Importa herramientas de reactividad (signals) y tipo para funciones de limpieza
import { isSignal, type ReactiveUnsubscribe } from '@core/reactive';

// Importa tipos y manejadores para atributos especiales (como clase, estilo y ciclo de vida)
import {
	type LifecycleEventHandlers,
	handlers,
	globalHandlers,
	type ClassAttr,
	type StyleAttr,
} from './handlers';

// Funciones auxiliares para manejar atributos especiales como "class" y "style"
import { handleClassAttribute, handleStyleAttribute } from './styles/index';

// Utilidad para normalizar y montar los hijos de un elemento
import { normalizeChildren } from './elements/index';
import { append } from '../index';

/**
 * Maneja la aplicación de atributos a un elemento HTML, incluyendo atributos
 * estándar, clases, estilos, eventos personalizados y suscripciones reactivas.
 *
 * @param element - El elemento HTML al cual se aplicarán los atributos
 * @param props - Objeto con los atributos (estáticos o reactivos) a aplicar
 * @returns Un objeto con funciones de montaje y limpieza asociadas al ciclo de vida del elemento
 */
export function handleAttributes<T extends keyof HTMLElementTagNameMap>(
	element: HTMLElementTagNameMap[T] | HTMLElement,
	props: BoxelsElementAttributes<T>,
): LifecycleEventHandlers<T> {
	const cleanUps: ReactiveUnsubscribe[] = []; // Arreglo de funciones de limpieza a ejecutar en destrucción
	const mounts: (() => void)[] = []; // Arreglo de funciones a ejecutar cuando el elemento se monte

	const tag = (element.tagName ?? 'fragment').toLowerCase(); // Nombre del tag en minúscula
	const tagHandlers = handlers[tag] ?? {}; // Manejadores específicos para el tag, si existen

	// Recorre cada propiedad del objeto de atributos
	for (const [key, raw] of Object.entries(props)) {
		// Manejo de hijos del elemento
		if (key === 'children') {
			const result = normalizeChildren(raw); // Normaliza el contenido
			for (const node of result.nodes) append(element, node); // Agrega cada hijo al DOM
			mounts.push(result.onMount); // Agrega función de montaje
			cleanUps.push(result.cleanup); // Agrega función de limpieza
			continue;
		}

		// Si el valor es un signal reactivo, se suscribe a cambios
		if (isSignal(raw)) {
			const unsub = raw.subscribe((val) => {
				applyAttr(element, key, val); // Actualiza el atributo cuando el valor cambia
			});
			cleanUps.push(unsub); // Almacena la función de desuscripción
			continue;
		}

		// Atributo especial "class"
		if (key === 'class') {
			cleanUps.push(handleClassAttribute(element, raw as ClassAttr));
			continue;
		}

		// Atributo especial "style"
		if (key === 'style') {
			cleanUps.push(handleStyleAttribute(element, raw as StyleAttr));
			continue;
		}

		// Ciclo de vida: función a ejecutar cuando el elemento se monte
		if (key === '$lifecycle:mount' && typeof raw === 'function') {
			mounts.push(() => raw(element));
			continue;
		}

		// Ciclo de vida: función a ejecutar cuando el elemento se destruya
		if (key === '$lifecycle:destroy' && typeof raw === 'function') {
			cleanUps.push(() => raw(element));
			continue;
		}

		// Eventos personalizados usando el prefijo $on: (ej: $on:click)
		if (key.startsWith('$on:') && typeof raw === 'function') {
			const ev = key.slice(4); // Extrae el nombre del evento (sin el prefijo)
			element.addEventListener(ev, raw as EventListener); // Agrega el listener
			cleanUps.push(() => element.removeEventListener(ev, raw)); // Remueve al destruir
			continue;
		}

		// Atributos manejados globalmente (por ejemplo, data-*, ref, etc.)
		if (key in globalHandlers) {
			cleanUps.push(globalHandlers[key](element, raw));
			continue;
		}

		// Atributos específicos del tag (por ejemplo, solo válidos en <input>, <img>, etc.)
		if (key in tagHandlers) {
			cleanUps.push(tagHandlers[key](element, raw));
			continue;
		}

		// Si comienza con "$" pero no es reconocido, se lanza un error
		if (key.startsWith('$')) {
			throw new Error(
				`[Attributes] Atributo "${key}" no reconocido en el elemento <${tag}>. Asegúrate de que sea un atributo válido o un evento personalizado.`,
			);
		}

		// Atributos HTML estándar (ej: href, src, value, title, etc.)
		applyAttr(element, key, raw);
	}

	// Retorna funciones de ciclo de vida
	return {
		'$lifecycle:destroy': () => cleanUps.forEach((fn) => fn()), // Ejecuta todas las limpiezas
		'$lifecycle:mount': () => mounts.forEach((fn) => fn()), // Ejecuta todas las funciones de montaje
	};
}

/**
 * Aplica un atributo o propiedad al elemento DOM.
 * Puede remover el atributo si el valor es nulo, vacío o una función (no válida).
 *
 * @param el - Elemento al que se le aplica el atributo
 * @param key - Nombre del atributo
 * @param value - Valor del atributo, puede ser de cualquier tipo
 */
function applyAttr<T extends keyof HTMLElementTagNameMap>(
	el: HTMLElementTagNameMap[T] | HTMLElement,
	key: string,
	value: unknown,
) {
	// Si el valor es nulo, falso, indefinido, cadena vacía o función, se elimina el atributo
	if (
		value == null ||
		value === false ||
		typeof value === 'undefined' ||
		value === '' ||
		typeof value === 'function'
	) {
		el.removeAttribute(key);

		// También se asegura de que la propiedad booleana del DOM esté en falso si aplica
		if (key in el && typeof (el as any)[key] === 'boolean') {
			(el as any)[key] = false;
		}
		return;
	}

	// Advertencia si se pasa un objeto que no es array como valor (no válido como atributo HTML)
	if (typeof value === 'object' && !Array.isArray(value)) {
		console.warn(
			`[Attributes] Atributo "${key}" recibió un objeto no válido:`,
			value,
		);
	}

	// Finalmente, aplica el atributo al elemento como cadena de texto
	el.setAttribute(key, String(value));
}
