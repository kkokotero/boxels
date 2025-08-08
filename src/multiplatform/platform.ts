export type Platform = 'web' | 'capacitor' | 'electron';

export function detectPlatform(): Platform {
	if ((window as any).Capacitor?.isNativePlatform) return 'capacitor';
	if ((window as any).process?.versions?.electron) return 'electron';
	return 'web';
}
