/**
 * Interfaz que define los métodos básicos para un almacenamiento clave-valor tipado.
 * Permite almacenar, recuperar, eliminar y verificar datos en una estructura común.
 */
export interface Store {
	/**
	 * Guarda un valor asociado a una clave específica.
	 *
	 * @param key La clave bajo la cual se almacenará el valor.
	 * @param value El valor a almacenar. Puede ser de cualquier tipo serializable.
	 */
	set<T>(key: string, value: T): void;

	/**
	 * Recupera el valor asociado a una clave.
	 *
	 * @param key La clave del valor a recuperar.
	 * @returns El valor almacenado (deserializado) o `null` si no existe o hay un error.
	 */
	get<T>(key: string): T | null;

	/**
	 * Elimina el valor asociado a una clave.
	 *
	 * @param key La clave del elemento a eliminar.
	 */
	delete(key: string): void;

	/**
	 * Verifica si existe un valor para una clave específica.
	 *
	 * @param key La clave a comprobar.
	 * @returns `true` si la clave existe en el almacenamiento, `false` en caso contrario.
	 */
	has(key: string): boolean;

	/**
	 * Limpia todo el almacenamiento, eliminando todos los elementos guardados.
	 */
	clear(): void;
}

/**
 * Crea una implementación concreta de `Store` utilizando como base un objeto de almacenamiento Web.
 * (como `localStorage` o `sessionStorage`).
 *
 * Esta función proporciona una capa de abstracción sobre el almacenamiento Web, asegurando el tipado,
 * manejo de errores y la serialización/deserialización automática de los datos.
 *
 * @param storage Objeto que implementa la interfaz `Storage`, como `localStorage` o `sessionStorage`.
 * @returns Una instancia de `Store` que opera sobre el almacenamiento dado.
 */
function createStore(storage: Storage): Store {
	return {
		/**
		 * Serializa el valor proporcionado con `JSON.stringify` y lo guarda usando `setItem`.
		 *
		 * @param key Clave bajo la cual se guardará el valor.
		 * @param value Valor serializable a guardar.
		 */
		set<T>(key: string, value: T): void {
			try {
				const serialized = JSON.stringify(value);
				storage.setItem(key, serialized);
			} catch (err) {
				console.error(`[store] Error al guardar "${key}":`, err);
			}
		},

		/**
		 * Recupera el valor almacenado para la clave dada, y lo deserializa con `JSON.parse`.
		 *
		 * @param key Clave a recuperar.
		 * @returns El valor original si existe y se puede deserializar, `null` en caso contrario.
		 */
		get<T>(key: string): T | null {
			try {
				const item = storage.getItem(key);
				if (item === null) return null;
				return JSON.parse(item) as T;
			} catch (err) {
				console.error(`[store] Error al obtener "${key}":`, err);
				return null;
			}
		},

		/**
		 * Elimina el valor asociado a la clave proporcionada.
		 *
		 * @param key Clave del elemento a eliminar.
		 */
		delete(key: string): void {
			try {
				storage.removeItem(key);
			} catch (err) {
				console.error(`[store] Error al eliminar "${key}":`, err);
			}
		},

		/**
		 * Verifica si existe un valor para la clave especificada.
		 *
		 * @param key Clave a verificar.
		 * @returns `true` si hay un valor asociado, `false` si no existe.
		 */
		has(key: string): boolean {
			return storage.getItem(key) !== null;
		},

		/**
		 * Limpia completamente el almacenamiento, eliminando todos los elementos.
		 */
		clear(): void {
			try {
				storage.clear();
			} catch (err) {
				console.error('[store] Error al limpiar el almacenamiento:', err);
			}
		},
	};
}

/**
 * Crea una implementación de `Store` utilizando cookies como mecanismo de almacenamiento.
 * 
 * Esta alternativa permite almacenar datos en cookies, lo que puede ser útil en escenarios
 * donde `localStorage` o `sessionStorage` no estén disponibles o se necesite interoperabilidad
 * con el backend.
 *
 * @returns Una instancia de `Store` que opera sobre cookies.
 */
function createCookieStore(): Store {
	/**
	 * Recupera el valor de una cookie por su nombre.
	 *
	 * @param name Nombre de la cookie.
	 * @returns El valor de la cookie o `null` si no existe.
	 */
	const getCookie = (name: string): string | null => {
		const match = document.cookie.match(
			new RegExp('(?:^|; )' + encodeURIComponent(name) + '=([^;]*)'),
		);
		return match ? decodeURIComponent(match[1]) : null;
	};

	/**
	 * Establece una cookie con nombre, valor y duración en días.
	 *
	 * @param name Nombre de la cookie.
	 * @param value Valor de la cookie (como string serializado).
	 * @param days Número de días hasta que expire la cookie.
	 */
	const setCookie = (name: string, value: string, days = 365): void => {
		const expires = new Date(Date.now() + days * 864e5).toUTCString();
		document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
	};

	/**
	 * Elimina una cookie estableciendo su fecha de expiración en el pasado.
	 *
	 * @param name Nombre de la cookie a eliminar.
	 */
	const deleteCookie = (name: string): void => {
		document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
	};

	return {
		/**
		 * Serializa y guarda un valor como cookie.
		 *
		 * @param key Nombre de la cookie.
		 * @param value Valor a serializar y almacenar.
		 */
		set<T>(key: string, value: T): void {
			try {
				const serialized = JSON.stringify(value);
				setCookie(key, serialized);
			} catch (err) {
				console.error(`[cookieStore] Error al guardar "${key}":`, err);
			}
		},

		/**
		 * Recupera y deserializa un valor almacenado en cookies.
		 *
		 * @param key Nombre de la cookie.
		 * @returns Valor original deserializado o `null`.
		 */
		get<T>(key: string): T | null {
			try {
				const value = getCookie(key);
				if (!value) return null;
				return JSON.parse(value) as T;
			} catch (err) {
				console.error(`[cookieStore] Error al obtener "${key}":`, err);
				return null;
			}
		},

		/**
		 * Elimina una cookie.
		 *
		 * @param key Nombre de la cookie a eliminar.
		 */
		delete(key: string): void {
			try {
				deleteCookie(key);
			} catch (err) {
				console.error(`[cookieStore] Error al eliminar "${key}":`, err);
			}
		},

		/**
		 * Verifica si una cookie con el nombre especificado existe.
		 *
		 * @param key Nombre de la cookie.
		 * @returns `true` si existe, `false` si no.
		 */
		has(key: string): boolean {
			return getCookie(key) !== null;
		},

		/**
		 * Elimina todas las cookies disponibles en el dominio actual.
		 */
		clear(): void {
			try {
				document.cookie.split(';').forEach((cookie) => {
					const eqPos = cookie.indexOf('=');
					const key = decodeURIComponent(cookie.slice(0, eqPos).trim());
					deleteCookie(key);
				});
			} catch (err) {
				console.error('[cookieStore] Error al limpiar cookies:', err);
			}
		},
	};
}

// ======== INSTANCIAS DE USO =========

/**
 * Instancia de almacenamiento basada en cookies.
 */
export const cookies = createCookieStore();

/**
 * Instancia de `Store` que utiliza `localStorage`, ideal para persistencia a largo plazo.
 */
export const storage = createStore(localStorage);

/**
 * Instancia de `Store` que utiliza `sessionStorage`, ideal para persistencia temporal (por sesión).
 */
export const session = createStore(sessionStorage);

/**
 * Objeto agrupador que expone todos los tipos de almacenamiento disponibles:
 * - `storage` para persistencia permanente
 * - `session` para persistencia temporal
 * - `cookies` para almacenamiento en cookies
 */
export const local = { storage, session, cookies };
