import { __internalScheduler, type SchedulerState } from '@core/scheduler';

/**
 * Fuerza la ejecución inmediata de todas las tareas pendientes en la cola de microtareas del scheduler.
 *
 * Esta función es útil cuando se desea que todas las tareas programadas se ejecuten de forma sincrónica
 * en el momento actual, en lugar de esperar al próximo ciclo del event loop.
 *
 * Ejemplo de uso:
 *   flushNow(); // Procesa toda la cola del scheduler inmediatamente
 */
export function flushNow(): void {
	__internalScheduler.flush();
}

/**
 * Reinicia el estado interno del scheduler, incluyendo:
 * - La cola de microtareas
 * - El índice de ejecución actual
 * - Cualquier estado residual pendiente
 *
 * Esto es especialmente útil para pruebas unitarias o para reiniciar el sistema en tiempo de ejecución
 * sin reiniciar toda la aplicación.
 */
export function resetScheduler(): void {
	__internalScheduler._reset();
}

/**
 * Obtiene una instantánea del estado actual del scheduler.
 *
 * El objeto devuelto incluye detalles como:
 * - Las tareas actualmente en cola
 * - El índice de ejecución
 * - Información de depuración útil para diagnóstico o pruebas
 *
 * @returns {SchedulerState} Estado estructurado del scheduler
 */
export function getSchedulerState(): SchedulerState {
	return __internalScheduler.getState();
}
