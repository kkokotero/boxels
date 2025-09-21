// Objeto contenedor del estado (mutable)
export const store = {
	trackedSignals: [] as any[],
	cleanupTimer: null as ReturnType<typeof setTimeout> | null,
	CLEANUP_INTERVAL: 30_000, // cada 30 segundos
};
