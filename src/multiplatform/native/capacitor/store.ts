import { Preferences } from '@capacitor/preferences';
import type { Store } from '@data/storage';

function createCapacitorStore(): Store {
	const cache = new Map<string, unknown>();

	// precarga sincrónica vacía, pero puedes usar .init() aparte si lo necesitas
	void Preferences.keys().then(async ({ keys }) => {
		for (const key of keys) {
			const { value } = await Preferences.get({ key });
			if (value) {
				try {
					cache.set(key, JSON.parse(value));
				} catch {}
			}
		}
	});

	return {
		set<T>(key: string, value: T): void {
			cache.set(key, value);
			void Preferences.set({ key, value: JSON.stringify(value) });
		},
		get<T>(key: string): T | null {
			return (cache.get(key) as T) ?? null;
		},
		delete(key: string): void {
			cache.delete(key);
			void Preferences.remove({ key });
		},
		has(key: string): boolean {
			return cache.has(key);
		},
		clear(): void {
			cache.clear();
			void Preferences.clear();
		},
	};
}

export const store = createCapacitorStore();
