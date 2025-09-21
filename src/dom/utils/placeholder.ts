import { onDestroy } from "@dom/element";

export type Placeholder = HTMLDivElement | null;

let placeholderContainer: Placeholder = null;

/**
 * Obtiene o crea un contenedor oculto para placeholders
 */
function getPlaceholderContainer() {
    if (!placeholderContainer) {
        placeholderContainer = document.createElement('div');
        placeholderContainer.style.position = 'absolute';
        placeholderContainer.style.top = '0';
        placeholderContainer.style.left = '0';
        placeholderContainer.style.width = '0';
        placeholderContainer.style.height = '0';
        placeholderContainer.style.overflow = 'visible'; // permite que los placeholders se posicionen fuera
        placeholderContainer.style.pointerEvents = 'none';
        document.body.appendChild(placeholderContainer);
    }
    return placeholderContainer;
}

/**
 * Opciones de creación de placeholder
 */
interface PlaceholderOptions {
    /** Estilos extra aplicados directamente */
    styles?: Partial<CSSStyleDeclaration>;
    /** Posición absoluta (independiente de un elemento) */
    position?: Position;
    /** Elemento al que se atacha */
    attachTo?: string | HTMLElement;
    /** Si copiar ancho/alto del elemento atachado */
    matchSize?: boolean;
}

type Position =
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'left-center'
    | 'right-center'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right'
    | 'center'
    | { top: number; left: number }; // porcentajes 0–100

interface PlaceholderOptions {
    styles?: Partial<CSSStyleDeclaration>;
    position?: Position;
    attachTo?: string | HTMLElement;
    matchSize?: boolean;
}

/**
 * Crea un placeholder flexible
 */
export function createPlaceholder(
    options: PlaceholderOptions = {},
): HTMLDivElement {
    const ph = document.createElement('div');
    ph.style.position = 'absolute';
    ph.style.pointerEvents = 'none';
    ph.style.opacity = '0';
    ph.style.zIndex = '9999';

    if (options.styles) Object.assign(ph.style, options.styles);

    getPlaceholderContainer().appendChild(ph);

    const element =
        typeof options.attachTo === 'string'
            ? document.querySelector(options.attachTo)
            : options.attachTo;

    const update = () => {
        if (element) {
            // Si está atachado a un elemento
            const rect = element.getBoundingClientRect();
            ph.style.top = `${rect.top + window.scrollY}px`;
            ph.style.left = `${rect.left + window.scrollX}px`;

            if (options.matchSize) {
                ph.style.width = `${rect.width}px`;
                ph.style.height = `${rect.height}px`;
            }
        } else if (options.position) {
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const phRect = ph.getBoundingClientRect();

            if (typeof options.position === 'string') {
                switch (options.position) {
                    case 'top-left':
                        ph.style.top = '0px';
                        ph.style.left = '0px';
                        break;
                    case 'top-center':
                        ph.style.top = '0px';
                        ph.style.left = `${vw / 2 - phRect.width / 2}px`;
                        break;
                    case 'top-right':
                        ph.style.top = '0px';
                        ph.style.left = `${vw - phRect.width}px`;
                        break;
                    case 'left-center':
                        ph.style.top = `${vh / 2 - phRect.height / 2}px`;
                        ph.style.left = '0px';
                        break;
                    case 'right-center':
                        ph.style.top = `${vh / 2 - phRect.height / 2}px`;
                        ph.style.left = `${vw - phRect.width}px`;
                        break;
                    case 'bottom-left':
                        ph.style.top = `${vh - phRect.height}px`;
                        ph.style.left = '0px';
                        break;
                    case 'bottom-center':
                        ph.style.top = `${vh - phRect.height}px`;
                        ph.style.left = `${vw / 2 - phRect.width / 2}px`;
                        break;
                    case 'bottom-right':
                        ph.style.top = `${vh - phRect.height}px`;
                        ph.style.left = `${vw - phRect.width}px`;
                        break;
                    case 'center':
                        ph.style.top = `${vh / 2 - phRect.height / 2}px`;
                        ph.style.left = `${vw / 2 - phRect.width / 2}px`;
                        break;
                }
            } else {
                // Números => porcentaje
                const { top, left } = options.position;
                ph.style.top = `${(vh * top) / 100 - phRect.height / 2}px`;
                ph.style.left = `${(vw * left) / 100 - phRect.width / 2}px`;
            }
        }
    };

    // Inicializamos posición
    requestAnimationFrame(update);

    // Escuchar cambios si está atachado
    if (element) {
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update);
    }

    // Limpiar al destruir
    onDestroy(() => {
        if (element) {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update);
        }
        ph.remove();

        if (placeholderContainer?.childElementCount === 0) {
            placeholderContainer.remove();
            placeholderContainer = null;
        }
    });

    return ph;
}