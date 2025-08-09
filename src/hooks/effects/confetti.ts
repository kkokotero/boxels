import type { Hook } from '@hooks/hook';

/**
 * Opciones configurables para el sistema de confetti
 */
export interface ConfettiOptions {
	gravity?: number; // gravedad en píxeles por segundo al cuadrado
	count?: number; // cantidad de partículas por ráfaga
	particleSize?: number; // factor de escala del tamaño de cada partícula
	power?: number; // velocidad inicial máxima de las partículas
	destroyTarget?: boolean; // si deshabilitar visualmente el elemento al hacer clic
	fade?: boolean; // si las partículas deben desvanecerse gradualmente
	zIndex?: number | string; // z-index del canvas
	pointerEvents?: 'none' | 'auto'; // control de eventos del canvas
}

// Valores por defecto para las opciones
const DEFAULTS: Required<ConfettiOptions> = {
	gravity: 1200,
	count: 75,
	particleSize: 1,
	power: 350,
	destroyTarget: false,
	fade: false,
	zIndex: 999999999,
	pointerEvents: 'none',
};

/**
 * Representa un vector 2D, útil para posiciones y velocidades.
 */
class Vec2 {
	constructor(public x = 0, public y = 0) {}

	add(v: Vec2): this {
		this.x += v.x;
		this.y += v.y;
		return this;
	}

	clone(): Vec2 {
		return new Vec2(this.x, this.y);
	}
}

/**
 * Canvas compartido para dibujar todas las partículas en una sola capa.
 * Se asegura de que solo exista una instancia.
 */
class SharedCanvas {
	private static canvas: HTMLCanvasElement | null = null;
	private static ctx: CanvasRenderingContext2D | null = null;
	private static dpr = 1;

	/**
	 * Crea e inserta el canvas si aún no existe.
	 */
	static ensure(zIndex: number | string, pointerEvents: string): void {
		if (this.canvas && this.ctx) return;

		this.canvas = document.createElement('canvas');
		this.ctx = this.canvas.getContext('2d');
		if (!this.ctx) throw new Error('No se pudo obtener el contexto 2D');

		this.dpr = window.devicePixelRatio || 1;

		Object.assign(this.canvas.style, {
			position: 'fixed',
			inset: '0',
			width: '100%',
			height: '100%',
			margin: '0',
			padding: '0',
			zIndex: String(zIndex),
			pointerEvents,
		});

		document.body.appendChild(this.canvas);

		// Redimensiona el canvas al tamaño de la ventana
		const resize = () => {
			if (!this.canvas || !this.ctx) return;
			this.canvas.width = Math.round(window.innerWidth * this.dpr);
			this.canvas.height = Math.round(window.innerHeight * this.dpr);
			this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
		};

		window.addEventListener('resize', resize, { passive: true });
		resize();
	}

	static clear(): void {
		this.ctx?.clearRect(0, 0, window.innerWidth, window.innerHeight);
	}

	static get context(): CanvasRenderingContext2D | null {
		return this.ctx;
	}
}

/**
 * Utilidades para generar números aleatorios.
 */
const Random = {
	float(min = 0, max = 1): number {
		return Math.random() * (max - min) + min;
	},
	int(min: number, max: number): number {
		return Math.floor(this.float(min, max + 1));
	},
	choice<T>(arr: T[]): T {
		return arr[this.int(0, arr.length - 1)];
	},
};

/**
 * Genera una velocidad inicial aleatoria para una partícula.
 */
function randomVelocity(power: number): Vec2 {
	const angle = Random.float(0, Math.PI * 2);
	const speed = Random.float(0.25 * power, power);
	return new Vec2(
		Math.cos(angle) * speed,
		Math.sin(angle) * speed * 0.9 - 0.2 * power,
	);
}

/**
 * Representa una partícula individual de confetti.
 */
class ConfettiParticle {
	private size: Vec2;
	private pos: Vec2;
	private vel: Vec2;
	private rotation: number;
	private rotationSpeed: number;
	private hue: number;
	private alpha: number;
	private lifetime: number;

	constructor(origin: Vec2, private opts: Required<ConfettiOptions>) {
		const width = (16 * Math.random() + 4) * opts.particleSize;
		const height = (4 * Math.random() + 4) * opts.particleSize;

		this.size = new Vec2(width, height);
		this.pos = origin.clone().add(new Vec2(-width / 2, -height / 2));
		this.vel = randomVelocity(opts.power);
		this.rotation = Random.float(0, 360);
		this.rotationSpeed = Random.float(-180, 180);
		this.hue = Random.float(0, 360);
		this.alpha = 1;
		this.lifetime = Random.float(0.6, 1.6);
	}

	/**
	 * Actualiza la posición y estado de la partícula.
	 */
	update(dt: number): void {
		const g = this.opts.gravity * (this.size.y / (10 * this.opts.particleSize));
		this.vel.y += g * dt;
		this.vel.x += 50 * (Math.random() - 0.5) * dt;
		this.vel.x *= 0.995;
		this.vel.y *= 0.995;

		this.pos.add(new Vec2(this.vel.x * dt, this.vel.y * dt));
		this.rotation += this.rotationSpeed * dt;

		if (this.opts.fade) {
			this.alpha = Math.max(0, this.alpha - dt / this.lifetime);
		}
	}

	/**
	 * Determina si la partícula está fuera de la pantalla.
	 */
	isOffscreen(): boolean {
		return this.pos.y - 4 * this.size.y > window.innerHeight + 200;
	}

	/**
	 * Dibuja la partícula en el canvas.
	 */
	draw(ctx: CanvasRenderingContext2D): void {
		ctx.save();
		ctx.translate(this.pos.x + this.size.x / 2, this.pos.y + this.size.y / 2);
		ctx.rotate((this.rotation * Math.PI) / 180);
		ctx.fillStyle = `hsla(${this.hue}, 90%, 60%, ${this.alpha})`;
		ctx.fillRect(-this.size.x / 2, -this.size.y / 2, this.size.x, this.size.y);
		ctx.restore();
	}
}

/**
 * Agrupa una ráfaga de partículas que se disparan juntas.
 */
class Burst {
	private particles: ConfettiParticle[];

	constructor(origin: Vec2, count: number, opts: Required<ConfettiOptions>) {
		this.particles = Array.from(
			{ length: count },
			() => new ConfettiParticle(origin.clone(), opts),
		);
	}

	update(dt: number): void {
		for (let i = this.particles.length - 1; i >= 0; i--) {
			this.particles[i].update(dt);
			if (this.particles[i].isOffscreen()) {
				this.particles.splice(i, 1);
			}
		}
	}

	draw(ctx: CanvasRenderingContext2D): void {
		this.particles.forEach((p) => p.draw(ctx));
	}

	get isEmpty(): boolean {
		return this.particles.length === 0;
	}
}

/**
 * Clase principal que maneja la lógica del sistema de confetti.
 * Permite configurar, activar, detener y limpiar efectos de confetti.
 */
export class Confetti implements Hook {
	private options: Required<ConfettiOptions>;
	private bursts: Burst[] = [];
	private targets = new Set<HTMLElement>();
	private running = true;
	private lastTime = 0;
	private rafId: number | null = null;

	private originalStyles = new WeakMap<
		HTMLElement,
		{
			opacity?: string | null;
			transform?: string | null;
			transition?: string | null;
			pointerEvents?: string | null;
			ariaDisabled?: string | null;
		}
	>();

	constructor(initialOptions?: ConfettiOptions) {
		this.options = { ...DEFAULTS, ...initialOptions };
		SharedCanvas.ensure(this.options.zIndex, this.options.pointerEvents);
		this.lastTime = performance.now();
		this.rafId = requestAnimationFrame(this.loop.bind(this));
	}

	/**
	 * Adjunta el efecto de confetti a un elemento del DOM.
	 */
	attach(elementOrId: HTMLElement | string): this {
		const el =
			typeof elementOrId === 'string'
				? document.getElementById(elementOrId)
				: elementOrId;

		if (!el) throw new Error('Elemento no encontrado');
		if (this.targets.has(el)) return this;

		this.originalStyles.set(el, {
			opacity: el.style.opacity ?? null,
			transform: el.style.transform ?? null,
			transition: el.style.transition ?? null,
			pointerEvents: el.style.pointerEvents ?? null,
			ariaDisabled: el.getAttribute('aria-disabled'),
		});

		const handler = (ev: MouseEvent) => {
			this.triggerAt(new Vec2(ev.clientX, ev.clientY));

			if (this.options.destroyTarget) {
				const target = el as HTMLElement;
				target.setAttribute('aria-disabled', 'true');
				target.style.pointerEvents = 'none';
				target.style.transition =
					target.style.transition || 'opacity .18s ease, transform .18s ease';
				target.style.opacity = '0.6';
				target.style.transform = 'scale(0.99)';
			}
		};

		(el as any).__confetti_handler = handler;
		el.addEventListener('click', handler);
		this.targets.add(el);
		return this;
	}

	/**
	 * Desvincula el efecto de un elemento y restaura estilos originales.
	 */
	detach(elementOrId: HTMLElement | string): this {
		const el =
			typeof elementOrId === 'string'
				? document.getElementById(elementOrId)
				: elementOrId;

		if (!el || !this.targets.has(el)) return this;

		const handler = (el as any).__confetti_handler;
		if (handler) el.removeEventListener('click', handler);

		const saved = this.originalStyles.get(el);
		if (saved) {
			const target = el as HTMLElement;

			if (saved.ariaDisabled == null) {
				target.removeAttribute('aria-disabled');
			} else {
				target.setAttribute('aria-disabled', saved.ariaDisabled);
			}

			if (saved.opacity == null) target.style.removeProperty('opacity');
			else target.style.opacity = saved.opacity;

			if (saved.transform == null) target.style.removeProperty('transform');
			else target.style.transform = saved.transform;

			if (saved.transition == null) target.style.removeProperty('transition');
			else target.style.transition = saved.transition;

			if (saved.pointerEvents == null)
				target.style.removeProperty('pointer-events');
			else target.style.pointerEvents = saved.pointerEvents;

			this.originalStyles.delete(el);
		}

		this.targets.delete(el);
		return this;
	}

	/**
	 * Dispara una ráfaga en el centro de la pantalla.
	 */
	trigger(): this {
		return this.triggerAt(
			new Vec2(window.innerWidth / 2, window.innerHeight / 2),
		);
	}

	/**
	 * Dispara una ráfaga de partículas en una posición específica.
	 */
	triggerAt(origin: Vec2): this {
		this.bursts.push(new Burst(origin, this.options.count, this.options));
		return this;
	}

	/**
	 * Actualiza las opciones actuales del sistema.
	 */
	setOptions(partial: ConfettiOptions): this {
		this.options = { ...this.options, ...partial };
		return this;
	}

	/**
	 * Devuelve las opciones actuales aplicadas.
	 */
	getOptions(): Required<ConfettiOptions> {
		return { ...this.options };
	}

	/**
	 * Detiene el ciclo de animación.
	 */
	stop(): this {
		this.running = false;
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
		return this;
	}

	/**
	 * Reanuda el ciclo de animación si está detenido.
	 */
	resume(): this {
		if (!this.running) {
			this.running = true;
			this.lastTime = performance.now();
			this.rafId = requestAnimationFrame(this.loop.bind(this));
		}
		return this;
	}

	/**
	 * Limpia todos los recursos y desactiva el efecto.
	 */
	destroy(): this {
		for (const el of this.targets) {
			const handler = (el as any).__confetti_handler;
			if (handler) el.removeEventListener('click', handler);
			delete (el as any).__confetti_handler;

			const saved = this.originalStyles.get(el);
			if (saved) {
				const target = el as HTMLElement;

				if (saved.ariaDisabled == null) {
					target.removeAttribute('aria-disabled');
				} else {
					target.setAttribute('aria-disabled', saved.ariaDisabled);
				}

				if (saved.opacity == null) target.style.removeProperty('opacity');
				else target.style.opacity = saved.opacity;

				if (saved.transform == null) target.style.removeProperty('transform');
				else target.style.transform = saved.transform;

				if (saved.transition == null) target.style.removeProperty('transition');
				else target.style.transition = saved.transition;

				if (saved.pointerEvents == null)
					target.style.removeProperty('pointer-events');
				else target.style.pointerEvents = saved.pointerEvents;

				this.originalStyles.delete(el);
			}
		}
		this.targets.clear();
		this.bursts = [];
		return this.stop();
	}

	/**
	 * Ciclo de animación principal. Actualiza y dibuja las partículas activas.
	 */
	private loop(time: number): void {
		const dt = Math.min(0.05, (time - this.lastTime) / 1000);
		this.lastTime = time;

		this.bursts = this.bursts.filter((b) => {
			b.update(dt);
			return !b.isEmpty;
		});

		SharedCanvas.clear();
		const ctx = SharedCanvas.context;
		if (ctx) this.bursts.forEach((b) => b.draw(ctx));

		if (this.running) {
			this.rafId = requestAnimationFrame(this.loop.bind(this));
		}
	}
}

/**
 * Hook o factory para crear una instancia de confetti.
 */
export function useConfetti(initialOptions?: ConfettiOptions): Confetti {
	return new Confetti(initialOptions);
}
