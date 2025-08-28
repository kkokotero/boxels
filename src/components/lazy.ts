import { effect, signal, type ReactiveSignal } from '@core/reactive';
import { $, type BoxelsElement } from '@dom/index';
import { Fragment } from './fragment';

/**
 * Tipos de estrategia para determinar cuándo cargar el componente de forma perezosa (lazy).
 */
type LazyWhen =
	| 'immediate' // Carga inmediatamente
	| 'idle' // Carga cuando el navegador está inactivo
	| 'visible' // Carga cuando el componente es visible en el viewport
	| { event: keyof HTMLElementEventMap; target: string } // Carga al dispararse un evento específico en un elemento
	| { timeout: number } // Carga después de un cierto tiempo (ms)
	| { condition: () => boolean | ReactiveSignal<boolean> } // Carga cuando una condición booleana se cumple
	| { visibleTarget?: string }; // Carga cuando un elemento específico es visible

type ComponentProps<C> = C extends (props: infer P) => any ? P : {};

/**
 * Props que acepta el componente Lazy.
 */
type LazyProps<C = any> = {
	loader: () => Promise<C | BoxelsElement>;
	props?: ComponentProps<C>;
	loading?: BoxelsElement;
	error?: BoxelsElement;
	when?: LazyWhen;
};

/**
 * Componente Lazy: carga componentes de forma perezosa bajo distintas estrategias.
 */
export function Lazy({
	loader,
	loading = $(document.createDocumentFragment(), {}),
	error = $(document.createDocumentFragment(), {}),
	when = 'immediate',
	...props
}: LazyProps): JSX.Component {
	// Señal reactiva que contiene el componente actual o el estado de carga/error
	const element = signal<BoxelsElement | undefined>(loading);

	let isLoaded = false; // Bandera para evitar múltiples cargas
	let observer: IntersectionObserver | null = null; // Observador de visibilidad para estrategias basadas en visibilidad

	/**
	 * Función que se encarga de cargar el componente utilizando el loader.
	 */
	const loadComponent = async () => {
		if (isLoaded) return;
		isLoaded = true;

		// Desconectamos el observer si estaba activo
		if (observer) {
			observer.disconnect();
			observer = null;
		}

		try {
			// Ejecutamos el loader. Puede retornar directamente el elemento o una función de componente.
			const mod = await loader();
			const component = typeof mod === 'function' ? mod(props) : mod;
			element.set(component); // Actualizamos la señal con el componente cargado
		} catch (err) {
			console.error('Lazy load error:', err);
			element.set(error); // Mostramos componente de error si falla
		}
	};

	/**
	 * Configura un IntersectionObserver para cargar el componente cuando el target es visible.
	 */
	const setupVisibilityObserver = (target: Element) => {
		observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					loadComponent(); // Cargamos al hacerse visible
				}
			},
			{ threshold: 0.1 }, // Consideramos visible si al menos el 10% del elemento lo está
		);
		observer.observe(target);
	};

	/**
	 * Configura la estrategia de carga según la opción `when` especificada.
	 */
	const setupLoadStrategy = () => {
		switch (true) {
			case when === 'immediate':
				// Carga inmediatamente
				loadComponent();
				break;

			case when === 'idle':
				// Carga cuando el navegador esté inactivo (ideal para no bloquear la UI)
				if ('requestIdleCallback' in window) {
					requestIdleCallback(() => loadComponent());
				} else {
					// Fallback para navegadores sin soporte
					setTimeout(loadComponent, 0);
				}
				break;

			case when === 'visible':
				// Carga cuando el componente montado sea visible en el viewport
				effect([element], () => {
					const currentElement = element();
					if (!currentElement || !(currentElement instanceof Node)) return;

					// Esperamos al siguiente tick para asegurar que esté en el DOM
					setTimeout(() => {
						const domNode =
							currentElement instanceof Element
								? currentElement
								: document.querySelector(
										`[data-id="${(currentElement as HTMLElement).id}"]`,
									);

						if (domNode) {
							setupVisibilityObserver(domNode);
						}
					}, 0);
				});
				break;

			case typeof when === 'object' && 'visibleTarget' in when: {
				// Carga cuando un elemento específico se vuelve visible
				const target = document.querySelector(when.visibleTarget || '');
				if (target) {
					setupVisibilityObserver(target);
				} else {
					console.warn(
						`Lazy: No se encontró el elemento con selector "${when.visibleTarget}"`,
					);
				}
				break;
			}

			case typeof when === 'object' && 'event' in when && 'target' in when: {
				// Carga al dispararse un evento específico en un selector
				const eventTarget = document.querySelector(when.target);
				if (eventTarget) {
					const onEvent = () => {
						eventTarget.removeEventListener(when.event, onEvent);
						loadComponent();
					};
					// Escuchamos el evento una sola vez
					eventTarget.addEventListener(when.event, onEvent, { once: true });
				}
				break;
			}

			case typeof when === 'object' && 'timeout' in when:
				// Carga después de un tiempo definido
				setTimeout(loadComponent, when.timeout);
				break;

			case typeof when === 'object' && 'condition' in when: {
				// Carga cuando una condición booleana se cumpla
				const cond = when.condition();

				// Si es una señal reactiva
				if (typeof cond === 'function') {
					effect([cond], () => {
						if (cond()) loadComponent();
					});
				} else if (cond) {
					// Si la condición ya es verdadera
					loadComponent();
				}
				break;
			}
		}
	};

	// Devuelve la señal que se actualizará con el componente cargado
	return Fragment({
		'$lifecycle:destroy': () => element.destroy(),
		'$lifecycle:mount': () => {
			// Inicia la estrategia de carga al montar
			setupLoadStrategy();
		},
		children: element,
	});
}
