// context.ts
import { type Signal, type Widen, signal } from '@core/reactive';

type Context<T> = {
	provide(value: Widen<T>): void;
	use(): Signal<T>;
	destroy(): void;
};

export function createContext<T>(defaultValue: T): Context<T> {
	// Estado compartido (signal raíz)
	const state = signal(defaultValue);

	return {
		// Proveer un nuevo valor (desde el provider)
		provide(value: Widen<T>) {
			state.set(value);
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
