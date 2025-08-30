// context.ts
import { type Signal, type Widen, persistentSignal, signal } from '@core/reactive';

type Context<T> = {
	provide(value: T): void;
	use(): Signal<Widen<T> | T>;
	destroy(): void;
};

let keys = 0;

export function createContext<T>(defaultValue: T, cache = false): Context<T> {
	// Estado compartido (signal raíz)
	const state = cache ? persistentSignal(`boxels-context-${keys++}`, defaultValue as Widen<T>) : signal(defaultValue);

	return {
		// Proveer un nuevo valor (desde el provider)
		provide(value: T) {
			(state.set as (v: T) => void)(value);
		},
		// Usar el valor en hijos
		use() {
			return state;
		},
		destroy() {
			state.destroy();
		},
	};
}
