![Boxels Logo](./misc/boxels.png)

# Boxels

[![npm version](https://img.shields.io/npm/v/boxels.svg)](https://www.npmjs.com/package/boxels)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Build](https://img.shields.io/github/actions/workflow/status/kkokotero/boxels/ci.yml)](https://github.com/kokkotero/boxels/actions)
[![Stars](https://img.shields.io/github/stars/kkokotero/boxels?style=social)](https://github.com/kkokotero/boxels)

`Boxels` es una librería frontend diseñada para desarrollar aplicaciones web modernas del lado del cliente.  
Está construida con `TypeScript` y enfocada en **bajo consumo**, **control total** y **excelente experiencia de desarrollo**.

Incluye un sistema reactivo propio, un motor optimizado de ciclo de vida y renderizado para **Single Page Applications (SPA)**, y una versión personalizada de `JSX` sin dependencias externas.

> ⚠️ Actualmente `Boxels` no soporta renderizado del lado del servidor (SSR).   Esta funcionalidad está en evaluación para futuras versiones.

> 📄 La documentación detallada y técnica de cada módulo se encuentra en la carpeta [`./docs/**`](./docs).  

> Este proyecto cuenta con un [Código de Conducta](./CODE_OF_CONDUCT.md). Por favor, revísalo antes de contribuir.

---

### Soporte Multiplataforma

Boxels incluye soporte para desarrollar aplicaciones multiplataforma mediante un módulo especial ubicado en [`boxels/multiplatform`](./src/multiplatform).

Este módulo proporciona wrappers y extensiones para funcionalidades nativas en:

* **Web**
* **Ionic (Capacitor)**
* **Electron**

Todas las plataformas comparten la misma semántica y API base. El sistema selecciona automáticamente la implementación adecuada en tiempo de ejecución.

Algunas funcionalidades incluidas:

* Acceso a cámara (`useCamera`)
* Almacenamiento clave-valor (`store`)
* Cliente HTTP con cancelación y transformaciones (`httpClient`)
* Notificaciones nativas (`notifier`)

> El módulo `multiplatform` está diseñado para ser extensible y respetar la filosofía de bajo acoplamiento de Boxels.


## Tabla de Contenidos

* [Instalación](#instalación)
* [Características](#características)
* [Inicio Rápido](#inicio-rápido)
* [Cómo Contribuir](#cómo-contribuir)
* [Colaboradores](#colaboradores)
* [Licencia](#licencia)

---

## Instalación

Instala Boxels usando npm:

```bash
npm install boxels
```

> Requiere Node.js v18 o superior.

---

## Características

* JSX personalizado sin dependencias externas.
* Sistema reactivo integrado: `signal`, `computed`, `effect`, `persistentSignal`.
* Componentes base: `<Show>`, `<For>`, `<Lazy>`, `<RouterOutlet>`, `<Fragment>`.
* Manejo de formularios con validación reactiva.
* Enrutador integrado con manejo de rutas, estado e historial.
* Ciclo de vida declarativo: `$lifecycle:mount`, `$lifecycle:unmount`, etc.
* Comunicación entre componentes mediante canales reactivos.
* Utilidades modernas: manejo de estilos, almacenamiento persistente, cliente HTTP con cancelación, entre otras.
* Cero dependencias externas innecesarias.

---

## Inicio Rápido

```tsx
import { mount } from 'boxels/dom';

const App = () => (
    <main>
        <h1>Hola desde Boxels 👋</h1>
    </main>
);

mount(document.body, App());
```

---

## Creando Componentes con `.box`

Boxels permite definir componentes de manera modular usando archivos `.box`, que combinan **lógica, template y estilos** en un solo archivo.

Ejemplo de componente:

```box
<script lang="ts">
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

### Características

* `<script>`: contiene la lógica del componente, incluyendo reactividad y funciones.
* HTML/JSX-like: template declarativo que se renderiza automáticamente.
* `{props}`: acceso a las propiedades pasadas al componente.
* `{styles}`: objetos de clases generadas automáticamente para estilos scoped.
* `$on:event`: binding declarativo de eventos (por ejemplo, `$on:click`).

### Uso en tu aplicación

```tsx
import BoxComponent from './components/MyBox.box';

mount(document.body, <BoxComponent name="Juan" />);
```

> Los estilos declarados en `<style>` se aplican de manera **scoped**, evitando colisiones con otros componentes.

### Integración con Vite

Para poder usar archivos `.box` en tu proyecto Vite, necesitas instalar e importar el plugin oficial de Boxels:

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { boxComponentPlugin } from 'boxels/plugins';

export default defineConfig({
  plugins: [
    boxComponentPlugin({
      // Opcional: personaliza extensiones o JSX import
      extensions: ['.box'],
      jsxImport: 'boxels'
    })
  ]
});
```

> Debido a su naturaleza, boxComponentPlugin permite usar cualquier tipo de JSX, ya sea React, Preact o incluso JSX personalizado. Esto facilita su integración en distintos proyectos y librerías que ya utilicen JSX, sin limitar tu flujo de desarrollo.

---

### ¿Por qué Box y más información?

Si quieres conocer **por qué nació Box**, su filosofía y la razón detrás de su diseño, hemos preparado documentación detallada en la carpeta:

```
./docs/**
```

En estos documentos encontrarás:

* **Motivación**: por qué surge la necesidad de un formato como `.box`.
* **Ventajas del enfoque**: modularidad, aislamiento de estilos, flujo declarativo.
* **Integración flexible**: aunque Boxels define su propia sintaxis JSX, **no estás limitado a ella**. El plugin oficial (`boxComponentPlugin`) es **agnóstico**, lo que significa que puedes usar:

  * React
  * Preact
  * SolidJS
  * O cualquier otro runtime JSX que prefieras.
* **Extensiones personalizables**: incluso puedes cambiar la extensión `.box` por otra que se adapte a tu flujo.

> Esto hace que Boxels sea **friendly** y fácil de integrar en proyectos existentes, sin imponer un ecosistema rígido.

Consulta la documentación completa en [`./docs/**`](./docs) para más detalles.

---

## Cómo Contribuir

¿Tienes ideas, mejoras o encontraste un bug? ¡Tu ayuda es bienvenida!
Sigue estos pasos para contribuir:

1. Revisa los [issues](https://github.com/kkokotero/boxels/issues) abiertos.
2. Haz un fork del repositorio.
3. Crea una rama con tu cambio:

   ```bash
   git checkout -b feature/mi-cambio
   ```
4. Realiza tus cambios y haz commit:

   ```bash
   git commit -m "feat: agrega nueva funcionalidad"
   ```
5. Haz push y abre un **Pull Request**.

Consulta la [guía de contribución](./CONTRIBUTING.md) para más detalles.

---

## Colaboradores

Agradecemos a todas las personas que han contribuido a Boxels:

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/kkokotero">
        <img src="https://github.com/kkokotero.png" width="100px;" alt="kkokotero"/>
        <br />
        <sub><b>kkokotero</b></sub>
      </a>
    </td>
  </tr>
</table>

¿Quieres aparecer aquí? ¡Envía tu PR!

---

## Licencia

Este proyecto está licenciado bajo la [MIT License](./LICENSE.txt).

