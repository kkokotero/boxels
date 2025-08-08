// Tipos y errores

export type CameraFacingMode = 'user' | 'environment';

export interface CameraOptions {
	facingMode?: CameraFacingMode;
	width?: number;
	height?: number;
	frameRate?: number;
	audio?: boolean;
}

export interface ActiveCamera {
	stream: MediaStream;
	videoTrack: MediaStreamTrack;
	destroy: () => void;
}

export class CameraNotSupportedError extends Error {
	constructor() {
		super('La API de cámara no está soportada en este navegador.');
		this.name = 'CameraNotSupportedError';
	}
}

export class CameraAccessDeniedError extends Error {
	constructor(message?: string) {
		super(message ?? 'Permiso denegado para acceder a la cámara.');
		this.name = 'CameraAccessDeniedError';
	}
}

export class NoVideoTrackFoundError extends Error {
	constructor() {
		super('No se encontró una pista de video válida en el stream.');
		this.name = 'NoVideoTrackFoundError';
	}
}

// Función principal

export async function useCamera(options: CameraOptions = {}): Promise<ActiveCamera> {
	if (!navigator.mediaDevices?.getUserMedia) {
		throw new CameraNotSupportedError();
	}

	const constraints: MediaStreamConstraints = {
		video: {
			facingMode: options.facingMode ?? 'user',
			width: options.width,
			height: options.height,
			frameRate: options.frameRate,
		},
		audio: options.audio ?? false,
	};

	let stream: MediaStream;
	try {
		stream = await navigator.mediaDevices.getUserMedia(constraints);
	} catch (err) {
		throw new CameraAccessDeniedError((err as Error)?.message);
	}

	const videoTrack = stream.getVideoTracks()[0];
	if (!videoTrack) {
		stream.getTracks().forEach((t) => t.stop());
		throw new NoVideoTrackFoundError();
	}

	return {
		stream,
		videoTrack,
		destroy: () => stream.getTracks().forEach((t) => t.stop()),
	};
}
