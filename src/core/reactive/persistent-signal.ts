// Importa los adaptadores de almacenamiento `session` y `storage` (por ejemplo, sessionStorage y localStorage)
import { session, storage } from '../../data/storage';

// Importa la función `signal` para crear señales reactivas
import { signal } from './signal';

// Importa el tipo para funciones de actualización reactiva
import type { ReactiveUpdate } from './types';

/**
 * Crea una señal reactiva cuyo valor se guarda de forma persistente en `sessionStorage` o `localStorage`.
 *
 * Esta señal permite que el estado sobreviva a recargas de página o cambios de pestaña, dependiendo del almacenamiento elegido.
 *
 * @template T Tipo del valor almacenado.
 * @param key Clave única para identificar este valor en el almacenamiento.
 * @param initialValue Valor inicial a usar si no hay nada guardado.
 * @param data Objeto opcional que especifica dónde guardar el valor (`session` o `storage`).
 *             Por defecto es `sessionStorage`.
 *
 * @returns Una señal reactiva cuyo valor se mantiene sincronizado con el almacenamiento elegido.
 *
 * @example
 * ```ts
 * const theme = persistentSignal('user-theme', 'light', { local: 'storage' });
 *
 * theme();        // Devuelve "light" o el valor recuperado desde localStorage
 * theme.set('dark'); // Establece nuevo valor y lo guarda de forma persistente
 *
 * console.log(localStorage.getItem('__persistent_signal_key_user-theme'));
 * // Devuelve "dark"
 * ```
 */
export function persistentSignal<T>(
	key: string,
	initialValue: T,
	data: { local: 'session' | 'storage' } = { local: 'session' },
) {
	// Clave interna usada para evitar colisiones en el almacenamiento
	const sessionKey = `__persistent_signal_key_${key}`;

	// Selecciona el backend de almacenamiento apropiado según la configuración
	const local = data.local === 'session' ? session : storage;

	// Intenta recuperar un valor previamente almacenado desde el almacenamiento persistente
	const stored = local.get<T>(sessionKey);

	// Crea una señal reactiva con el valor recuperado o el valor inicial si no hay datos almacenados
	const base = signal<T>(stored || initialValue);

	// Guarda la implementación original del método `set` de la señal
	const originalSet = base.set;

	/**
	 * Sobrescribe el método `set` para actualizar tanto la señal como el almacenamiento.
	 *
	 * @param newValue El nuevo valor a establecer.
	 */
	base.set = (newValue: T) => {
		originalSet(newValue);           // Actualiza internamente el valor de la señal
		local.set(sessionKey, base());  // Guarda el valor actual en el almacenamiento persistente
	};

	/**
	 * Sobrescribe el método `update` para aplicar una función de transformación y guardar el nuevo valor.
	 *
	 * @param updater Función que recibe el valor actual y retorna el nuevo.
	 * 
	 * @example
	 * ```ts
	 * theme.update(prev => prev === 'light' ? 'dark' : 'light');
	 * ```
	 */
	base.update = (updater: ReactiveUpdate<T>) => {
		const result = updater(base()); // Aplica función al valor actual
		base.set(result);               // Usa el nuevo valor y lo guarda automáticamente
	};

	// Guarda la implementación original del método `destroy` de la señal
	const originalDestroy = base.destroy;

	/**
	 * Sobrescribe el método `destroy` para eliminar también el valor del almacenamiento persistente.
	 */
	base.destroy = () => {
		local.delete(sessionKey); // Elimina el valor asociado del almacenamiento
		originalDestroy();        // Limpia recursos internos de la señal
	};

	// Devuelve la señal extendida con persistencia
	return base;
}
