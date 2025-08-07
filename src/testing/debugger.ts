// Importa todas las exportaciones del módulo 'environment' bajo el alias 'env'.
// Este módulo generalmente contiene variables o funciones relacionadas con la configuración
// del entorno de ejecución (por ejemplo, si está en desarrollo o producción).
import * as env from '../environment';

/**
 * Objeto `debug` que proporciona utilidades relacionadas con la depuración del entorno.
 * 
 * Este objeto agrupa métodos y propiedades que permiten:
 * - Activar opciones de depuración visual (como mostrar cambios en tiempo real).
 * - Determinar si la aplicación se está ejecutando en modo desarrollo.
 */
export const debug = {
	/**
	 * Activa la visualización de cambios en el entorno, si está soportado.
	 * 
	 * Internamente llama a la función `enableShowChanges()` del módulo de entorno.
	 * Esta función probablemente active algún tipo de indicador visual o consola para
	 * facilitar la depuración durante el desarrollo.
	 */
	showChanges: () => env.enableShowChanges(),

	/**
	 * Propiedad booleana que indica si el entorno actual es de desarrollo.
	 * 
	 * Utiliza la constante `__development__` definida en el módulo de entorno.
	 * Esta propiedad es útil para condicionar comportamientos específicos durante
	 * el desarrollo, como mostrar logs adicionales o activar herramientas de debug.
	 */
	isDevelopment: env.__development__,
};
