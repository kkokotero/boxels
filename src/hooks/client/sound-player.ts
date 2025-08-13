import type { Hook } from '@hooks/hook';

/**
 * Interfaz para definir los eventos que puede manejar un sonido.
 * Cada propiedad es opcional y permite reaccionar ante eventos del audio.
 */
type SoundEvents = Partial<{
	onPlay: () => void; // Se dispara cuando el audio empieza a reproducirse
	onPause: () => void; // Se dispara cuando el audio es pausado
	onEnd: () => void; // Se dispara cuando el audio termina
	onError: (e: Event | string) => void; // Se dispara si ocurre un error
	onLoad: () => void; // Se dispara cuando el audio ha sido cargado completamente
}>;

/**
 * Clase `Sound`: sistema de manejo de audio mejorado con:
 * - Reproducción, pausa, silencio y volumen
 * - Posicionamiento 3D y dirección (sonido espacial)
 * - Eventos personalizados
 * - Control de tiempo, duración y fade in/out
 * - Caché de instancias de audio para eficiencia
 *
 * Implementa la interfaz `Hook` para integrarse con sistemas que usen hooks.
 */
export class Sound implements Hook {
	// Caché global de audios para evitar recargar recursos repetidamente
	private static cache = new Map<string, HTMLAudioElement>();

	// Contexto de audio compartido por todas las instancias
	private static ctx = new AudioContext();

	private audio: HTMLAudioElement; // Elemento de audio HTML
	private sourceNode: MediaElementAudioSourceNode; // Nodo fuente del audio
	private panner = Sound.ctx.createPanner(); // Nodo para sonido 3D
	private isMuted = false; // Estado de silencio
	private events: SoundEvents = {}; // Manejadores de eventos

	/**
	 * Crea una nueva instancia de sonido, usando caché si ya se había cargado el recurso.
	 * @param src Ruta del archivo de audio
	 * @param events Opcional, eventos personalizados a manejar
	 */
	constructor(src: string, events?: SoundEvents) {
		this.events = events ?? {};

		// Si ya existe en caché, se clona el nodo de audio
		if (Sound.cache.has(src)) {
			this.audio = Sound.cache.get(src)!.cloneNode(true) as HTMLAudioElement;
		} else {
			this.audio = new Audio(src);
			this.audio.preload = 'auto'; // Pre-carga el audio para mayor velocidad
			Sound.cache.set(src, this.audio); // Se almacena en caché
		}

		// Se conecta el audio al sistema Web Audio API
		this.sourceNode = Sound.ctx.createMediaElementSource(this.audio);
		this.sourceNode.connect(this.panner).connect(Sound.ctx.destination);

		this.setupEvents(); // Configura los eventos
	}

	/**
	 * Asocia los eventos del objeto `HTMLAudioElement` con los definidos por el usuario.
	 */
	private setupEvents() {
		this.audio.onplay = () => this.events.onPlay?.();
		this.audio.onpause = () => this.events.onPause?.();
		this.audio.onended = () => this.events.onEnd?.();
		this.audio.onerror = (e) => this.events.onError?.(e);
		this.audio.onloadeddata = () => this.events.onLoad?.();
	}

	// === Controles básicos de reproducción ===

	/** Reproduce el sonido desde el principio, con opción de loop */
	play(loop = false): this {
		this.audio.loop = loop;
		Sound.ctx.resume(); // Asegura que el contexto esté activo
		this.audio.currentTime = 0;
		this.audio.play().catch(console.warn);
		return this;
	}

	/** Pausa el sonido sin reiniciar el tiempo */
	pause(): this {
		this.audio.pause();
		return this;
	}

	/** Pausa y reinicia el tiempo a 0 */
	stop(): this {
		this.audio.pause();
		this.audio.currentTime = 0;
		return this;
	}

	/** Reproduce el audio solo si está pausado */
	playIfPaused(loop = false): this {
		if (this.audio.paused) this.play(loop);
		return this;
	}

	/** Retorna si el audio está reproduciéndose en este momento */
	isPlaying(): boolean {
		return !this.audio.paused && !this.audio.ended;
	}

	// === Control de volumen y silencio ===

	/**
	 * Establece el volumen del audio entre 0 y 1
	 * @param v Valor del volumen
	 */
	vol(v: number): this {
		this.audio.volume = Math.max(0, Math.min(1, v));
		return this;
	}

	/** Obtiene el volumen actual del audio */
	getVol(): number {
		return this.audio.volume;
	}

	/** Silencia el audio */
	mute(): this {
		this.isMuted = true;
		this.audio.muted = true;
		return this;
	}

	/** Quita el silencio del audio */
	unmute(): this {
		this.isMuted = false;
		this.audio.muted = false;
		return this;
	}

	/** Alterna entre silencio y no silencio */
	toggleMute(): this {
		return this.isMuted ? this.unmute() : this.mute();
	}

	// === Control de tiempo ===

	/**
	 * Getter/setter del tiempo de reproducción actual
	 * @param t Si se proporciona, se establece ese tiempo
	 */
	time(t?: number): number | this {
		if (typeof t === 'number') {
			this.audio.currentTime = t;
			return this;
		}
		return this.audio.currentTime;
	}

	/** Duración total del audio en segundos */
	duration(): number {
		return this.audio.duration;
	}

	// === Efectos de entrada/salida (fade) ===

	/**
	 * Realiza un fade in (subida progresiva del volumen)
	 * @param ms Duración en milisegundos
	 */
	fadeIn(ms = 1000): this {
		this.audio.volume = 0;
		this.play();
		const step = 50;
		let v = 0;
		const i = setInterval(() => {
			v += step / ms;
			this.vol(Math.min(v, 1));
			if (v >= 1) clearInterval(i);
		}, step);
		return this;
	}

	/**
	 * Realiza un fade out (bajada progresiva del volumen y luego detiene)
	 * @param ms Duración en milisegundos
	 */
	fadeOut(ms = 1000): this {
		const step = 50;
		let v = this.audio.volume;
		const i = setInterval(() => {
			v -= step / ms;
			this.vol(Math.max(v, 0));
			if (v <= 0) {
				this.stop();
				clearInterval(i);
			}
		}, step);
		return this;
	}

	// === Fuente del audio ===

	/**
	 * Getter/setter del recurso de audio
	 * @param url Si se proporciona, se actualiza el recurso
	 */
	src(url?: string): string | this {
		if (url) {
			this.audio.src = url;
			this.audio.load();
			return this;
		}
		return this.audio.src;
	}

	/** Activa o desactiva el modo loop (repetición) */
	loop(v: boolean): this {
		this.audio.loop = v;
		return this;
	}

	// === Posicionamiento 3D del sonido ===

	/**
	 * Establece la posición del sonido en el espacio 3D
	 */
	pos(x: number, y: number, z: number): this {
		this.panner.positionX.value = x;
		this.panner.positionY.value = y;
		this.panner.positionZ.value = z;
		return this;
	}

	/**
	 * Establece la dirección hacia la que se orienta el sonido
	 */
	dir(x: number, y: number, z: number): this {
		this.panner.orientationX.value = x;
		this.panner.orientationY.value = y;
		this.panner.orientationZ.value = z;
		return this;
	}

	/**
	 * Define el rango de audición (distancia mínima y máxima)
	 */
	range(min = 1, max = 1000): this {
		this.panner.refDistance = min;
		this.panner.maxDistance = max;
		return this;
	}

	/**
	 * Define la forma del cono de audición para sonido direccional
	 */
	cone(inner: number, outer: number, outerGain = 0.2): this {
		this.panner.coneInnerAngle = inner;
		this.panner.coneOuterAngle = outer;
		this.panner.coneOuterGain = outerGain;
		return this;
	}

	/**
	 * Asocia el sonido a un elemento del DOM para que su posición 3D
	 * se actualice automáticamente según la posición del elemento.
	 * @param el Elemento HTML a seguir
	 */
	followElement(el: HTMLElement): this {
		if (!el) return this;

		const update = () => {
			const rect = el.getBoundingClientRect();
			// Convertimos la posición de pantalla a coordenadas para el panner
			// Aquí z = 0 por defecto; puedes adaptarlo si necesitas profundidad
			this.pos(rect.left, rect.top, 0);

			// Continuar la actualización mientras el audio exista
			if (document.body.contains(el) && this.isPlaying()) {
				requestAnimationFrame(update);
			}
		};

		requestAnimationFrame(update);
		return this;
	}

	// === Limpieza de recursos ===

	/**
	 * Libera recursos del sonido y desconecta nodos del contexto de audio.
	 * Se debe llamar manualmente si no se usa más la instancia.
	 */
	destroy(): void {
		this.stop();

		// Elimina manejadores de eventos
		this.audio.onplay = null;
		this.audio.onpause = null;
		this.audio.onended = null;
		this.audio.onerror = null;
		this.audio.onloadeddata = null;

		// Desconecta los nodos del grafo de audio
		try {
			this.sourceNode.disconnect();
			this.panner.disconnect();
		} catch (e) {
			console.warn('Error al desconectar nodos:', e);
		}

		// Limpia la fuente de audio
		this.audio.src = '';
		this.audio.load();
		this.events = {};
	}
}

// === Atajo para crear una instancia de sonido fácilmente ===

/**
 * Crea rápidamente una instancia de sonido.
 * @param src Ruta del archivo de audio
 * @param events Eventos personalizados opcionales
 */
export function useSound(src: string, events?: SoundEvents) {
	return new Sound(src, events);
}

// === Función global para limpiar la caché de sonidos ===

/**
 * Limpia completamente la caché de sonidos, liberando los recursos
 * usados por todas las instancias previas en caché.
 */
export function clearSoundCache() {
	for (const audio of Sound['cache'].values()) {
		audio.pause();
		audio.src = '';
		audio.load();
	}
	Sound['cache'].clear();
}
