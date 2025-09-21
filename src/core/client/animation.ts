import { injectStyle } from '@dom/utils/inject-style';
import { uniqueId } from '@dom/utils/unique-id';

type MaybeElement = string | HTMLElement | null;
type CSSProperties = Partial<CSSStyleDeclaration>;

type Direction = 'up' | 'down' | 'left' | 'right';

interface Step {
	element?: MaybeElement;
	styles: CSSProperties;
	duration?: number;
	easing?: string;
	transition?: string;
}

/** Tipado de eventos */
interface AnimationEvents {
	start: void;
	finish: void;
	enter: { dir: Direction };
	leave: { dir: Direction };
}

type EventName = keyof AnimationEvents;
type EventHandler<E extends EventName> = (payload: AnimationEvents[E]) => void;

function resolveElement(el: MaybeElement): HTMLElement | null {
	if (typeof el === 'string') {
		if (el.startsWith('.') || el.startsWith('#'))
			return document.querySelector<HTMLElement>(el);
		return document.getElementById(el);
	}
	return el;
}

function getDirection(entry: IntersectionObserverEntry): Direction {
	const rect = entry.boundingClientRect;
	const root = entry.rootBounds;
	if (!root) return 'down';
	if (rect.top < root.top) return 'up';
	if (rect.bottom > root.bottom) return 'down';
	if (rect.left < root.left) return 'left';
	if (rect.right > root.right) return 'right';
	return 'down';
}

/** Observador global compartido */
let sharedObserver: IntersectionObserver | null = null;
const observedMap = new WeakMap<
	Element,
	{ enter: Set<EventHandler<'enter'>>; leave: Set<EventHandler<'leave'>> }
>();

function ensureObserver(opts?: IntersectionObserverInit) {
	if (sharedObserver) return sharedObserver;

	sharedObserver = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				const handlers = observedMap.get(entry.target);
				if (!handlers) return;
				const dir = getDirection(entry);
				if (entry.isIntersecting) {
					handlers.enter.forEach((cb) => cb({ dir }));
				} else {
					handlers.leave.forEach((cb) => cb({ dir }));
				}
			});
		},
		{ threshold: 0.1, ...opts },
	);

	return sharedObserver;
}

const stylesId = uniqueId();

export class Animation {
	private source: HTMLElement | null;
	private target: HTMLElement | null;
	private fromSteps: Step[] = [];
	private toSteps: Step[] = [];
	private useViewTransition = true;
	private animationName: string | null = null;

	private initialStyles: Map<
		HTMLElement,
		CSSProperties & { display?: string }
	> = new Map();

	private listeners: {
		[K in EventName]: Set<EventHandler<K>>;
	} = {
		start: new Set(),
		finish: new Set(),
		enter: new Set(),
		leave: new Set(),
	};

	constructor(
		from: MaybeElement,
		to?: MaybeElement,
		opts?: { useViewTransition?: boolean; name?: string },
	) {
		this.source = resolveElement(from);
		this.target = to ? resolveElement(to) : this.source;

		if (!this.target)
			throw new Error(
				'No se pudo resolver el/los elementos para la transición.',
			);

		if (opts?.useViewTransition === false) this.useViewTransition = false;
		if (opts?.name) this.animationName = opts.name;

		// Asignar viewTransitionName si se permite
		if (
			this.useViewTransition &&
			typeof document.startViewTransition === 'function'
		) {
			const name = this.animationName ?? `vt-${crypto.randomUUID()}`;
			if (this.source) this.source.style.viewTransitionName = name;
			this.target.style.viewTransitionName = name;
		}

		injectStyle(
			`
:root {
    view-transition-name: none;
}

::view-transition {
    pointer-events: none;
}
	`,
			stylesId,
		);
	}

	private emit<E extends EventName>(event: E, payload: AnimationEvents[E]) {
		this.listeners[event].forEach((cb) => cb(payload));
	}

	private saveInitialStyles(el: HTMLElement, styles?: CSSProperties) {
		if (!this.initialStyles.has(el)) {
			const saved: CSSProperties & { display?: string } = {
				display: el.style.display,
			};
			if (styles) {
				for (const key of Object.keys(styles)) {
					if (!(key in saved))
						(saved as Record<string, any>)[key] =
							el.style.getPropertyValue(key);
				}
			}
			this.initialStyles.set(el, saved);
		}
	}

	private applyStep(step: Step): Promise<void> {
		return new Promise((resolve) => {
			const el = step.element ? resolveElement(step.element) : this.target;
			if (!el) return resolve();

			if (step.transition) el.style.transition = step.transition;
			else if (step.duration || step.easing)
				el.style.transition = `all ${step.duration ?? 300}ms ${step.easing ?? 'ease'}`;

			this.saveInitialStyles(el, step.styles);
			Object.assign(el.style, step.styles);

			if (step.duration) {
				const handler = () => {
					el.removeEventListener('transitionend', handler);
					resolve();
				};
				el.addEventListener('transitionend', handler, { once: true });
			} else resolve();
		});
	}

	name(name: string) {
		this.animationName = name;
		if (this.useViewTransition && this.target) {
			const n = this.animationName;
			[this.source, this.target].forEach((el) => {
				if (!el) return;
				el.style.viewTransitionName = n;
				el.style.viewTransitionClass = n;
			});
		}
		return this;
	}

	from(styles: CSSProperties, element?: MaybeElement) {
		this.fromSteps.push({ styles, element });
		return this;
	}

	to(
		styles: CSSProperties,
		opts?: {
			duration?: number;
			easing?: string;
			transition?: string;
			element?: MaybeElement;
		},
	) {
		this.toSteps.push({ styles, ...opts });
		return this;
	}

	on<E extends EventName>(event: E, cb: EventHandler<E>) {
		this.listeners[event].add(cb);
		if ((event === 'enter' || event === 'leave') && this.target) {
			if (!observedMap.has(this.target)) {
				observedMap.set(this.target, { enter: new Set(), leave: new Set() });
				ensureObserver().observe(this.target);
			}
			const handlers = observedMap.get(this.target)!;
			(handlers as Record<string, any>)[event].add(cb as any);
		}
		return this;
	}

	off<E extends EventName>(event: E, cb: EventHandler<E>) {
		this.listeners[event].delete(cb);
		if ((event === 'enter' || event === 'leave') && this.target) {
			const handlers = observedMap.get(this.target);
			(handlers as Record<string, any>)[event].delete(cb as any);
		}
		return this;
	}

	async start(cb?: () => void | Promise<void>, { cleanup = true } = {}) {
		this.emit('start', undefined);

		// Aplicar estilos "from" antes de la animación
		for (const step of this.fromSteps) {
			const el = step.element ? resolveElement(step.element) : this.target;
			if (!el) continue;
			this.saveInitialStyles(el, step.styles);
			Object.assign(el.style, step.styles);
		}

		const useVT =
			this.useViewTransition &&
			typeof document.startViewTransition === 'function';

		if (useVT) {
			await document.startViewTransition(() => {
				if (this.target)
					this.target.style.display =
						this.initialStyles.get(this.target)?.display || '';

				// Aplicar "to"
				for (const step of this.toSteps) {
					const el = step.element ? resolveElement(step.element) : this.target;
					if (!el) continue;
					this.saveInitialStyles(el, step.styles);
					Object.assign(el.style, step.styles);
				}

				cb?.();
			}).finished;
		} else {
			for (const step of this.toSteps) await this.applyStep(step);
			cb?.();
		}

		this.emit('finish', undefined);
		if (cleanup) this.restoreStyles();

		if (this.target) {
			this.target.style.viewTransitionName = '';
			this.target.style.viewTransitionClass = '';
		}

		if (this.source) {
			this.source.style.viewTransitionName = '';
			this.source.style.viewTransitionClass = '';
		}
	}

	private restoreStyles() {
		this.initialStyles.forEach((styles, el) => {
			// Restaurar los estilos guardados
			for (const key in styles)
				el.style.setProperty(key, (styles as Record<string, any>)[key]);

			// Limpiar propiedades que agregamos dinámicamente
			el.style.viewTransitionName = '';
			el.style.viewTransitionClass = '';
		});

		this.initialStyles.clear();
	}

	reverse(cb?: () => void | Promise<void>, { cleanup = true } = {}) {
		[this.fromSteps, this.toSteps] = [this.toSteps, this.fromSteps];
		return this.start(cb, { cleanup });
	}
}

/** Factory */
export function createAnimation(
	from: MaybeElement,
	to?: MaybeElement,
	opts?: { useViewTransition?: boolean },
) {
	return new Animation(from, to, opts);
}
