import { detectPlatform } from '@multiplatform/platform';

const platform = detectPlatform();

let clientPromise: Promise<typeof import('@multiplatform/native/web/http-client')>;

switch (platform) {
	case 'capacitor':
		clientPromise = import('@multiplatform/native/capacitor/http-client');
		break;
	case 'electron':
		clientPromise = import('@multiplatform/native/electron/http-client');
		break;
	default:
		clientPromise = import('@multiplatform/native/web/http-client');
		break;
}

const client = await clientPromise;

export const httpClient = client.httpClient;
export const http = client.http;

