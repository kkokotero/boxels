import { $ } from '@dom/index';

// ---------------------------------------------------------
// Tipos y mapeo de eventos de arrastre (drag & drop)
// ---------------------------------------------------------

export type DragEvents = 'start' | 'end' | 'enter' | 'leave' | 'over' | 'drop';

const eventMap: Record<DragEvents, keyof HTMLElementEventMap> = {
	start: 'dragstart',
	end: 'dragend',
	enter: 'dragenter',
	leave: 'dragleave',
	over: 'dragover',
	drop: 'drop',
};

// ---------------------------------------------------------
// Componente DraggableZone
// ---------------------------------------------------------

export type DraggableZoneProps = {
	as?: keyof HTMLElementTagNameMap;
	on?: Partial<Record<DragEvents, (id: string, e: DragEvent) => void>>;
	children: JSX.Element | JSX.Element[];
};

export const DraggableZone: JSX.Component<'div', DraggableZoneProps> = ({
	as,
	on,
	children,
	...props
}: DraggableZoneProps) => {
	const listeners: Record<string, (e: DragEvent) => void> = {};

	if (on) {
		Object.entries(on).forEach(([k, fn]) => {
			if (fn) {
				const domEvent = eventMap[k as DragEvents];
				listeners[`$on:${domEvent}`] = (e: DragEvent) => {
					if (
						(domEvent === 'dragover' || domEvent === 'drop') &&
						on[domEvent as DragEvents]
					) {
						e.preventDefault();
					}
					fn(e.dataTransfer?.getData('text/plain') ?? '', e);
				};
			}
		});
	}

	return $(
		as ?? 'div',
		{
			...props,
			...listeners,
		},
		children,
	);
};

// ---------------------------------------------------------
// Componente Draggable
// ---------------------------------------------------------

export type DraggableProps = {
	as?: keyof HTMLElementTagNameMap;
	id?: string; // ahora es opcional
	disabled?: boolean; // permite desactivar el arrastre
	children: JSX.Element | JSX.Element[];
};

/**
 * Genera un ID único en caso de que el usuario no lo provea.
 * Usa `crypto.randomUUID()` si está disponible, o un fallback.
 */
function generateId(): string {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return `drag-${crypto.randomUUID()}`;
	}
	return `drag-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export const Draggable: JSX.Component<'div', DraggableProps> = ({
	id,
	as,
	disabled,
	children,
	...props
}: DraggableProps) => {
	// Si no se pasa un id, generamos uno automáticamente
	const elementId = id ?? generateId();

	return $(
		as ?? 'div',
		{
			...props,
			draggable: !disabled,
			'data-drag-id': elementId,
			'$on:dragstart': (e) => {
				if (disabled) return;
				e.dataTransfer?.setData('text/plain', elementId);
			},
		},
		children,
	);
};
