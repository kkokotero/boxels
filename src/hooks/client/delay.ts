import type { Hook } from '@hooks/hook';

/**
 * --- Scheduler global para manejar múltiples "delays" usando un único requestAnimationFrame ---
 * 
 * La idea principal de esta clase es optimizar la ejecución de múltiples temporizadores
 * que dependen de animaciones o tiempos, utilizando **un solo ciclo de requestAnimationFrame**,
 * en lugar de múltiples `setTimeout` o múltiples `requestAnimationFrame` independientes.
 * 
 * Esto reduce la sobrecarga de procesamiento y mejora el rendimiento.
 */
class RafScheduler {
	/**
	 * Conjunto de tareas programadas.
	 * 
	 * Cada tarea contiene:
	 * - `runAt`: Momento exacto (en milisegundos de `performance.now()`) en el que debe ejecutarse.
	 * - `callback`: Función que se debe ejecutar.
	 * - `canceled`: Indicador para saber si la tarea fue cancelada antes de ejecutarse.
	 */
	private tasks = new Set<{
		runAt: number;
		callback: () => void;
		canceled: boolean;
	}>();

	/** ID del requestAnimationFrame actual en ejecución, o null si no hay ciclo activo. */
	private rafId: number | null = null;

	/**
	 * Bucle principal del scheduler, llamado en cada frame por requestAnimationFrame.
	 * 
	 * @param time Tiempo actual proporcionado por rAF, medido en ms desde que la página inició.
	 */
	private loop = (time: number) => {
		for (const task of this.tasks) {
			// Verifica si la tarea no está cancelada y si ya llegó su momento de ejecución.
			if (!task.canceled && time >= task.runAt) {
				task.callback();         // Ejecuta la función programada
				this.tasks.delete(task); // Elimina la tarea de la lista
			}
		}

		// Si quedan tareas pendientes, continúa el ciclo, si no, detiene el rAF.
		if (this.tasks.size > 0) {
			this.rafId = requestAnimationFrame(this.loop);
		} else {
			this.rafId = null;
		}
	};

	/**
	 * Programa una nueva tarea para ejecutarse después de cierto tiempo.
	 * 
	 * @param callback Función a ejecutar cuando se cumpla el tiempo.
	 * @param delay Tiempo en milisegundos a esperar antes de ejecutar.
	 * @returns Función para cancelar la tarea antes de que se ejecute.
	 */
	public schedule(callback: () => void, delay: number) {
		// Calcula el momento exacto en que debe ejecutarse la tarea
		const runAt = performance.now() + delay;
		const task = { runAt, callback, canceled: false };
		this.tasks.add(task);

		// Si no hay un rAF activo, inicia el ciclo
		if (this.rafId === null) {
			this.rafId = requestAnimationFrame(this.loop);
		}

		// Devuelve una función para cancelar esta tarea específica
		return () => {
			task.canceled = true;
			this.tasks.delete(task);
		};
	}
}

// Instancia única y global del scheduler para reutilizar en todo el proyecto
const globalScheduler = new RafScheduler();

/**
 * Clase `Delay` — Representa un delay programado, usando el scheduler global.
 * 
 * Implementa la interfaz `Hook` para integrarse fácilmente en sistemas que
 * gestionan recursos/instancias que se deben destruir.
 */
export class Delay implements Hook {
	/** Función para cancelar la ejecución del delay. */
	private cancelFn?: () => void;

	/**
	 * @param callback Función a ejecutar después del delay.
	 * @param delay Tiempo en milisegundos antes de ejecutar la función.
	 */
	constructor(
		private callback: () => void,
		private delay: number,
	) {
		// Programa el delay usando el scheduler global y guarda la función de cancelación
		this.cancelFn = globalScheduler.schedule(callback, delay);
	}

	/**
	 * Cancela el delay si aún no ha sido ejecutado.
	 */
	public destroy() {
		if (this.cancelFn) {
			this.cancelFn();
			this.cancelFn = undefined;
		}
	}
}

/**
 * Función auxiliar para crear un Delay de forma rápida.
 * 
 * @param callback Función a ejecutar después del delay.
 * @param delay Tiempo en milisegundos antes de ejecutar la función.
 * @returns Instancia de `Delay`.
 */
export const createDelay = (callback: () => void, delay: number) =>
	new Delay(callback, delay);
