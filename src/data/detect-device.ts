// Tipos posibles para clasificar el tipo de dispositivo
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

// Tipos posibles para la orientación de la pantalla
export type Orientation = 'portrait' | 'landscape';

// Tipos posibles para el esquema de color preferido del usuario
export type ColorScheme = 'light' | 'dark';

// Interfaz que define la información que describe un dispositivo detectado
export interface DeviceInfo {
	type: DeviceType;       // Tipo de dispositivo: móvil, tableta o escritorio
	isTouch: boolean;       // Indica si el dispositivo soporta pantalla táctil
	isStandalone: boolean;  // Indica si la app está en modo standalone (PWA instalada)
	platform: string;       // Plataforma reportada por el navegador (ej: "Win32", "MacIntel")
	orientation: Orientation; // Orientación actual de la pantalla
	colorScheme: ColorScheme; // Esquema de color preferido: claro u oscuro
}

/**
 * Detecta información del dispositivo actual usando APIs del navegador.
 * 
 * Retorna un objeto `DeviceInfo` con:
 *  - Tipo de dispositivo (mobile, tablet, desktop)
 *  - Si soporta touch
 *  - Si está en modo standalone (PWA)
 *  - Plataforma del sistema
 *  - Orientación de la pantalla
 *  - Esquema de color preferido
 */
export function detectDevice(): DeviceInfo {
	// Obtenemos el User Agent para análisis
	const ua = navigator.userAgent;

	// Obtenemos la plataforma reportada por el navegador
	const platform = navigator.platform || '';

	// Detecta si el dispositivo tiene pantalla táctil
	const isTouch =
		'ontouchstart' in window ||                  // Evento táctil soportado
		navigator.maxTouchPoints > 0 ||              // Número de puntos táctiles > 0
		// @ts-expect-error: compatibilidad con IE
		navigator.msMaxTouchPoints > 0;              // Compatibilidad antigua (MS)

	// Detecta si la app está en modo standalone (por ejemplo, PWA instalada)
	const isStandalone =
		(window.navigator as any).standalone === true ||               // iOS Safari PWA
		window.matchMedia('(display-mode: standalone)').matches;       // Estándar

	// Variable para almacenar el tipo de dispositivo detectado
	let type: DeviceType;

	// Detecta tipo de dispositivo usando el User Agent
	if (/Tablet|iPad/i.test(ua)) {
		type = 'tablet';
	} else if (/Mobi|Android/i.test(ua)) {
		type = 'mobile';
	} else {
		// Si el User Agent no es concluyente, se determina por el ancho de pantalla
		const width = window.innerWidth;
		if (width <= 767) {
			type = 'mobile';
		} else if (width <= 1024) {
			type = 'tablet';
		} else {
			type = 'desktop';
		}
	}

	// Detecta la orientación de la pantalla
	const orientation: Orientation =
		window.matchMedia('(orientation: landscape)').matches
			? 'landscape'
			: 'portrait';

	// Detecta el esquema de color preferido
	const colorScheme: ColorScheme =
		window.matchMedia('(prefers-color-scheme: dark)').matches
			? 'dark'
			: 'light';

	// Retorna la información del dispositivo
	return {
		type,
		isTouch,
		isStandalone,
		platform,
		orientation,
		colorScheme,
	};
}
