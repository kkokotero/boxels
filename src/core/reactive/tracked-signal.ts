const trackedSignalsSet: Set<any> = new Set();

export function addTrackedSignal(signal: any) {
	trackedSignalsSet.add(signal);
}

export function getTrackedSignals(): any[] {
	return Array.from(trackedSignalsSet);
}

export function clearTrackedSignals() {
	trackedSignalsSet.clear();
}

// Limpieza automática cada 5s
setInterval(() => {
	clearTrackedSignals();
}, 5000);
