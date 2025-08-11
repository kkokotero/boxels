# Documentación técnica de `hooks`

Este documento describe la arquitectura, ciclo de vida, patrones de uso y aspectos técnicos del módulo `src/hooks` de Boxels.

## Estructura del módulo

El directorio `src/hooks` está organizado en submódulos:

- `hook.ts`: Interfaz base para todos los hooks (`Hook` con método `destroy`).
- `client/`: Hooks para lógica de cliente (ej: canales de eventos, reproductor de sonido).
- `effects/`: Hooks para efectos visuales y animaciones (ej: estilos animados, confetti).
- `styles/`: Hooks para manipulación reactiva de estilos, rangos y estados visuales.
- `index.ts`: Punto de entrada que reexporta todos los hooks.

## Filosofía y ciclo de vida de los hooks

Un **hook** en Boxels es un objeto autocontenible que encapsula lógica reactiva, efectos secundarios, recursos o comportamientos reutilizables, y expone un método `destroy()` para limpieza explícita.

- Los hooks pueden ser clases o funciones que retornan un objeto con `destroy()`.
- Se integran con el ciclo de vida de componentes y elementos DOM.
- Permiten desacoplar lógica de UI, efectos, recursos y estados complejos.