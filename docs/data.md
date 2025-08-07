# Documentación técnica de `src/data`

Este documento describe la arquitectura, utilidades y patrones de uso del módulo `src/data` de Boxels, siguiendo el estilo de los archivos de documentación del proyecto.

## Estructura del módulo

El directorio `src/data` está compuesto por:

- `storage.ts`: Abstracción y utilidades para almacenamiento local, de sesión y cookies.
- `validator.ts`: Sistema de validación tipado, extensible y con soporte para i18n.
- `index.ts`: Punto de entrada que reexporta las utilidades principales y la integración con Dexie (IndexedDB).

---

## 1. Almacenamiento tipado (`storage.ts`)

Define la interfaz `Store` para operaciones clave-valor tipadas y provee implementaciones para:

- **`storage`**: Basado en `localStorage` (persistencia permanente).
- **`session`**: Basado en `sessionStorage` (persistencia por sesión).
- **`cookies`**: Basado en cookies (útil para interoperabilidad backend o restricciones de almacenamiento).

### Ejemplo de uso

```ts
import { local } from 'boxels/data';

local.storage.set('usuario', { nombre: 'Ana' });
const usuario = local.storage.get<{ nombre: string }>('usuario');
local.session.clear();
local.cookies.delete('token');
```

---

## 2. Validador tipado y extensible (`validator.ts`)

Sistema de validación funcional, inspirado en Zod/Yup, con:
- Factories para tipos (`Validator.string()`, `Validator.number()`, ...)
- Métodos encadenables para reglas (`min`, `max`, `regex`, `required`, ...)
- Validación de estructuras (`shape`), arrays, enums, custom, etc.
- Soporte para i18n y mensajes personalizados
- Modos fast-fail y gather-all
- Errores detallados con path para estructuras anidadas

### Ejemplo de uso

```ts
import { Validator } from 'boxels/data';

const esquema = Validator.shape({
  nombre: Validator.string().min(2).required(),
  edad: Validator.number().min(0),
  email: Validator.email().optional(),
});

const errores = esquema('Ana', 25, 'ana@ejemplo.com'); // [] si es válido
const detallado = esquema.validateDetailed({ nombre: '', edad: -1 });
// [ { path: 'nombre', message: '...' }, { path: 'edad', message: '...' } ]
```

---

## 3. Integración y extensibilidad (`index.ts`)

El archivo `index.ts` reexporta:
- Todo lo de `dexie` (IndexedDB)
- Utilidades de almacenamiento y validación

Esto permite importar desde `boxels/data` todas las utilidades de datos del framework.

```ts
import { Validator, local } from 'boxels/data';
```

---

## Resumen

- **Almacenamiento**: API unificada y tipada para local/session/cookies.
- **Validación**: Sistema funcional, encadenable, con i18n y validación estructurada.
- **Integración**: Punto de entrada único para utilidades de datos.

Consulta la documentación de cada archivo para detalles avanzados y ejemplos específicos.
