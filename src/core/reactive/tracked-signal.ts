import { onMount } from '@dom/element';
import { store } from './tracked-storage';

function resetCleanupTimer() {
	if (store.cleanupTimer) clearTimeout(store.cleanupTimer);

	store.cleanupTimer = setTimeout(() => {
		store.trackedSignals.length = 0; // vaciar la lista
		store.cleanupTimer = null;
	}, store.CLEANUP_INTERVAL);
}

export function addTrackedSignal(signal: any) {
	// evitar duplicados
	if (!store.trackedSignals.includes(signal)) {
		store.trackedSignals.push(signal);
	}

	// limpieza automática
	resetCleanupTimer();

	// limpieza en desmontaje
	onMount(() => {
		const idx = store.trackedSignals.indexOf(signal);
		if (idx !== -1) store.trackedSignals.splice(idx, 1);
	});
}

export function getTrackedSignals(): any[] {
	resetCleanupTimer(); // interacción = mantener vivo
	return [...store.trackedSignals];
}
