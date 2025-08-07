import { describe, it, expect, vi } from 'vitest';
import { signal } from '../../src/core/reactive/signal';
import { effect } from '../../src/core/reactive/effect';
import { flushNow } from '../../src/testing/scheduler-test';

describe('Effect', () => {
	describe('Ejecución inicial', () => {
		it('debería ejecutar el efecto inmediatamente', () => {
			const count = signal(0);
			const spy = vi.fn(() => {});

			effect([count], spy);
			flushNow();
			expect(spy).toHaveBeenCalledTimes(1);
		});
	});

	describe('Reactividad', () => {
		it('debería ejecutarse cuando las dependencias cambien', () => {
			const count = signal(0);
			const spy = vi.fn(() => {});

			effect([count], spy);
			count.update(() => 1);
			count.update(() => 2);
            flushNow();

			expect(spy).toHaveBeenCalledTimes(3); // 1 inicial + 2 actualizaciones
		});

		it('debería manejar múltiples dependencias', () => {
			const a = signal(0);
			const b = signal(0);
			const spy = vi.fn(() => {});

			effect([a, b], spy);
			a.update(() => 1);
			b.update(() => 1);
            flushNow();

			expect(spy).toHaveBeenCalledTimes(4); // 1 inicial + 3 actualizaciones
		});
	});

	describe('Limpieza', () => {
		it('debería ejecutar la función de limpieza cuando se detiene', () => {
			const count = signal(0);
			const cleanup = vi.fn(() => {});
			const run = vi.fn(() => cleanup());

			const stop = effect([count], run);
			stop();
            flushNow();

			expect(cleanup).toHaveBeenCalledTimes(1);
		});

		it('debería ejecutar la limpieza antes de cada nueva ejecución', () => {
			const count = signal(0);
			const cleanup = vi.fn(() => {});
			const run = vi.fn(() => cleanup());

			effect([count], run);
			count.update(() => 1);
            flushNow();

			expect(cleanup).toHaveBeenCalledTimes(2);
		});
	});

	describe('Efectos asíncronos', () => {
		it('debería manejar efectos async', async () => {
			const count = signal(0);
			const result = signal<number | null>(null);

			effect([count], async () => {
				const value = await Promise.resolve(count() * 2);
				result.update(() => value);
                flushNow();
			});

			flushNow();
			expect(result()).toBe(null);

			count.update(() => 1);
			await Promise.resolve();
            flushNow();
			expect(result()).toBe(0);
		});

		it('debería manejar cleanup async', async () => {
			const count = signal(0);
			const cleanupCalled = signal(false);

			effect([count], async () => {
				await Promise.resolve();
				cleanupCalled.update(() => true);
			});

			count.update(() => 1);
			await Promise.resolve();

			expect(cleanupCalled()).toBe(false);
		});
	});
});
