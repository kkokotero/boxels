# Documentación técnica de `testing`

Este documento describe la arquitectura, utilidades, patrones de uso y aspectos técnicos del módulo `src/testing` de Boxels.

## Estructura del módulo

El directorio `src/testing` está organizado en utilidades para pruebas de los distintos sistemas reactivos y de ciclo de vida:

- `element-test.ts`: Utilidades para verificar el estado de elementos Boxels (`isMounted`, `isDestroyed`).
- `signal-test.ts`: Herramientas para capturar, espiar y testear señales reactivas (`captureSignal`, `spySignal`).
- `scheduler-test.ts`: Utilidades para controlar y testear el scheduler interno (`flushNow`, `resetScheduler`, `getSchedulerState`).
- `debugger.ts`: Helpers para depuración y activación de overlays visuales.
- `index.ts`: Punto de entrada que reexporta todas las utilidades de testing.

---

## Utilidades principales

### 1. Test de elementos DOM

#### `isMounted` y `isDestroyed`
Permiten verificar el estado de ciclo de vida de cualquier elemento Boxels.

```ts
import { isMounted, isDestroyed } from 'boxels/testing';

if (isMounted(element)) {
  // El elemento está montado en el DOM
}
```

---

### 2. Test y espías de señales reactivas

#### `captureSignal`
Captura todos los valores emitidos por una señal durante una prueba.

```ts
import { captureSignal } from 'boxels/testing';

const s = signal(0);
const cap = captureSignal(s);
s.set(1);
s.set(2);
console.log(cap.values); // [0, 1, 2]
cap.stop(); // Detiene la captura
cap.clear(); // Limpia el historial
```

#### `spySignal`
Permite espiar y contar las emisiones de una señal, útil para asserts en tests.

```ts
import { spySignal } from 'boxels/testing';

const s = signal('a');
const spy = spySignal(s);
s.set('b');
console.log(spy.calls); // ['a', 'b']
spy.stop();
```

---

### 3. Control y test del scheduler

#### `flushNow`
Fuerza la ejecución inmediata de todas las tareas pendientes del scheduler.

#### `resetScheduler`
Reinicia el estado interno del scheduler, útil para aislar tests.

#### `getSchedulerState`
Obtiene una instantánea del estado interno del scheduler para asserts avanzados.

```ts
import { flushNow, resetScheduler, getSchedulerState } from 'boxels/testing';

// ...código que programa tareas...
flushNow(); // Fuerza ejecución
const state = getSchedulerState();
resetScheduler(); // Limpia todo
```

---

### 4. Depuración visual

#### `debug.showChanges`
Activa overlays visuales de cambio en el DOM para depuración durante tests.

```ts
import { debug } from 'boxels/testing';
debug.showChanges();
```