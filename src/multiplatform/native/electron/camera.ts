// Importa tipos y clases de error relacionados con el manejo de la cámara
import type { CameraOptions, ActiveCamera } from '@core/client/camera';
import {
	CameraNotSupportedError,   // Error lanzado si el dispositivo no soporta la API de cámara
	CameraAccessDeniedError,   // Error lanzado si el usuario deniega el permiso para usar la cámara
	NoVideoTrackFoundError,    // Error lanzado si no se encuentra un track de video en el stream
} from '@core/client/camera';

/**
 * Función asíncrona para inicializar y obtener acceso a la cámara del dispositivo.
 * 
 * @param options - Objeto opcional con configuraciones de la cámara (resolución, FPS, modo de cámara, audio, etc.).
 * @returns Una promesa que resuelve con un objeto `ActiveCamera` que contiene:
 *          - stream: El flujo de medios activo (video y opcionalmente audio)
 *          - videoTrack: La pista de video obtenida
 *          - destroy: Función para detener todas las pistas del stream
 * 
 * @throws CameraNotSupportedError - Si el navegador/dispositivo no soporta `navigator.mediaDevices.getUserMedia`
 * @throws CameraAccessDeniedError - Si el usuario bloquea o deniega el permiso de acceso a la cámara
 * @throws NoVideoTrackFoundError  - Si no se obtiene ninguna pista de video en el stream
 */
export async function useCamera(
	options: CameraOptions = {}, // Opciones de configuración con valores por defecto
): Promise<ActiveCamera> {

	// 1. Verificación de compatibilidad: Comprueba si el navegador soporta la API de captura de medios
	if (!navigator.mediaDevices?.getUserMedia) {
		throw new CameraNotSupportedError();
	}

	// 2. Construcción de las restricciones (constraints) para la cámara
	const constraints: MediaStreamConstraints = {
		video: {
			// Modo de cámara: 'user' para frontal o 'environment' para trasera
			facingMode: options.facingMode ?? 'user',
			width: options.width,         // Ancho del video
			height: options.height,       // Alto del video
			frameRate: options.frameRate, // FPS deseados
		},
		audio: options.audio ?? false,     // Captura de audio opcional
	};

	let stream: MediaStream;
	try {
		// 3. Solicita permisos y obtiene el stream de medios con las restricciones indicadas
		stream = await navigator.mediaDevices.getUserMedia(constraints);
	} catch (err) {
		// Si hay error (ej. permisos denegados), se lanza un error específico
		throw new CameraAccessDeniedError((err as Error)?.message);
	}

	// 4. Obtiene la primera pista de video del stream
	const videoTrack = stream.getVideoTracks()[0];
	if (!videoTrack) {
		// Si no hay pista de video, detiene todas las pistas y lanza error
		stream.getTracks().forEach((t) => t.stop());
		throw new NoVideoTrackFoundError();
	}

	// 5. Retorna un objeto con el stream, la pista de video y un método para detener la cámara
	return {
		stream,
		videoTrack,
		// Función para detener todas las pistas del stream (libera la cámara y el micrófono)
		destroy: () => stream.getTracks().forEach((t) => t.stop()),
	};
}
