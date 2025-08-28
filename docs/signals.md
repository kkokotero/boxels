# Signals en Boxels

Un **signal** es una unidad de estado **reactivo**: una variable especial que *sabe* cuándo cambia y notifica automáticamente a las partes de la aplicación que dependen de su valor.
Son una forma eficiente de **gestionar el estado y las dependencias** sin propagar manualmente los cambios.

Cuando un signal cambia:

* Los **effects** que lo usan se vuelven a ejecutar.
* Los **computed** que lo derivan recalculan su valor.
* Los suscriptores reciben una notificación.

Todos los signals, computeds y effects cuentan con un **método `destroy()`** para limpiar sus suscripciones y liberar recursos cuando ya no se usan.

---

## Tipos de Signals en el sistema

### 1. `signal`

Estado reactivo básico que guarda un valor y permite **leerlo**, **actualizarlo** y **suscribirse a sus cambios**.

```ts
import { signal } from "boxles/core";

const count = signal(0);

// Lectura
console.log(count()); // 0

// Actualización
count.set(5);
count.update((c) => c + 1);

// Suscripción manual
const unsubscribe = count.subscribe((value) => {
  console.log("Nuevo valor:", value);
});

// Limpieza de suscripción
unsubscribe();

// Limpieza completa del signal
count.destroy();
```

📌 Ideal para: datos que cambian con el tiempo y requieren notificación a múltiples partes.

---

### 2. `computed`

Un valor **derivado** de uno o más signals, recalculado automáticamente cuando cambian sus dependencias.

```ts
import { signal, computed } from "boxles/core";

const price = signal(10);
const quantity = signal(2);

// Se especifican dependencias para un tracking explícito
const total = computed([price, quantity], () => price() * quantity());

console.log(total()); // 20
price.set(15);
console.log(total()); // 30 (recalculado automáticamente)

// Limpieza cuando ya no se use
total.destroy();
```

📌 Ideal para: valores dependientes que no quieres recalcular manualmente.

---

### 3. `effect`

Ejecuta automáticamente una función cada vez que cambien los signals que usa.

```ts
import { signal, effect } from "boxles/core";

const name = signal("Alice");

const stop = effect([name], () => {
  console.log(`Hola, ${name()}`);
});

name.set("Bob"); // "Hola, Bob"

// Limpieza de efecto
stop();
```

📌 Ideal para: lógica secundaria como renderizados, logs o sincronización externa.

---

### 4. `persistentSignal`

Un signal que **recuerda su valor** entre recargas, usando un almacenamiento persistente (`localStorage`, `indexedDB`, etc.).

```ts
import { persistentSignal } from "boxles/core";

// key, valor inicial y opciones
const theme = persistentSignal("theme", "light", { storage: localStorage });

theme.set("dark");
// Al recargar la página, seguirá siendo "dark"
```

📌 Ideal para: configuraciones o datos que deben sobrevivir entre sesiones.

---

## Acceso reactivo vs estático a propiedades

Una característica clave de los signals en **Boxels** es que los objetos dentro de un signal exponen **sus propiedades también como signals**, gracias al uso de *Proxies*.

Esto permite elegir entre dos formas de acceso:

### 🔹 Acceso estático (snapshot del valor actual)

```ts
const user = signal({ name: "Alice", age: 25 });

// Acceso al valor completo (no reactivo)
console.log(user()); // { name: "Alice", age: 25 }

// Acceso estático a una propiedad
console.log(user().name); // "Alice"
```

➡️ Aquí se obtiene el valor en ese momento, pero **no se actualiza automáticamente** si cambia.

---

### 🔹 Acceso reactivo (propiedad como signal hijo)

```ts
// Acceso reactivo a una propiedad
const name = user.name;

console.log(name()); // "Alice"

// Responde automáticamente a cambios
user.set({ name: "Bob", age: 25 });
console.log(name()); // "Bob"
```

➡️ Aquí `user.name` es un **signal hijo**: se mantiene sincronizado con el padre y notifica suscripciones.

---

📌 **Resumen**

* `user().name` → valor estático, snapshot en el momento.
* `user.name()` → acceso reactivo, se actualiza automáticamente cuando cambie.

Esto permite un control muy flexible: usar lectura directa para operaciones puntuales y signals hijos cuando se necesita reactividad granular.

---

## Características clave

* **Reactividad automática**: `computed` y `effect` detectan y reaccionan a cambios sin suscripción manual.
* **Suscripción directa**: Todos los signals permiten `subscribe((valor) => {...})` y devuelven una función `unsubscribe`.
* **Destrucción controlada**: `destroy()` limpia efectos, suscripciones y dependencias.
* **Scheduler interno**: El sistema usa un **gestor de tareas** para agrupar y optimizar actualizaciones, evitando ejecuciones redundantes y mejorando el rendimiento en cambios masivos.
* **Persistencia opcional**: `persistentSignal` guarda datos en almacenamiento local sin esfuerzo adicional.
* **Optimización automática**: Solo recalcula lo estrictamente necesario.

---

## Flujo interno simplificado

1. **Cambio en un signal**
2. Se encola en el **scheduler** para evitar ráfagas de actualizaciones
3. El scheduler procesa la cola y actualiza:

   * Computeds dependientes
   * Effects asociados
   * Suscriptores directos
4. La UI y la lógica reaccionan con datos frescos.

![Boxels Signals](./assets/signals.svg)
