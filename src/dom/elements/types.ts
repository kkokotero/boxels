import type { MaybeSignal } from '@core/reactive/types';
import type { LifecycleEventHandlers } from '@dom/elements/attributes/handlers';

export interface BoxelsTagNameMap extends ElementTagNameMap {
	fragment: HTMLElement & LifecycleEventHandlers<'div'>;
}

export type ChildNode =
	| Node
	| string
	| number
	| null
	| false
	| true
	| undefined
	| BoxelsElement
	| ChildNode[]
	| BoxlesChildren;

export type Child = MaybeSignal<ChildNode> | Promise<ChildNode>;

export type BoxlesChildren = {
	nodes: Node[];
	onMount(): void;
	cleanup(): void;
};

export type BoxelsElement = HTMLElement & {
	mount: (parent: HTMLElement | DocumentFragment | Comment) => void;
	destroy: () => void;
	mountEffect: () => () => void;
	isFragment: boolean;
	__boxels: true;
	__mounted: boolean;
	__destroyed: boolean;
	key?: string;
};

export type BoxelsElementNode<T extends keyof BoxelsTagNameMap> =
	BoxelsTagNameMap[T] & {
		mount: (parent: HTMLElement | DocumentFragment | Comment) => void;
		destroy: () => void;
		mountEffect: () => void;
		isFragment: boolean;
		__boxels: true;
		__mounted: boolean;
		__destroyed: boolean;
		key?: string;
	};

export type BoxelsNode<T extends keyof BoxelsTagNameMap> = BoxelsElementNode<T>;

// Alias de atributos específicos para tipos HTML dentro de JSX
export type JSXBoxelsELementAttrs<T extends keyof BoxelsTagNameMap> =
	BoxelsElementAttributes<T>;

// Tipo general para cualquier elemento creado por Boxels
export type JSXBoxelsElement = BoxelsElement;
