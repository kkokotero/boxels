import type { Hook } from '@hooks/hook';

// --- Scheduler global para delays usando un solo requestAnimationFrame ---
class RafScheduler {
	private tasks = new Set<{
		runAt: number;
		callback: () => void;
		canceled: boolean;
	}>();
	private rafId: number | null = null;

	private loop = (time: number) => {
		for (const task of this.tasks) {
			if (!task.canceled && time >= task.runAt) {
				task.callback();
				this.tasks.delete(task);
			}
		}
		if (this.tasks.size > 0) {
			this.rafId = requestAnimationFrame(this.loop);
		} else {
			this.rafId = null;
		}
	};

	public schedule(callback: () => void, delay: number) {
		const runAt = performance.now() + delay;
		const task = { runAt, callback, canceled: false };
		this.tasks.add(task);

		if (this.rafId === null) {
			this.rafId = requestAnimationFrame(this.loop);
		}

		return () => {
			task.canceled = true;
			this.tasks.delete(task);
		};
	}
}

const globalScheduler = new RafScheduler();

/**
 * Clase SimpleDelay usando scheduler global con un solo rAF para múltiples delays.
 */
export class Delay implements Hook {
	private cancelFn?: () => void;

	constructor(
		private callback: () => void,
		private delay: number,
	) {
		this.cancelFn = globalScheduler.schedule(callback, delay);
	}

	public destroy() {
		if (this.cancelFn) {
			this.cancelFn();
			this.cancelFn = undefined;
		}
	}
}

/**
 * Función auxiliar para crear delay
 */
export const createDelay = (callback: () => void, delay: number) =>
	new Delay(callback, delay);
