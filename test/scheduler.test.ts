import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queue, cancel, onSchedulerError, __internalScheduler } from '../src/core/scheduler';

describe('microtaskScheduler', () => {
	beforeEach(() => {
		__internalScheduler._reset();
		onSchedulerError(() => {}); // Limpia cualquier handler previo
	});

	it('ejecuta tareas sincrónicas en orden', async () => {
		const result: number[] = [];

		queue(() => result.push(1));
		queue(() => result.push(2));
		queue(() => result.push(3));

		await Promise.resolve(); // Esperamos al flush de microtareas

		expect(result).toEqual([1, 2, 3]);
	});

	it('ejecuta tareas asincrónicas', async () => {
		const result: string[] = [];

		queue(async () => {
			await new Promise((res) => setTimeout(res, 1));
			result.push('async');
		});

		await new Promise((res) => setTimeout(res, 10));
		expect(result).toEqual(['async']);
	});

	it('cancela tareas antes de ejecutarse', async () => {
		const fn1 = vi.fn();
		const fn2 = vi.fn();
		const t1 = queue(fn1);
		const t2 = queue(fn2);

		cancel(t2);

		await Promise.resolve();

		expect(fn1).toHaveBeenCalled();
		expect(fn2).not.toHaveBeenCalled();
	});

	it('llama al manejador de errores en errores sincrónicos', async () => {
		const handler = vi.fn();
		onSchedulerError(handler);

		queue(() => {
			throw new Error('Error sincrónico');
		});

		await Promise.resolve();

		expect(handler).toHaveBeenCalled();
		expect(handler.mock.calls[0][0]).toBeInstanceOf(Error);
	});

	it('llama al manejador de errores en promesas rechazadas', async () => {
		const handler = vi.fn();
		onSchedulerError(handler);

		queue(() => Promise.reject(new Error('Error async')));

		await new Promise((r) => setTimeout(r, 10));

		expect(handler).toHaveBeenCalled();
		expect(handler.mock.calls[0][0]).toBeInstanceOf(Error);
	});

	it('limpia el estado tras cada flush', async () => {
		const stateBefore = __internalScheduler.getState();
		expect(stateBefore.queue).toHaveLength(0);

		queue(() => {});

		await Promise.resolve();

		const stateAfter = __internalScheduler.getState();
		expect(stateAfter.queue).toHaveLength(0);
		expect(stateAfter.flushing).toBe(false);
		expect(stateAfter.index).toBe(0);
	});
});
