import { detectDevice, type DeviceInfo } from '@data/detect-device';
import { signal } from '@core/index';

const deviceSignal = signal<DeviceInfo>(detectDevice());

let initialized = false;

function startListeners() {
	if (initialized) return;
	initialized = true;

	// Re-detect on orientation or theme changes
	const update = () => deviceSignal.set(detectDevice());

	window.matchMedia('(orientation: portrait)').addEventListener('change', update);
	window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', update);
	window.addEventListener('resize', update);
}

export function useDeviceInfo() {
	startListeners();
	return deviceSignal;
}
