// Tipo que define la orientación de la cámara:
//  - 'user': cámara frontal (selfie).
//  - 'environment': cámara trasera (entorno).
export type CameraFacingMode = 'user' | 'environment';

/**
 * Opciones configurables para inicializar la cámara.
 */
export interface CameraOptions {
	/** Orientación de la cámara (frontal o trasera). */
	facingMode?: CameraFacingMode;
	/** Ancho deseado de la imagen del video (en píxeles). */
	width?: number;
	/** Altura deseada de la imagen del video (en píxeles). */
	height?: number;
	/** Tasa de fotogramas por segundo (FPS) deseada. */
	frameRate?: number;
	/** Si se debe capturar también el audio. */
	audio?: boolean;
}

/**
 * Representa una cámara activa y sus recursos asociados.
 */
export interface ActiveCamera {
	/** Flujo multimedia activo que contiene pistas de video (y opcionalmente audio). */
	stream: MediaStream;
	/** Pista de video principal obtenida del flujo. */
	videoTrack: MediaStreamTrack;
	/** Función para detener y liberar todos los recursos de la cámara. */
	destroy: () => void;
}

/**
 * Error lanzado cuando la API de cámara no está disponible en el navegador.
 */
export class CameraNotSupportedError extends Error {
	constructor() {
		super('La API de cámara no está soportada en este navegador.');
		this.name = 'CameraNotSupportedError';
	}
}

/**
 * Error lanzado cuando el usuario deniega el permiso de acceso a la cámara
 * o cuando ocurre un problema al intentar obtener el flujo de video.
 */
export class CameraAccessDeniedError extends Error {
	constructor(message?: string) {
		super(message ?? 'Permiso denegado para acceder a la cámara.');
		this.name = 'CameraAccessDeniedError';
	}
}

/**
 * Error lanzado cuando, a pesar de obtener un flujo multimedia,
 * no se encuentra una pista de video válida.
 */
export class NoVideoTrackFoundError extends Error {
	constructor() {
		super('No se encontró una pista de video válida en el stream.');
		this.name = 'NoVideoTrackFoundError';
	}
}

/**
 * Función principal para inicializar la cámara del usuario.
 *
 * @param options - Configuración opcional de la cámara.
 * @returns Un objeto `ActiveCamera` que contiene el stream activo,
 *          la pista de video y un método para destruirlo.
 *
 * @throws CameraNotSupportedError Si el navegador no soporta `getUserMedia`.
 * @throws CameraAccessDeniedError Si el usuario deniega el permiso o hay un error de acceso.
 * @throws NoVideoTrackFoundError  Si no se encuentra ninguna pista de video en el stream.
 */
export async function useCamera(options: CameraOptions = {}): Promise<ActiveCamera> {
	// Verificar si la API de captura de medios está disponible.
	if (!navigator.mediaDevices?.getUserMedia) {
		throw new CameraNotSupportedError();
	}

	// Construir las restricciones de captura según las opciones recibidas.
	const constraints: MediaStreamConstraints = {
		video: {
			facingMode: options.facingMode ?? 'user', // Por defecto, cámara frontal.
			width: options.width,
			height: options.height,
			frameRate: options.frameRate,
		},
		audio: options.audio ?? false, // Por defecto, no se captura audio.
	};

	let stream: MediaStream;
	try {
		// Solicitar acceso a la cámara (y opcionalmente al micrófono).
		stream = await navigator.mediaDevices.getUserMedia(constraints);
	} catch (err) {
		// Si el usuario deniega el permiso o ocurre otro error.
		throw new CameraAccessDeniedError((err as Error)?.message);
	}

	// Obtener la primera pista de video del flujo.
	const videoTrack = stream.getVideoTracks()[0];
	if (!videoTrack) {
		// Si no hay pista de video, detener todas las pistas y lanzar error.
		stream.getTracks().forEach((t) => t.stop());
		throw new NoVideoTrackFoundError();
	}

	// Devolver un objeto que contiene la información y control de la cámara.
	return {
		stream,
		videoTrack,
		// Función para detener todas las pistas y liberar recursos.
		destroy: () => stream.getTracks().forEach((t) => t.stop()),
	};
}
