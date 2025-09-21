import { isSignal, type ReactiveSignal } from '@core/reactive';
import { $, type BoxelsElementNode } from '@dom/index';

// Tipos y mapeo de eventos de arrastre (drag & drop)
export type DragEvents = 'start' | 'end' | 'enter' | 'leave' | 'over' | 'drop';

const eventMap: Record<DragEvents, keyof HTMLElementEventMap> = {
	start: 'dragstart',
	end: 'dragend',
	enter: 'dragenter',
	leave: 'dragleave',
	over: 'dragover',
	drop: 'drop',
};

// Eventos sintéticos para touch/pointer
const dndCustomMap = {
	start: 'dndstart',
	end: 'dndend',
	enter: 'dndenter',
	leave: 'dndleave',
	over: 'dndover',
	drop: 'dnddrop',
} as const;

const isTouchLike = () =>
	typeof window !== 'undefined' &&
	('ontouchstart' in window || (navigator && navigator.maxTouchPoints > 0));

// Registro global de elementos draggable
const dragRegistry = (() => {
	const map = new Map<string, Element | BoxelsElementNode<any>>();
	return {
		set(id: string, el: Element | BoxelsElementNode<any>) {
			map.set(id, el);
		},
		get(id?: string | null) {
			if (!id) return null;
			return map.get(id) ?? null;
		},
		delete(id?: string | null) {
			if (!id) return;
			map.delete(id);
		},
		clear() {
			map.clear();
		},
	};
})();

// Info adicional al callback
export type DropIndexInfo = {
	index: number;
	child: Element | null;
	zone: Element;
};

// Resolver índice de drop (ignora draggables internos)
function resolveDropIndex(
	zone: Element,
	clientX: number,
	clientY: number,
): DropIndexInfo {
	const children = Array.from(zone.children).filter(c => !c.hasAttribute('data-drag-id')) as Element[];
	if (children.length === 0) return { index: 0, child: null, zone };

	let elementAtPoint = document.elementFromPoint(clientX, clientY) as Element | null;
	let candidate: Element | null = elementAtPoint;

	while (candidate && candidate !== zone && candidate.parentElement !== zone) {
		candidate = candidate.parentElement;
	}

	if (candidate && candidate.parentElement === zone && !candidate.hasAttribute('data-drag-id')) {
		const idx = children.indexOf(candidate);
		const rect = candidate.getBoundingClientRect();
		const isHorizontal = zone.getBoundingClientRect().width > zone.getBoundingClientRect().height;
		const midpoint = isHorizontal ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
		const pointAxis = isHorizontal ? clientX : clientY;
		const insertIndex = idx + (pointAxis >= midpoint ? 1 : 0);
		return { index: insertIndex, child: candidate, zone };
	}

	const zoneRect = zone.getBoundingClientRect();
	const isHorizontal = zoneRect.width > zoneRect.height;
	const pointValue = isHorizontal ? clientX : clientY;

	for (let i = 0; i < children.length; i++) {
		const r = children[i].getBoundingClientRect();
		const center = isHorizontal ? r.left + r.width / 2 : r.top + r.height / 2;
		if (pointValue < center) return { index: i, child: children[i], zone };
	}

	return { index: children.length, child: null, zone };
}

// DraggableZone
export type DraggableZoneProps<T extends keyof ElementTagNameMap> = {
	as?: keyof ElementTagNameMap;
	on?: Partial<
		Record<
			DragEvents,
			(
				target: BoxelsElementNode<T> | Element | string | null,
				zoneEl: Element,
				info?: DropIndexInfo | null,
			) => void
		>
	>;
	children: JSX.Element | JSX.Element[];
};

export const DraggableZone: JSX.Component<'div', DraggableZoneProps<'div'>> = <
	T extends keyof ElementTagNameMap,
>({
	as,
	on,
	children,
	...props
}: DraggableZoneProps<T>) => {
	const listeners: Record<string, (e: any) => void> = {};

	if (on) {
		(Object.keys(on) as DragEvents[]).forEach((k) => {
			const fn = on[k];
			if (!fn) return;

			const domEvent = eventMap[k];
			// ===== Desktop
			if (['dragstart', 'dragend', 'dragenter', 'dragleave', 'dragover', 'drop'].includes(domEvent)) {
				listeners[`$on:${domEvent}`] = (e: DragEvent) => {
					if (domEvent === 'dragover' || domEvent === 'drop') e.preventDefault();
					const id = e.dataTransfer?.getData('text/plain') ?? '';
					const dragged = dragRegistry.get(id);
					let info: DropIndexInfo | null = null;

					if (['dragover', 'drop', 'dragenter', 'dragleave'].includes(domEvent)) {
						const clientX = e.clientX ?? 0;
						const clientY = e.clientY ?? 0;
						try {
							info = resolveDropIndex(e.currentTarget as Element, clientX, clientY);
						} catch {}
					}

					// ==== Auto-mover el elemento en drop desktop
					if (domEvent === 'drop' && dragged instanceof Element && info && dragged !== info.zone) {
						if (info.child) {
							info.zone.insertBefore(dragged, info.index > info.zone.children.length - 1 ? null : info.child);
						} else {
							info.zone.appendChild(dragged);
						}
						dragRegistry.delete(id);
					}

					// ==== Callback con el elemento de la zona directamente
					fn(
						(dragged ?? (id || null)) as string | Element | BoxelsElementNode<any> | null,
						e.currentTarget as Element,
						info,
					);
				};
			}

			// ===== Touch / pointer
			const customEvent = dndCustomMap[k];
			listeners[`$on:${customEvent}`] = (
				e: CustomEvent<{
					id?: string;
					el?: Element | BoxelsElementNode<any>;
					pointer?: PointerEvent;
				}>,
			) => {
				if (customEvent === 'dndover') e.preventDefault();
				const elFromDetail = e.detail?.el ?? null;
				const idFromDetail = e.detail?.id ?? null;
				const resolved = elFromDetail ?? dragRegistry.get(idFromDetail) ?? idFromDetail ?? null;
				let info: DropIndexInfo | null = null;

				if (['drop', 'over', 'enter', 'leave'].includes(k)) {
					const pointer = e.detail?.pointer;
					const clientX = pointer?.clientX ?? 0;
					const clientY = pointer?.clientY ?? 0;
					try {
						info = resolveDropIndex(e.currentTarget as Element, clientX, clientY);
					} catch {}
				}

				// ==== Callback con el elemento de la zona directamente
				fn(resolved as string | Element | BoxelsElementNode<any> | null, e.currentTarget as Element, info);
			};
		});
	}

	if (on) {
		const originalOver = listeners['$on:dragover'];
		listeners['$on:dragover'] = (e) => {
			e.preventDefault(); // evita que el drop falle
			originalOver?.(e);
		};
	}

	return $(
		as ?? 'div',
		{
			'data-drop-zone': 'true',
			...props,
			...listeners,
		},
		children,
	);
};

// Draggable
export type DraggableProps<Name extends string = string> = {
	as?: keyof ElementTagNameMap;
	id?: string;
	enable?: boolean | ReactiveSignal<boolean>;
	children: JSX.Element | JSX.Element[];
};

function generateId(): string {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
		return `drag-${(crypto as any).randomUUID()}`;
	return `drag-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function createGhost(el: HTMLElement): HTMLElement {
	const ghost = el.cloneNode(true) as HTMLElement;
	ghost.style.position = 'fixed';
	ghost.style.pointerEvents = 'none';
	ghost.style.opacity = '0.8';
	ghost.style.transform = 'translate(-50%, -50%)';
	ghost.style.zIndex = '99999';
	ghost.style.margin = '0';
	ghost.style.maxWidth = 'unset';
	ghost.style.maxHeight = 'unset';
	document.body.appendChild(ghost);
	return ghost;
}

function dispatchCustomTo(el: Element, type: string, detail: any) {
	el.dispatchEvent(
		new CustomEvent(type, { detail, bubbles: true, cancelable: true }),
	);
}

export const Draggable: JSX.Component<'div', DraggableProps> = ({
	id,
	as,
	enable = true,
	children,
	...props
}: DraggableProps) => {
	const elementId = id ?? generateId();
	let dragging = false;
	let currentZone: Element | null = null;
	let ghost: HTMLElement | null = null;
	let activePointerId: number | null = null;

	const startTouchDrag = (e: PointerEvent, targetEl: HTMLElement) => {
		if (isSignal(enable) ? !enable() : !enable) return;
		dragging = true;
		e.preventDefault();
		dragRegistry.set(elementId, targetEl);
		ghost = createGhost(targetEl);
		dispatchCustomTo(targetEl, dndCustomMap.start, { id: elementId, el: targetEl, pointer: e });
		activePointerId = e.pointerId ?? null;
		try { targetEl.setPointerCapture?.(activePointerId); } catch {}

		const move = (ev: PointerEvent) => {
			if (!dragging) return;
			if (ghost) { ghost.style.left = `${ev.clientX}px`; ghost.style.top = `${ev.clientY}px`; }
			const el = document.elementFromPoint(ev.clientX, ev.clientY) as Element | null;
			let zone = el?.closest('[data-drop-zone="true"]') ?? null;
			if (zone && zone.getAttribute('data-drag-id') === elementId) zone = null;

			if (zone !== currentZone) {
				if (currentZone) dispatchCustomTo(currentZone, dndCustomMap.leave, { id: elementId, el: targetEl, pointer: ev });
				if (zone) dispatchCustomTo(zone, dndCustomMap.enter, { id: elementId, el: targetEl, pointer: ev });
				currentZone = zone;
			}

			if (zone) dispatchCustomTo(zone, dndCustomMap.over, { id: elementId, el: targetEl, pointer: ev });
		};

		const up = (ev: PointerEvent) => {
			if (!dragging) return;
			dragging = false;
			if (currentZone) dispatchCustomTo(currentZone, dndCustomMap.drop, { id: elementId, el: targetEl, pointer: ev });
			dispatchCustomTo(document.body, dndCustomMap.end, { id: elementId, el: targetEl, pointer: ev });
			currentZone = null;
			dragRegistry.delete(elementId);
			if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
			ghost = null;
			try { targetEl.releasePointerCapture?.(activePointerId!); } catch {}
			activePointerId = null;
			window.removeEventListener('pointermove', move as any, { capture: true });
			window.removeEventListener('pointerup', up as any, { capture: true });
			window.removeEventListener('pointercancel', up as any, { capture: true });
		};

		window.addEventListener('pointermove', move as any, { capture: true, passive: false });
		window.addEventListener('pointerup', up as any, { capture: true });
		window.addEventListener('pointercancel', up as any, { capture: true });
	};

	const lifecycleProps: Record<string, any> = {
		'$lifecycle:mount': (el: Element) => { dragRegistry.set(elementId, el); },
		'$lifecycle:destroy': () => { dragRegistry.delete(elementId); },
	};

	return $(
		as ?? 'div',
		{
			...props,
			draggable: isSignal(enable) ? enable() : enable,
			'data-drag-id': elementId,
			...lifecycleProps,
			'$on:dragstart': (e: DragEvent) => {
				if (isSignal(enable) ? !enable() : !enable) return;
				const target = e.currentTarget as HTMLElement;
				dragRegistry.set(elementId, target);
				e.dataTransfer?.setData('text/plain', elementId);
				e.dataTransfer!.effectAllowed = 'move';
				try {
					if (e.dataTransfer?.setDragImage) {
						const rect = target.getBoundingClientRect();
						e.dataTransfer.setDragImage(target, rect.width / 2, rect.height / 2);
					}
				} catch {}
			},
			'$on:dragend': () => dragRegistry.delete(elementId),
			'$on:pointerdown': (e: PointerEvent) => {
				if (isSignal(enable) ? !enable() : !enable) return;
				const target = e.currentTarget as HTMLElement;
				if (e.pointerType === 'touch' || (isTouchLike() && e.pointerType !== 'mouse')) {
					target.style.touchAction = 'none';
					dragRegistry.set(elementId, target);
					startTouchDrag(e, target);
				}
			},
		},
		children,
	);
};
