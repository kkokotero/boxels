/**
 * Opciones configurables para inicializar el micrófono.
 */
export interface MicrophoneOptions {
	/** ID específico del dispositivo de micrófono (opcional, útil si hay varios). */
	deviceId?: string;
	/** Frecuencia de muestreo deseada en Hz (por ejemplo, 44100 para CD Audio). */
	sampleRate?: number;
	/** Número de canales de audio (1 = mono, 2 = estéreo, etc.). */
	channelCount?: number;
	/** Habilita la cancelación de eco para evitar retroalimentación. */
	echoCancellation?: boolean;
	/** Reduce el ruido de fondo automáticamente. */
	noiseSuppression?: boolean;
	/** Ajusta automáticamente el volumen de entrada. */
	autoGainControl?: boolean;
}

/**
 * Representa un micrófono activo y sus recursos asociados.
 */
export interface ActiveMicrophone {
	/** Flujo multimedia activo que contiene la pista de audio. */
	stream: MediaStream;
	/** Pista de audio principal obtenida del flujo. */
	audioTrack: MediaStreamTrack;
	/** Función para detener y liberar todos los recursos del micrófono. */
	destroy: () => void;
}

/**
 * Error lanzado cuando la API de micrófono no está disponible
 * en el navegador.
 */
export class MicrophoneNotSupportedError extends Error {
	constructor() {
		super('La API de micrófono no está soportada en este navegador.');
		this.name = 'MicrophoneNotSupportedError';
	}
}

/**
 * Error lanzado cuando el usuario deniega el permiso de acceso
 * al micrófono o hay un fallo al obtener el flujo de audio.
 */
export class MicrophoneAccessDeniedError extends Error {
	constructor(message?: string) {
		super(message ?? 'Permiso denegado para acceder al micrófono.');
		this.name = 'MicrophoneAccessDeniedError';
	}
}

/**
 * Error lanzado cuando, a pesar de obtener un flujo multimedia,
 * no se encuentra una pista de audio válida.
 */
export class NoAudioTrackFoundError extends Error {
	constructor() {
		super('No se encontró una pista de audio válida en el stream.');
		this.name = 'NoAudioTrackFoundError';
	}
}

/**
 * Función principal para inicializar el micrófono del usuario.
 *
 * @param options - Configuración opcional del micrófono.
 * @returns Un objeto `ActiveMicrophone` con el stream activo,
 *          la pista de audio y un método para destruirlo.
 *
 * @throws MicrophoneNotSupportedError Si el navegador no soporta `getUserMedia`.
 * @throws MicrophoneAccessDeniedError Si el usuario deniega el permiso o hay un error de acceso.
 * @throws NoAudioTrackFoundError      Si no se encuentra ninguna pista de audio en el stream.
 */
export async function useMicrophone(options: MicrophoneOptions = {}): Promise<ActiveMicrophone> {
	// Verificar si la API de captura de medios está disponible.
	if (!navigator.mediaDevices?.getUserMedia) {
		throw new MicrophoneNotSupportedError();
	}

	// Construir las restricciones de captura de audio según las opciones recibidas.
	const constraints: MediaStreamConstraints = {
		video: false, // No se captura video, solo audio.
		audio: {
			deviceId: options.deviceId,
			sampleRate: options.sampleRate,
			channelCount: options.channelCount,
			echoCancellation: options.echoCancellation,
			noiseSuppression: options.noiseSuppression,
			autoGainControl: options.autoGainControl,
		},
	};

	let stream: MediaStream;
	try {
		// Solicitar acceso al micrófono.
		stream = await navigator.mediaDevices.getUserMedia(constraints);
	} catch (err) {
		// Si el usuario deniega el permiso explícitamente.
		if (err instanceof DOMException && err.name === 'NotAllowedError') {
			throw new MicrophoneAccessDeniedError();
		}
		// Otros errores de acceso.
		throw new MicrophoneAccessDeniedError((err as Error)?.message);
	}

	// Obtener la primera pista de audio del flujo.
	const audioTrack = stream.getAudioTracks()[0];
	if (!audioTrack) {
		// Si no hay pista de audio, detener todas las pistas y lanzar error.
		stream.getTracks().forEach((t) => t.stop());
		throw new NoAudioTrackFoundError();
	}

	// Devolver un objeto con el control del micrófono activo.
	return {
		stream,
		audioTrack,
		// Función para detener todas las pistas y liberar recursos.
		destroy: () => stream.getTracks().forEach((t) => t.stop()),
	};
}
