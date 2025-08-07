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

---

## Tipos principales de hooks

### 1. Hooks de cliente

#### `useChannel`
Permite crear canales de eventos tipados y globales para comunicación entre partes de la app.

```ts
import { useChannel } from 'boxels/hooks';

const chat = useChannel<'chat', { message: string }>('chat');

const off = chat.on('message', (msg) => console.log(msg));
chat.emit('message', '¡Hola!');
// ...
off(); // Elimina el listener
chat.destroy(); // Limpia el canal
```

#### `createWorker`
Crea un worker a partir de cualquier función, permitiendo ejecución en segundo plano.

```ts
import { createWorker } from 'boxels/hooks';

const heavyTask = createWorker((data: number[]) => {
  // Cálculos intensivos...
  return data.reduce((a, b) => a + b, 0);
});

const result = await heavyTask([1, 2, 3]);
// ...
heavyTask.destroy(); // Termina el worker
```

#### `Sound`
Reproductor de audio avanzado con soporte para eventos, 3D y caché.

```ts
import { Sound } from 'boxels/hooks';

const s = new Sound('/audio/alert.mp3', {
  onPlay: () => console.log('Reproduciendo'),
  onEnd: () => console.log('Fin'),
});
s.play();
// ...
s.destroy();
```

[resto del contenido igual...]

