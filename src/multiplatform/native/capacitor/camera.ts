// Importa el plugin CameraPreview de la comunidad Capacitor para mostrar la cámara nativamente
import { CameraPreview } from '@capacitor-community/camera-preview';
import { autoCleanup } from '@core/cleanup';
// Importa los tipos usados para definir opciones y la interfaz de la cámara activa
import type { CameraOptions, ActiveCamera } from '@core/client/camera';

/**
 * Inicializa y muestra la vista previa de la cámara usando el plugin nativo CameraPreview.
 *
 * @param options - Opciones de configuración de la cámara:
 *    - facingMode: 'environment' para trasera o 'user' para frontal (por defecto)
 *    - width: Ancho deseado de la vista previa
 *    - height: Alto deseado de la vista previa
 *
 * @returns Promise<ActiveCamera> - Objeto con:
 *    - stream: (Opcional) Objeto MediaStream vacío (no hay API para obtener el real desde CameraPreview)
 *    - videoTrack: Objeto MediaStreamTrack vacío (placeholder, ya que el plugin no expone un track real)
 *    - destroy: Función para detener la vista previa de la cámara
 */
export async function useCamera(
	options: CameraOptions = {},
): Promise<ActiveCamera> {
	// 1. Inicia la vista previa de la cámara
	await CameraPreview.start({
		// Selecciona cámara trasera ('rear') o frontal ('front') según facingMode
		position: options.facingMode === 'environment' ? 'rear' : 'front',
		width: options.width, // Ancho de la vista previa
		height: options.height, // Alto de la vista previa
		enableZoom: false, // Desactiva zoom por hardware
		toBack: false, // Muestra la cámara por encima del contenido webview
	});

	// 2. Se crea un MediaStream vacío (no es funcional, solo para cumplir la interfaz ActiveCamera)
	//    El plugin CameraPreview no expone un MediaStream real como getUserMedia en web.
	const stream = new MediaStream();

	// 3. Retorna un objeto que implementa la interfaz ActiveCamera
	const active = {
		stream, // MediaStream vacío como placeholder
		videoTrack: {} as MediaStreamTrack, // Track de video ficticio
		// Método para detener la cámara
		destroy: () => CameraPreview.stop(),
	};

	autoCleanup(active).onCleanup(() => CameraPreview.stop());

	return active;
}
