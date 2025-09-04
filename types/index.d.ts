import type { MaybeSignal, ReactiveSignal } from '../src/core/reactive';
import type {
	BoxelsElement,
	JSXBoxelsELementAttrs,
	JSXBoxelsElement,
} from '../src/dom/attributes/elements/index';
import type {
	BoxelsELementNodeAttributes,
	SVGAttributes,
	LifecycleEventHandlers,
} from '../src/dom/attributes/handlers/global-handlers';
import './styles.d';

// ------------------------
// JSX Global
// ------------------------

declare global {
	namespace JSX {
		/** Para compatibilidad con JSX, se reutiliza Attributes */
		type DOMAttributes<T extends keyof HTMLElementTagNameMap> =
			BoxelsELementNodeAttributes<T>;

		/** Todas las etiquetas válidas en JSX */
		type Elements = {
			[K in keyof HTMLElementTagNameMap]: JSXBoxelsELementAttrs<K>;
		};

		interface IntrinsicElements extends Elements {
			// Contenedor raíz
			svg: SVGAttributes;

			// Formas básicas
			circle: SVGAttributes;
			ellipse: SVGAttributes;
			line: SVGAttributes;
			path: SVGAttributes;
			pathx: SVGAttributes;
			polygon: SVGAttributes;
			polyline: SVGAttributes;
			rect: SVGAttributes;

			// Contenedores / estructurales
			g: SVGAttributes;
			symbol: SVGAttributes;
			defs: SVGAttributes;
			use: SVGAttributes;

			// Texto
			text: SVGAttributes;
			tspan: SVGAttributes;
			textPath: SVGAttributes;

			// Gradientes y patrones
			linearGradient: SVGAttributes;
			radialGradient: SVGAttributes;
			stop: SVGAttributes;
			pattern: SVGAttributes;
			clipPath: SVGAttributes;
			mask: SVGAttributes;

			// Filtros
			filter: SVGAttributes;
			feBlend: SVGAttributes;
			feColorMatrix: SVGAttributes;
			feComponentTransfer: SVGAttributes;
			feComposite: SVGAttributes;
			feConvolveMatrix: SVGAttributes;
			feDiffuseLighting: SVGAttributes;
			feDisplacementMap: SVGAttributes;
			feDropShadow: SVGAttributes;
			feFlood: SVGAttributes;
			feGaussianBlur: SVGAttributes;
			feImage: SVGAttributes;
			feMerge: SVGAttributes;
			feMorphology: SVGAttributes;
			feOffset: SVGAttributes;
			feSpecularLighting: SVGAttributes;
			feTile: SVGAttributes;
			feTurbulence: SVGAttributes;
		}

		/** Tipo de elemento JSX */
		interface Element extends JSXBoxelsElement {}

		/** Fragmento JSX (<>...</>) */
		type Fragment = (
			props: LifecycleEventHandlers<'div'> & {
				children?: any;
			},
		) => MaybeSignal<Element>;

		/** Componente funcional */
		type FunctionComponent<P = object> = (
			props: P &
				BoxelsElement & {
					children?: any;
				},
		) => MaybeSignal<Element>;

		type DynamicProps<T extends keyof HTMLElementTagNameMap = 'div'> =
			JSXBoxelsELementAttrs<K>;

		type Component<T extends keyof HTMLElementTagNameMap = 'div', P = {}> = (
			props: P & DynamicProps<T> & { children?: any },
		) => Element | Promise<Element>;

		/** Componente basado en clase */
		type ElementClass = BoxelsElement & {
			props?: object & {
				children?: any;
			};
			render: () => MaybeSignal<Element>;
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
