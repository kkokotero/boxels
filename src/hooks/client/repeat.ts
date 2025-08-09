import type { Hook } from '@hooks/hook';

type RepeatTask = {
  interval: number;
  lastRun: number;
  callback: () => void;
  canceled: boolean;
};

class RafRepeatScheduler {
  private tasks = new Set<RepeatTask>();
  private rafId: number | null = null;

  private loop = (time: number) => {
    for (const task of this.tasks) {
      if (task.canceled) {
        this.tasks.delete(task);
        continue;
      }
      if (time - task.lastRun >= task.interval) {
        task.callback();
        task.lastRun = time;
      }
    }

    if (this.tasks.size > 0) {
      this.rafId = requestAnimationFrame(this.loop);
    } else {
      this.rafId = null;
    }
  };

  public schedule(callback: () => void, interval: number) {
    const now = performance.now();
    const task: RepeatTask = {
      interval,
      lastRun: now,
      callback,
      canceled: false,
    };
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

const globalRepeatScheduler = new RafRepeatScheduler();

/**
 * Clase useRepeat: ejecuta una función periódicamente con cancelación.
 */
export class Repeat implements Hook {
  private cancelFn?: () => void;

  constructor(private callback: () => void, private interval: number) {
    this.cancelFn = globalRepeatScheduler.schedule(callback, interval);
  }

  public destroy() {
    if (this.cancelFn) {
      this.cancelFn();
      this.cancelFn = undefined;
    }
  }
}

/**
 * Función auxiliar para crear una instancia de useRepeat
 */
export const createRepeat = (
  callback: () => void,
  interval: number
) => new Repeat(callback, interval);
