import { detectDevice, type DeviceInfo } from '@data/detect-device';
import { signal } from '@core/index';

/**
 * `deviceSignal` — Señal reactiva que almacena la información actual del dispositivo.
 * 
 * Se inicializa llamando inmediatamente a `detectDevice()` para obtener la
 * información inicial (tipo de dispositivo, sistema operativo, orientación, etc.).
 * 
 * Usamos un `signal` para que cualquier parte de la aplicación pueda suscribirse
 * y reaccionar automáticamente cuando cambien las características del dispositivo.
 */
const deviceSignal = signal<DeviceInfo>(detectDevice());

/** Bandera para asegurar que los listeners de cambio solo se configuren una vez. */
let initialized = false;

/**
 * Inicia los listeners que detectan cambios en la configuración del dispositivo.
 * 
 * Se ejecuta solo una vez para evitar múltiples registros de eventos.
 * 
 * Eventos que escucha:
 * - **Cambio de orientación** (`orientation: portrait` → portrait/landscape)
 * - **Cambio de tema del sistema** (`prefers-color-scheme: dark`)
 * - **Cambio de tamaño de ventana** (`resize`) — puede implicar cambio de viewport o breakpoint.
 */
function startListeners() {
	// Evita inicializar más de una vez
	if (initialized) return;
	initialized = true;

	/**
	 * Función para volver a detectar el dispositivo y actualizar la señal.
	 */
	const update = () => deviceSignal.set(detectDevice());

	// Detecta cambios en la orientación de pantalla (portrait/landscape)
	window.matchMedia('(orientation: portrait)').addEventListener('change', update);

	// Detecta cambios en el esquema de color preferido del usuario (dark/light mode)
	window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', update);

	// Detecta cambios de tamaño de ventana (útil en desktop o navegadores móviles con resize)
	window.addEventListener('resize', update);
}

/**
 * Hook/reactivo `useDeviceInfo`
 * 
 * Retorna una señal reactiva con la información del dispositivo.
 * 
 * - Inicializa los listeners en la primera llamada.
 * - Permite a cualquier parte de la app observar y reaccionar a cambios
 *   en orientación, tema del sistema o tamaño de ventana.
 * 
 * @returns Signal con `DeviceInfo` que se actualiza automáticamente.
 */
export function useDeviceInfo() {
	startListeners(); // Asegura que los eventos estén activos
	return deviceSignal; // Devuelve la señal para su uso reactivo
}
