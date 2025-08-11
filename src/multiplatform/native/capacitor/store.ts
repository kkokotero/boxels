// Importa el módulo Preferences de Capacitor, que permite guardar y recuperar datos persistentes
import { Preferences } from '@capacitor/preferences';

// Importa el tipo Store desde el módulo de almacenamiento, para tipar el objeto que se devolverá
import type { Store } from '@data/storage';

/**
 * Crea una implementación de Store basada en Capacitor Preferences.
 * 
 * - Usa un `Map` en memoria como caché local para acceso rápido.
 * - Sincroniza los datos en segundo plano con el almacenamiento persistente de Capacitor.
 * - Permite operaciones CRUD (crear, leer, actualizar, eliminar) de forma simple.
 */
function createCapacitorStore(): Store {
	// 🗂 Caché en memoria para almacenar los valores ya leídos, evitando llamadas repetidas a Preferences
	const cache = new Map<string, unknown>();

	// 🔄 Precarga asíncrona de las claves almacenadas en Preferences.
	//    Esto ocurre en segundo plano cuando la store se inicializa.
	//    No es bloqueante: el store estará disponible antes de que termine la carga.
	void Preferences.keys().then(async ({ keys }) => {
		for (const key of keys) {
			// Recupera el valor persistido de cada clave
			const { value } = await Preferences.get({ key });
			if (value) {
				try {
					// Intenta parsear el valor como JSON antes de guardarlo en caché
					cache.set(key, JSON.parse(value));
				} catch {
					// Si falla el parseo, simplemente se ignora (valor inválido o no JSON)
				}
			}
		}
	});

	// 📦 Retorna un objeto que implementa la interfaz Store
	return {
		/**
		 * Guarda un valor en memoria y en almacenamiento persistente.
		 * @param key - Clave única del dato
		 * @param value - Valor a almacenar (se serializa a JSON)
		 */
		set<T>(key: string, value: T): void {
			cache.set(key, value); // Guarda en la caché en memoria
			void Preferences.set({ key, value: JSON.stringify(value) }); // Guarda en almacenamiento persistente
		},

		/**
		 * Recupera un valor desde la caché (sin llamada asíncrona).
		 * @param key - Clave del dato
		 * @returns El valor almacenado o null si no existe
		 */
		get<T>(key: string): T | null {
			return (cache.get(key) as T) ?? null;
		},

		/**
		 * Elimina un valor de la caché y del almacenamiento persistente.
		 * @param key - Clave del dato a eliminar
		 */
		delete(key: string): void {
			cache.delete(key);
			void Preferences.remove({ key });
		},

		/**
		 * Verifica si existe una clave en la caché.
		 * @param key - Clave a verificar
		 * @returns true si existe, false en caso contrario
		 */
		has(key: string): boolean {
			return cache.has(key);
		},

		/**
		 * Limpia toda la caché y el almacenamiento persistente.
		 */
		clear(): void {
			cache.clear();
			void Preferences.clear();
		},
	};
}

// 📌 Exporta una instancia lista para usar del Store basado en Capacitor
export const store = createCapacitorStore();
