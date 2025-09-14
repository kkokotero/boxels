import { onMount } from '@dom/lifecycle';

const trackedSignalsSet: Set<any> = new Set();

export function addTrackedSignal(signal: any) {
	trackedSignalsSet.add(signal);

	onMount(() => {
		trackedSignalsSet.delete(signal);
	});
}

export function getTrackedSignals(): any[] {
	return Array.from(trackedSignalsSet);
}
