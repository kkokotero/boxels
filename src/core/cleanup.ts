type Cleanup = () => void;

interface CleanupRecord {
	fns: Set<Cleanup>;
	destroyed: boolean;
}

// Mapa de objetos → limpiezas registradas
const cleanupMap = new WeakMap<object, CleanupRecord>();

// Registro global único
// Registro global único
const registry = new FinalizationRegistry<CleanupRecord>((record) => {
	if (!record) return;
	for (const fn of record.fns) {
		try {
			fn();
		} catch (err) {
			console.error("Error en cleanup automático:", err);
		}
	}
	record.fns.clear();
	record.destroyed = true;
	// Nota: no podemos borrar del WeakMap aquí porque no tenemos el target
});

/**
 * Crea o recupera un manejador de limpieza asociado a un target
 */
export function autoCleanup(target: object) {
	let record = cleanupMap.get(target);
	if (!record) {
		record = { fns: new Set(), destroyed: false };
		cleanupMap.set(target, record);
		// Registramos usando el record como holding y el target como unregisterToken
		registry.register(target, record, target);
	}

	const run = () => {
		if (record!.destroyed) return;
		for (const fn of record!.fns) {
			try {
				fn();
			} catch (err) {
				console.error("Error en cleanup manual:", err);
			}
		}
		record!.fns.clear();
		record!.destroyed = true;
		registry.unregister(target);
		cleanupMap.delete(target);
	};

	return {
		/** Añadir varias limpiezas */
		onCleanup(fn: Cleanup) {
			if (!record!.destroyed) record!.fns.add(fn);
		},
		/** Ejecutar manualmente todas las limpiezas */
		destroy: run,
		get destroyed() {
			return record!.destroyed;
		},
	};
}
