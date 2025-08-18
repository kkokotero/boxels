// Importa todas las exportaciones del módulo 'environment' bajo el alias 'env'.
// Normalmente este módulo contiene configuraciones relacionadas con el entorno,
// tales como:
// - Variables globales de configuración.
// - Flags para distinguir entre desarrollo y producción.
// - Funciones auxiliares para habilitar herramientas de depuración.
import * as env from '../environment';

/**
 * Objeto `debug`: centraliza herramientas y banderas de depuración.
 *
 * Sirve como interfaz para:
 * - Activar visualizaciones de depuración (ej. resaltar cambios en el DOM).
 * - Mostrar nombres de nodos o comentarios en el DOM.
 * - Consultar si el entorno actual es de desarrollo.
 *
 * ⚡ Nota:
 *   Estas utilidades solo se activan si el entorno lo permite (modo desarrollo).
 *   En producción, sus valores normalmente serán `false` o no tendrán efecto.
 */
export const debug = {
	/**
	 * Habilita la visualización de cambios en el DOM.
	 * 
	 * Delegado a `env.enableShowChanges()`, que debería activar alguna
	 * herramienta visual, como resaltar elementos DOM cuando cambian.
	 *
	 * ✅ Uso típico:
	 *   debug.showChanges();
	 */
	showChanges: () => env.enableShowChanges(),

	/**
	 * Indica si la opción "mostrar cambios" está habilitada.
	 * 
	 * Se evalúa a `true` únicamente cuando:
	 * - Estamos en modo desarrollo (`env.__development__ === true`).
	 * - Y la flag interna `env.__show_changes__` está activa.
	 */
	isShowChanges: () => env.__development__ && env.__show_changes__,

	/**
	 * Habilita la visualización de nombres asociados a comentarios en el DOM.
	 *
	 * Útil porque algunos fragmentos JSX se montan como nodos de comentario
	 * invisibles, y esta opción ayuda a identificarlos mostrando sus nombres.
	 *
	 * Internamente, se delega a `env.enableCommentsName()`.
	 *
	 * ✅ Uso típico:
	 *   debug.showCommentsNames();
	 */
	showCommentsNames: () => env.enableCommentsName(),

	/**
	 * Indica si la opción "mostrar nombres de comentarios" está habilitada.
	 *
	 * Al igual que `isShowChanges`, depende de que:
	 * - El entorno esté en desarrollo.
	 * - Y `env.__show_comment_names__` esté activa.
	 */
	isShowCommentNames: () =>  env.__development__ && env.__show_comment_names__,

	/**
	 * Indica si la aplicación está corriendo en modo desarrollo.
	 *
	 * Esta propiedad permite condicionar comportamientos dentro del código.
	 * Ejemplo de usos comunes:
	 * - Mostrar `console.log` adicionales.
	 * - Activar diagnósticos o métricas.
	 * - Permitir funciones experimentales solo en desarrollo.
	 *
	 * ✅ Ejemplo:
	 *   if (debug.isDevelopment) {
	 *     console.log("Modo desarrollo activo 🚀");
	 *   }
	 */
	isDevelopment: () =>  env.__development__,
};
