# **Boxels `.box` – Filosofía y Diseño**

## **¿Qué es un archivo `.box`?**

Un archivo `.box` es una unidad de componente modular en **Boxels** que agrupa en un solo lugar:

* **Lógica reactiva** (`<script>`)
* **Template declarativo** (HTML/JSX-like)
* **Estilos Scoped** (`<style>`)

Su diseño se inspira en conceptos modernos como **Single-File Components (SFC)**, pero introduce:

* **Compatibilidad con JSX**, en lugar de un template compilado exclusivo.
* **Independencia del motor JSX**: Puedes usar React, Preact, Solid, Boxels JSX, o cualquier implementación que soporte JSX automático.
* **Extensibilidad**: No está limitado a la extensión `.box`. Puedes cambiarla a `.bx`, `.component`, o lo que desees.

---

## **¿Por qué creamos `.box`?**

1. **Reducir fricción entre lógica, UI y estilos**
   Los desarrolladores modernos enfrentan plantillas fragmentadas entre múltiples archivos: `.jsx` para lógica, `.css` para estilos, y hooks o librerías extra para reactividad. `.box` centraliza todo en un único archivo sin sacrificar **claridad**.

2. **Mantener la familiaridad del JSX**
   JSX es un estándar de facto en el frontend. En lugar de reinventar la rueda, `.box` adopta JSX, lo extiende y le agrega mejoras como:

   * **Eventos declarativos** con `$on:click`
   * **Props tipadas** mediante directivas (`@props`)
   * **Estilos scoped sin CSS-in-JS**

3. **Compatibilidad sin vendor lock-in**
   `.box` **no está atado a Boxels JSX**. Puedes integrarlo en un proyecto existente con React, Preact, o Solid, sin romper tu stack.

4. **Optimización para Vite**
   Gracias a `boxComponentPlugin`, el flujo es:

   * Parseo de `<script>`, template y estilos.
   * Transformación del template a JSX válido (usando `esbuild`).
   * Scoped CSS automático.
   * Hot Module Replacement (HMR) out-of-the-box.

---

## **Estructura básica de un archivo `.box`**

```box
<script>
import { signal } from 'boxels/core';

const counter = signal(1);

function handleClick() {
    counter.update(c => c + 1);
}
</script>

<h1 class={styles.title}>Soy un box</h1>
<h2>{counter}</h2>
<p>¡Hola! Mi nombre es {props.name}.</p>
<button type="button" $on:click={handleClick}>Actualizar contador</button>

<style lang="scss">
.title {
    font-size: 4rem;
}
</style>
```

---

## **¿Por qué es flexible por naturaleza?**

* Puedes **usar otra extensión** (por ejemplo, `.bx`, `.sfc`), simplemente ajustando la opción `extensions` en el plugin de Vite:

```ts
boxComponentPlugin({
  extensions: ['.bx'], // o cualquier extensión
  jsxImport: 'react' // o 'preact', 'solid-js', etc.
});
```

* Puedes **usar otro motor JSX**:

```ts
boxComponentPlugin({
  jsxImport: 'preact' // en lugar de Boxels JSX
});
```

Esto significa que `.box` **no te encierra en un ecosistema cerrado**; es agnóstico al motor de renderizado.

---

## **¿Cómo se integra con Vite?**

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { boxComponentPlugin } from 'boxels/plugins';

export default defineConfig({
  plugins: [
    boxComponentPlugin({
      extensions: ['.box'], // Otras extensiones personalizadas
      jsxImport: 'react'    // Puedes cambiarlo a tu motor preferido
    })
  ]
});
```

Después de esto, puedes importar componentes `.box` en tu aplicación:

```tsx
import BoxComponent from './MyComponent.box';

mount(document.body, <BoxComponent name="Jheivy" />);
```

---

## **Principales beneficios**

✅ Centralización: lógica, template y estilos en un solo archivo.
✅ Soporte para **scoped CSS** nativo sin hacks.
✅ **Compatibilidad con cualquier JSX runtime** (React, Preact, Solid, Boxels).
✅ **Hot Reloading** listo gracias al plugin de Vite.
✅ **No dependencias innecesarias**, todo en TypeScript.
✅ Extensible: controla extensión y comportamiento con opciones en el plugin.

---

## **Casos de uso ideales**

* Equipos que aman JSX pero quieren simplicidad tipo Svelte.
* Proyectos donde la **modularidad y el aislamiento** son críticos.
* Aplicaciones híbridas que usan Boxels junto con React/Preact sin conflictos.
* Quienes desean **componentes declarativos con CSS scoped sin CSS-in-JS**.

---

> `.box` nace para unir **lo mejor del mundo JSX y los Single-File Components**, con una filosofía abierta y flexible. No estás obligado a usar solo Boxels; la interoperabilidad está en el ADN de `.box`.
