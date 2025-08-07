// oxlint-disable no-unsafe-finally
/** biome-ignore-all lint/correctness/noUnsafeFinally: Necesitamos salir temprano para evitar recursión infinita */

/**
 * Tipo que representa una tarea. Puede ser una función sincrónica o una que retorne una promesa.
 */
export type Task = () => void | Promise<void>;

/**
 * Estado interno del scheduler (planificador).
 */
export interface SchedulerState {
	queue: (Task | null)[];  // Cola de tareas (puede contener nulos si alguna se cancela)
	index: number;           // Índice de la tarea actual en ejecución
	scheduled: boolean;      // Indica si ya se ha programado un flush (vaciar cola)
	flushing: boolean;       // Indica si actualmente se está vaciando la cola
	recursion: number;       // Número de veces que se ha reiniciado el bucle de ejecución en un solo ciclo
}

// Límite de recursión para evitar loops infinitos
const MAX_RECURSION = 10000;

// Definimos un scheduler utilizando un IIFE (Immediately Invoked Function Expression)
const microtaskScheduler = (() => {
	// Estado compartido del scheduler
	const state: SchedulerState = {
		queue: [],
		index: 0,
		scheduled: false,
		flushing: false,
		recursion: 0,
	};

	// Manejador de errores personalizado, si se define
	let errorHandler: ((error: unknown) => void) | null = null;

	/**
	 * Función encargada de vaciar la cola de tareas.
	 * Ejecuta cada tarea en orden, y maneja errores de forma segura.
	 */
	const flush = () => {
		state.scheduled = false;
		state.flushing = true;
		state.recursion = 0;

		let limit = state.queue.length;

		// Mientras haya tareas pendientes
		while (state.index < state.queue.length) {
			const task = state.queue[state.index];

			if (task == null) {
				// Si la tarea fue cancelada (es null), continuar con la siguiente
				state.index++;
				continue;
			}

			try {
				// Ejecutamos la tarea
				const result = task();

				// Si es una promesa, atrapamos errores asíncronos
				if (result instanceof Promise) {
					result.catch((err) => {
						try {
							errorHandler?.(err);
						} catch (handlerErr) {
							console.error('Error en el manejador de errores:', handlerErr);
						}
					});
				}
			} catch (err) {
				// Si hay error en la ejecución sincrónica de la tarea
				try {
					errorHandler?.(err);
				} catch (handlerErr) {
					console.error('Error en el manejador de errores:', handlerErr);
				}
				// Marcamos la tarea como null (cancelada)
				state.queue[state.index] = null;
			}

			state.index++;

			// Verificamos si el tamaño de la cola ha aumentado y evitamos recursión infinita
			if (state.index > limit) {
				if (++state.recursion > MAX_RECURSION) {
					try {
						errorHandler?.(new Error('Se excedió el límite de recursión de microtareas'));
					} finally {
						reset(); // Limpiamos el estado antes de salir
						console.warn('Límite de recursión alcanzado, saliendo del flush');
						return; // Salida anticipada para evitar loop infinito
					}
				}
				limit = state.queue.length;
			}
		}

		reset(); // Limpiar estado luego de vaciar la cola
	};

	/**
	 * Reinicia el estado interno del scheduler.
	 */
	const reset = () => {
		state.queue = [];
		state.index = 0;
		state.flushing = false;
		state.recursion = 0;
	};

	/**
	 * Función que define cómo se programa un `flush` usando microtareas.
	 * Se intenta usar `queueMicrotask`, o una promesa resuelta como fallback.
	 */
	const scheduleFlush = (() => {
		if (typeof queueMicrotask === 'function') {
			return () => queueMicrotask(flush);
		}
		if (typeof Promise === 'function') {
			const resolved = Promise.resolve();
			return () => resolved.then(flush);
		}
		// Si no se encuentra un mecanismo de microtareas, lanzamos error
		throw new Error('No hay mecanismo de microtareas disponible');
	})();

	/**
	 * Agrega una tarea a la cola.
	 * Si no hay un flush programado, lo programa.
	 */
	function enqueue(task: Task): Task {
		state.queue.push(task);
		if (!state.scheduled) {
			state.scheduled = true;
			scheduleFlush();
		}
		return task;
	}

	/**
	 * Cancela una tarea pendiente en la cola (si aún no ha sido ejecutada).
	 */
	function cancel(task: Task): void {
		for (let i = state.index; i < state.queue.length; i++) {
			if (state.queue[i] === task) {
				state.queue[i] = null;
				break;
			}
		}
	}

	/**
	 * Establece una función para manejar errores que ocurran durante la ejecución de tareas.
	 */
	function setErrorHandler(fn: (error: unknown) => void): void {
		errorHandler = fn;
	}

	// Retornamos la API pública del scheduler
	return {
		enqueue,
		cancel,
		setErrorHandler,
		// Exponemos herramientas internas para pruebas o depuración
		_internal: {
			flush,
			getState: () => state,
			_reset: reset,
		},
	};
})();

// === API pública ===

/**
 * Encola una tarea para que se ejecute como microtarea.
 */
export const queue = microtaskScheduler.enqueue;

/**
 * Cancela una tarea previamente encolada, si aún no ha sido ejecutada.
 */
export const cancel = microtaskScheduler.cancel;

/**
 * Permite definir un manejador global de errores para tareas ejecutadas.
 */
export const onSchedulerError = microtaskScheduler.setErrorHandler;

/**
 * Exposición de funciones internas del scheduler para propósitos de testing.
 */
export const __internalScheduler = microtaskScheduler._internal;
