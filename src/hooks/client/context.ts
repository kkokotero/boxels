import {
	type Signal,
	type Widen,
	persistentSignal,
	signal,
} from '@core/reactive';
import { autoCleanup } from '@core/cleanup';

type Context<T> = {
	provide(value: T): void;
	use(): Signal<Widen<T> | T>;
	destroy(): void;
};

/**
 * Opciones para personalizar un contexto.
 */
interface ContextOptions {
	/**
	 * Si `true`, el contexto se guarda en caché usando `persistentSignal`.
	 * El estado persiste entre ciclos de vida siempre que se use la misma `key`.
	 */
	cache?: boolean;

	/**
	 * Identificador único y estable para este contexto.
	 * Si no se provee, se generará uno automáticamente.
	 *
	 * ⚠️ Importante: si usas `cache: true`, deberías pasar siempre un `key`
	 * estable para evitar que se creen contextos duplicados.
	 */
	key?: string;
}

let autoId = 0;

/**
 * Crea un nuevo contexto reactivo.
 *
 * @param defaultValue - Valor inicial del contexto
 * @param options - Opciones de configuración del contexto
 * @returns Un objeto `Context<T>` con métodos para proveer, usar y destruir el contexto
 */
export function createContext<T>(
	defaultValue: T,
	options: ContextOptions = {},
): Context<T> {
	const { cache = false, key } = options;

	// Key estable: si el usuario no pasa una, generamos una incremental
	const contextKey = key ?? `boxels-context-${autoId++}`;

	const state = cache
		? persistentSignal(contextKey, defaultValue as Widen<T>)
		: signal(defaultValue);

	const ctx: Context<T> = {
		provide(value: T) {
			(state.set as (v: T) => void)(value);
		},
		use() {
			return state;
		},
		destroy() {
			state.destroy();
		},
	};

	autoCleanup(ctx).onCleanup(() => ctx.destroy());

	return ctx;
}
