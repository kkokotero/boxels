import type { CameraOptions, ActiveCamera } from '@core/client/camera';
import {
	CameraNotSupportedError,
	CameraAccessDeniedError,
	NoVideoTrackFoundError,
} from '@core/client/camera';

export async function useCamera(
	options: CameraOptions = {},
): Promise<ActiveCamera> {
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
