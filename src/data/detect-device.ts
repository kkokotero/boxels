export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type Orientation = 'portrait' | 'landscape';
export type ColorScheme = 'light' | 'dark';

export interface DeviceInfo {
	type: DeviceType;
	isTouch: boolean;
	isStandalone: boolean;
	platform: string;
	orientation: Orientation;
	colorScheme: ColorScheme;
}

export function detectDevice(): DeviceInfo {
	const ua = navigator.userAgent;
	const platform = navigator.platform || '';

	const isTouch =
		'ontouchstart' in window ||
		navigator.maxTouchPoints > 0 ||
		// @ts-expect-error
		navigator.msMaxTouchPoints > 0;

	const isStandalone =
		(window.navigator as any).standalone === true ||
		window.matchMedia('(display-mode: standalone)').matches;

	let type: DeviceType;
	if (/Tablet|iPad/i.test(ua)) {
		type = 'tablet';
	} else if (/Mobi|Android/i.test(ua)) {
		type = 'mobile';
	} else {
		const width = window.innerWidth;
		if (width <= 767) {
			type = 'mobile';
		} else if (width <= 1024) {
			type = 'tablet';
		} else {
			type = 'desktop';
		}
	}

	const orientation: Orientation =
		window.matchMedia('(orientation: landscape)').matches
			? 'landscape'
			: 'portrait';

	const colorScheme: ColorScheme =
		window.matchMedia('(prefers-color-scheme: dark)').matches
			? 'dark'
			: 'light';

	return {
		type,
		isTouch,
		isStandalone,
		platform,
		orientation,
		colorScheme,
	};
}
