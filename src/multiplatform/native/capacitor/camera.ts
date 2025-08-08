import { CameraPreview } from '@capacitor-community/camera-preview';
import type { CameraOptions, ActiveCamera } from '@core/client/camera';

export async function useCamera(
	options: CameraOptions = {},
): Promise<ActiveCamera> {
	await CameraPreview.start({
		position: options.facingMode === 'environment' ? 'rear' : 'front',
		width: options.width,
		height: options.height,
		enableZoom: false,
		toBack: false,
	});

	const stream = new MediaStream(); // Opcional si se necesita un objeto MediaStream

	return {
		stream,
		videoTrack: {} as MediaStreamTrack, // No se puede obtener un track real desde CameraPreview
		destroy: () => CameraPreview.stop(),
	};
}
