import type { ReactiveSignal } from '../src/core/reactive';
import type {
	BoxelsElement,
	JSXBoxelsELementAttrs,
	JSXBoxelsElement,
} from '../src/dom/attributes/elements/index';
import type { BoxelsELementNodeAttributes, SVGAttributes } from '../src/dom/attributes/handlers/global-handlers';
import "./styles.d"

// ------------------------
// JSX Global
// ------------------------

declare global {
	namespace JSX {
		/** Para compatibilidad con JSX, se reutiliza Attributes */
		type DOMAttributes<T extends keyof HTMLElementTagNameMap>
			= BoxelsELementNodeAttributes<T>;

		/** Todas las etiquetas válidas en JSX */
		type Elements = {
			[K in keyof HTMLElementTagNameMap]: JSXBoxelsELementAttrs<K>;
		};

		interface IntrinsicElements extends Elements {
			svg: SVGAttributes;
			path: SVGAttributes;
			circle: SVGAttributes;
		}

		/** Tipo de elemento JSX */
		interface Element extends JSXBoxelsElement {}

		/** Fragmento JSX (<>...</>) */
		type Fragment = FunctionComponent<{
			children?: any;
		}>;

		/** Componente funcional */
		type FunctionComponent<P = object> = (
			props: P &
				BoxelsElement & {
					children?: any;
				},
		) => Element | ReactiveSignal<Element>;

		/** Componente basado en clase */
		type ElementClass = BoxelsElement & {
			props?: object & {
				children?: any;
			};
			render: () => Element | ReactiveSignal<Element>;
		};

		/** Vincula prop `props` como portador de atributos JSX */
		interface ElementAttributesProperty {
			props: object;
		}

		/** Vincula prop `children` como hijos JSX */
		interface ElementChildrenAttribute {
			children: object | ReactiveSignal<object>;
		}
	}
}
