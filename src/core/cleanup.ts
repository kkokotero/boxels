type Cleanup = () => void;

/**
 * Registro global único de limpiezas asociadas a objetos.
 *
 * - Cuando el objeto (`target`) es recolectado por el GC,
 *   se ejecutan automáticamente todas sus funciones de limpieza.
 * - También permite ejecutar las limpiezas de forma manual
 *   a través de `destroy()`.
 */
const registry = new FinalizationRegistry<CleanupRecord>((record) => {
	for (const fn of record.fns) {
		fn();
	}
	record.fns.clear();
	record.destroyed = true;
});

interface CleanupRecord {
	fns: Set<Cleanup>;
	destroyed: boolean;
}

/**
 * Crea o recupera un manejador de limpieza asociado a un target.
 *
 * - Las limpiezas se ejecutarán automáticamente cuando el target
 *   sea recolectado por el GC.
 * - También pueden ejecutarse de forma manual llamando a `destroy()`.
 */
export function autoCleanup(target: object) {
	// El "record" contiene todas las limpiezas de este objeto
	const record: CleanupRecord = { fns: new Set(), destroyed: false };

	// Registramos el record en el FinalizationRegistry,
	// usando el target como unregisterToken para poder limpiarlo manualmente.
	registry.register(target, record, target);

	const run = () => {
		if (record.destroyed) return;
		for (const fn of record.fns) {
			try {
				fn();
			} catch (err) {
				console.error('Error en cleanup manual:', err);
			}
		}
		record.fns.clear();
		record.destroyed = true;
		registry.unregister(target);
	};

	return {
		/** Añadir varias funciones de limpieza */
		onCleanup(fn: Cleanup) {
			if (!record.destroyed) record.fns.add(fn);
		},
		/** Ejecutar manualmente todas las limpiezas */
		destroy: run,
		/** Estado actual */
		get destroyed() {
			return record.destroyed;
		},
	};
}
