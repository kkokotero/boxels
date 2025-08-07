// Importa la función `queue` desde el sistema de planificación (scheduler),
// usada para ejecutar funciones asincrónicamente sin bloquear el hilo principal.
import { queue } from '../../core/scheduler';

// Tipo genérico para un listener o manejador de eventos.
// Recibe un valor de tipo Payload.
type Listener<Payload> = (payload: Payload) => void;

// Mapa de eventos. Cada clave es el nombre de un evento
// y el valor es el tipo de dato que se pasa como argumento al listener.
type EventMap = Record<string, any>;

// Tipo que define la interfaz de un canal de eventos.
type Channel<Events extends EventMap> = {
  /**
   * Registra un listener para un evento específico.
   * Devuelve una función que permite remover ese listener posteriormente.
   *
   * @param event - Nombre del evento
   * @param handler - Función que se ejecutará cuando el evento sea emitido
   */
  on<K extends keyof Events>(event: K, handler: Listener<Events[K]>): () => void;

  /**
   * Emite un evento, ejecutando todos los listeners registrados para él.
   * Los listeners se ejecutan en cola (de forma asíncrona).
   *
   * @param event - Nombre del evento a emitir
   * @param payload - Datos que se pasan a los listeners del evento
   */
  emit<K extends keyof Events>(event: K, payload: Events[K]): void;

  /**
   * Limpia los listeners registrados para un evento específico.
   * Si no se especifica ningún evento, limpia todos los listeners del canal.
   *
   * @param event - (Opcional) Nombre del evento a limpiar
   */
  clear(event?: keyof Events): void;

  /**
   * Elimina completamente el canal de la caché global
   * y limpia todos los manejadores de eventos.
   */
  destroy(): void;
};

// Mapa global que almacena todos los canales registrados por nombre.
// Permite reutilizar canales y tener un sistema de eventos compartido.
const globalChannelCache = new Map<string, Channel<any>>();

/**
 * Elimina todos los canales registrados globalmente.
 * Se limpian todos los listeners de cada canal y se borra la caché.
 */
export function destroyAllChannels(): void {
  for (const [, channel] of globalChannelCache) {
    channel.clear(); // Limpia todos los eventos del canal
  }
  globalChannelCache.clear(); // Borra la caché global
}

/**
 * Hook/fábrica que crea o reutiliza un canal de eventos con nombre único.
 * Si el canal ya existe, lo devuelve desde la caché. Si no, lo crea y registra.
 *
 * @param name - Nombre único del canal
 * @returns Un canal con métodos para manejar eventos personalizados
 */
export function useChannel<
  Name extends string,
  Events extends EventMap
>(name: Name): Channel<Events> {
  // Si el canal no existe en la caché global, lo creamos
  if (!globalChannelCache.has(name)) {
    // Objeto que almacena los listeners registrados por evento
    const listeners: Partial<Record<keyof Events, Set<Listener<any>>>> = {};

    // Implementación del canal
    const channel: Channel<Events> = {
      // Registra un listener para un evento
      on(event, handler) {
        if (!listeners[event]) listeners[event] = new Set();
        listeners[event]!.add(handler);
        // Devuelve una función para remover el listener
        return () => listeners[event]?.delete(handler);
      },
      // Emite un evento, ejecutando todos los listeners registrados
      emit(event, payload) {
        if (!listeners[event]) return;
        for (const handler of listeners[event]!) {
          // Usamos `queue` para ejecutar el handler de forma asíncrona
          queue(() => {
            try {
              handler(payload);
            } catch (err) {
              console.error(`[Channel "${name}"] Error en "${String(event)}":`, err);
            }
          });
        }
      },
      // Limpia todos los listeners de un evento, o de todos si no se especifica
      clear(event) {
        if (event) {
          listeners[event]?.clear();
        } else {
          for (const key in listeners) {
            listeners[key as keyof Events]?.clear();
          }
        }
      },
      // Elimina el canal de la caché y limpia todos los listeners
      destroy() {
        for (const key in listeners) {
          listeners[key as keyof Events]?.clear();
        }
        globalChannelCache.delete(name);
      }
    };

    // Guardamos el canal en la caché global para su reutilización
    globalChannelCache.set(name, channel);
  }

  // Retornamos el canal desde la caché
  return globalChannelCache.get(name)!;
}
