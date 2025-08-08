import type { Store as StoreInterface } from '@data/storage';
import { default as ElectronStore } from 'electron-store';

function createElectronStore(): StoreInterface {
	const store = new ElectronStore();

	return {
		set<T>(key: string, value: T): void {
			store.set(key, value);
		},
		get<T>(key: string): T | null {
			const value = store.get(key);
			return value === undefined ? null : (value as T);
		},
		delete(key: string): void {
			store.delete(key);
		},
		has(key: string): boolean {
			return store.has(key);
		},
		clear(): void {
			store.clear();
		},
	};
}

export const store = createElectronStore();
