import type { MaybeSignal } from '../src/core/reactive';
import type {
	BoxelsElement,
	JSXBoxelsELementAttrs,
} from '../src/dom/attributes/elements/index';
import type {
	BoxelsELementNodeAttributes,
	LifecycleEventHandlers,
} from '../src/dom/attributes/handlers/global-handlers';
import './styles.d';

// ------------------------
// JSX Global
// ------------------------

declare global {
	namespace JSX {
		/** Para compatibilidad con JSX, se reutiliza Attributes */
		type DOMAttributes<T extends keyof ElementTagNameMap> =
			BoxelsELementNodeAttributes<T>;

		/** Todas las etiquetas válidas en JSX */
		type ElementsAttrs = {
			[K in keyof ElementTagNameMap]: JSXBoxelsELementAttrs<K>;
		};

		interface IntrinsicElements extends ElementsAttrs {
			fragment: LifecycleEventHandlers<'div'> & { children?: JSX.Element | JSX.Element[] };
		}

		type CustomElement = HTMLElement & BoxelsElement & any;

		/** Tipo de elemento JSX */
		interface Element extends CustomElement {}

		/** Fragmento JSX (<>...</>) */
		type Fragment = Component<any, LifecycleEventHandlers<'div'> & {
				children?: any;
			}>;

		/** Componente funcional */
		type FunctionComponent<P = object> = (
			props?: P &
				BoxelsElement & {
					children?: any;
				},
		) => Element | MaybeSignal<Element> | Promise<MaybeSignal<Element>>;

		type DynamicProps<T extends keyof ElementTagNameMap = 'div'> =
			JSXBoxelsELementAttrs<T>;

		type Component<T extends keyof ElementTagNameMap = 'div', P = {}> = (
			props: P & DynamicProps<T> & { children?: any },
		) => Element | MaybeSignal<Element> | Promise<MaybeSignal<Element>>;

		/** Componente basado en clase */
		type ElementClass = BoxelsElement & {
			props?: object & {
				children?: any;
			};
			render: () => Element | MaybeSignal<Element> | Promise<MaybeSignal<Element>>;
		};

		/** Vincula prop `props` como portador de atributos JSX */
		interface ElementAttributesProperty {
			props: object;
		}

		/** Vincula prop `children` como hijos JSX */
		interface ElementChildrenAttribute {
			children: MaybeSignal<object>;
		}
	}
}
