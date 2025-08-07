# Documentación técnica de `src/components`

Este documento describe la arquitectura, ciclo de vida, patrones de uso y aspectos técnicos del módulo `src/components` de Boxels.

## Estructura del módulo

El directorio `src/components` está organizado en componentes reusables y utilidades:

- `show.ts`: Renderizado condicional reactivo (`<Show />`).
- `for.ts`: Renderizado reactivo de listas (`<For />`).
- `lazy.ts`: Carga perezosa de componentes (`<Lazy />`).
- `router-outlet.ts`: Integración con el sistema de rutas y renderizado dinámico.
- `utils.ts`: Utilidades para extracción de señales y dependencias.
- `index.ts`: Punto de entrada que reexporta todos los componentes.

---

## Componentes principales

### 1. `<Show />`
Renderiza condicionalmente su contenido según una o varias condiciones reactivas, funciones o valores.

```tsx
import { Show } from 'boxels/components';

<Show when={estado} fallback={<Cargando />}>¡Listo!</Show>
```

- `when`: condición (señal, función o valor; o array de ellas)
- `children`: contenido a mostrar si la condición es verdadera
- `fallback`: contenido alternativo si la condición es falsa

---

### 2. `<For />`
Renderiza listas de forma reactiva y eficiente, con soporte para claves y fallback.

```tsx
import { For } from 'boxels/components';

<For each={usuarios} track={u => u.id} fallback={<p>No hay usuarios</p>}>
  {(user, i) => <p>{user.nombre}</p>}
</For>
```

- `each`: señal, función o array de datos
- `children`: función que retorna el elemento a renderizar por item
- `track`: función para clave única (opcional)
- `fallback`: contenido si la lista está vacía

---

### 3. `<Lazy />`
Carga componentes de forma perezosa bajo distintas estrategias (inmediata, visibilidad, evento, timeout, condición, etc).

```tsx
import { Lazy } from 'boxels/components';

<Lazy loader={() => import('./MiComponente')} loading={<span>Cargando...</span>} />
```

- `loader`: función que retorna una promesa con el componente
- `loading`: contenido mientras carga
- `error`: contenido si ocurre un error
- `when`: estrategia de carga (ver docstring en código)

---

### 4. `<RouterOutlet />`
Punto de integración con el sistema de rutas de Boxels. Renderiza el componente correspondiente a la ruta actual y gestiona la carga perezosa y el ciclo de vida de rutas.

```tsx
import { RouterOutlet } from 'boxels/components';

<RouterOutlet config={miConfigDeRutas} />
```

---