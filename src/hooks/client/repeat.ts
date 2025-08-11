import type { Hook } from '@hooks/hook';

/**
 * Tipo de tarea repetitiva gestionada por el scheduler.
 * 
 * - `interval`: Tiempo en milisegundos entre ejecuciones.
 * - `lastRun`: Momento en el que se ejecutó por última vez (usando performance.now()).
 * - `callback`: Función que se ejecuta en cada intervalo.
 * - `canceled`: Bandera para indicar si la tarea ha sido cancelada.
 */
type RepeatTask = {
  interval: number;
  lastRun: number;
  callback: () => void;
  canceled: boolean;
};

/**
 * --- Scheduler global para tareas repetitivas con requestAnimationFrame ---
 * 
 * Este scheduler permite ejecutar funciones de forma periódica (cada cierto intervalo),
 * pero usando **un único ciclo de requestAnimationFrame** compartido para todas las tareas.
 * 
 * Esto es más eficiente que tener múltiples `setInterval` o múltiples rAF por separado,
 * reduciendo la sobrecarga de timers y mejorando el rendimiento.
 */
class RafRepeatScheduler {
  /** Conjunto de todas las tareas repetitivas activas. */
  private tasks = new Set<RepeatTask>();

  /** ID del requestAnimationFrame activo, o `null` si no hay ciclo en ejecución. */
  private rafId: number | null = null;

  /**
   * Bucle principal del scheduler, llamado en cada frame por requestAnimationFrame.
   * 
   * @param time Tiempo actual en milisegundos desde que la página se inició (proporcionado por rAF).
   */
  private loop = (time: number) => {
    for (const task of this.tasks) {
      // Si la tarea fue cancelada, se elimina de la lista
      if (task.canceled) {
        this.tasks.delete(task);
        continue;
      }

      // Verifica si ha pasado el intervalo desde la última ejecución
      if (time - task.lastRun >= task.interval) {
        task.callback();     // Ejecuta la función periódica
        task.lastRun = time; // Actualiza el tiempo de la última ejecución
      }
    }

    // Si todavía hay tareas, continúa el bucle; si no, detiene el rAF
    if (this.tasks.size > 0) {
      this.rafId = requestAnimationFrame(this.loop);
    } else {
      this.rafId = null;
    }
  };

  /**
   * Programa una nueva tarea repetitiva.
   * 
   * @param callback Función a ejecutar cada intervalo.
   * @param interval Tiempo en milisegundos entre cada ejecución.
   * @returns Función para cancelar la tarea.
   */
  public schedule(callback: () => void, interval: number) {
    const now = performance.now();

    const task: RepeatTask = {
      interval,
      lastRun: now,
      callback,
      canceled: false,
    };

    this.tasks.add(task);

    // Si no hay un rAF en ejecución, inicia el bucle
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this.loop);
    }

    // Devuelve la función de cancelación para este task
    return () => {
      task.canceled = true;
      this.tasks.delete(task);
    };
  }
}

// Instancia única y global para gestionar todas las tareas repetitivas
const globalRepeatScheduler = new RafRepeatScheduler();

/**
 * Clase `Repeat` — Ejecuta una función periódicamente con opción de cancelación.
 * 
 * Implementa la interfaz `Hook` para integrarse con sistemas que gestionan
 * recursos y requieren limpieza (`destroy`).
 */
export class Repeat implements Hook {
  /** Función para cancelar la ejecución periódica. */
  private cancelFn?: () => void;

  /**
   * @param callback Función que se ejecutará periódicamente.
   * @param interval Tiempo en milisegundos entre cada ejecución.
   */
  constructor(private callback: () => void, private interval: number) {
    this.cancelFn = globalRepeatScheduler.schedule(callback, interval);
  }

  /**
   * Cancela la ejecución periódica si sigue activa.
   */
  public destroy() {
    if (this.cancelFn) {
      this.cancelFn();
      this.cancelFn = undefined;
    }
  }
}

/**
 * Función auxiliar para crear una instancia de `Repeat`.
 * 
 * @param callback Función que se ejecutará periódicamente.
 * @param interval Tiempo en milisegundos entre cada ejecución.
 * @returns Instancia de `Repeat`.
 */
export const createRepeat = (
  callback: () => void,
  interval: number
) => new Repeat(callback, interval);
