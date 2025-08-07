/**
 * Interfaz que representa un "Hook" en el sistema.
 *
 * Un Hook puede ser cualquier entidad que necesite realizar una acción
 * de limpieza o liberación de recursos cuando ya no se utiliza.
 *
 * Esta interfaz define un contrato que asegura que el objeto implementador
 * tendrá un método `destroy`, que debe ser llamado explícitamente
 * para ejecutar dicha limpieza.
 */
export interface Hook {
    /**
     * Método que debe ser implementado para realizar tareas de limpieza.
     *
     * Se invoca cuando el hook ya no es necesario, con el propósito de:
     * - Eliminar listeners de eventos.
     * - Cancelar timers o animaciones.
     * - Liberar memoria o referencias que puedan causar fugas.
     * - Desconectar observadores o reactive signals.
     *
     * Es una práctica importante en contextos donde el ciclo de vida
     * de un componente o recurso no está gestionado automáticamente.
     */
    destroy: () => void;
}
