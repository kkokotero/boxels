# Documentación técnica de `src/core/client/forms`

Este documento describe la arquitectura, utilidades y patrones de uso del sistema de formularios reactivos de Boxels, incluyendo campos, formularios y formularios multi-paso.

## Estructura del módulo

El directorio `src/core/client/forms` contiene:

- `field.ts`: Campo individual reactivo, validable y persistente.
- `form.ts`: Formulario reactivo con múltiples campos y validación centralizada.
- `multi-step-form.ts`: Formulario dividido en pasos, cada uno con su propio esquema y estado.
- `index.ts`: Punto de entrada que reexporta todas las utilidades.

---

## 1. Campo reactivo (`Field`)

La clase `Field<T>` representa un campo de formulario con:
- Valor reactivo (`value`)
- Validación automática y configurable (debounce, fastFail, persistencia)
- Errores reactivos y estado de "tocado"
- Métodos para setear, resetear, validar, limpiar errores y destruir

### Ejemplo de uso

```ts
import { Field, createField } from 'boxels/core/client/forms';
import { Validator } from 'boxels/data';

const nombre = new Field('nombre', '', Validator.string().min(2).required());
nombre.set('Ana');
if (nombre.isValid) { /* ... */ }

// O con helper tipado
const edad = createField('edad', 0, Validator.number().min(0));
```

---

## 2. Formulario reactivo (`Form`)

La clase `Form<S>` gestiona un conjunto de campos (`Field`) definidos por un shape de validadores. Provee:
- Acceso tipado a todos los campos (`form.fields`)
- Validación centralizada y sincronizada
- Métodos para setear, parchear, resetear y obtener valores/errores
- Métodos para marcar todos los campos como tocados y destruir el formulario

### Ejemplo de uso

```ts
import { Form, createForm } from 'boxels/core/client/forms';
import { Validator } from 'boxels/data';

const shape = {
  nombre: Validator.string().min(2).required(),
  edad: Validator.number().min(0),
};
const form = new Form(shape, { nombre: 'Ana', edad: 25 });

form.fields.nombre.set('Juan');
form.validate();
if (form.isValid()) { /* ... */ }
```

---

## 3. Formularios multi-paso (`MultiStepForm`)

La clase `MultiStepForm<S>` permite gestionar formularios divididos en pasos, cada uno con su propio esquema y estado. Provee:
- Instancia de `Form` por cada paso (`stepForms`)
- Navegación segura entre pasos (con validación opcional)
- Métodos para validar, resetear y obtener valores de cada paso o de todo el formulario
- Hooks para reaccionar a cambios de paso

### Ejemplo de uso

```ts
import { MultiStepForm, createMultiStepForm } from 'boxels/core/client/forms';
import { Validator } from 'boxels/data';

const schemas = {
  personal: { nombre: Validator.string().required() },
  contacto: { email: Validator.email() },
};
const multi = createMultiStepForm(schemas, { personal: { nombre: 'Ana' } });

multi.next(); // Avanza si el paso actual es válido
multi.stepForms.personal.fields.nombre.set('Juan');
```

---

## 4. Integración y helpers

- `createField`, `createForm`, `createMultiStepForm`: helpers para instanciar con inferencia de tipos.
- `index.ts` reexporta todo para importación centralizada.

```ts
import { createForm, createMultiStepForm } from 'boxels/core/client/forms';
```

---

## Resumen

- **Campos**: Reactivos, validables, persistentes y con estado de interacción.
- **Formularios**: Gestión centralizada, validación y sincronización de errores.
- **Multi-step**: Formularios complejos divididos en pasos, con navegación y validación segura.
- **Helpers**: Instanciación tipada y sencilla.

Consulta la documentación de cada archivo para detalles avanzados y ejemplos específicos.
