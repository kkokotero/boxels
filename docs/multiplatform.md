# Documentación técnica de `multiplatform`

Este documento describe la **arquitectura**, **ciclo de vida**, **patrones de uso** y **aspectos técnicos** del módulo `src/multiplatform` de **Boxels**.

## Estructura del módulo

El directorio `src/multiplatform` está organizado en **componentes reutilizables** y **utilidades multiplataforma**, diseñados para **abstraer las diferencias entre entornos** (web, móvil, escritorio) y ofrecer una **API unificada** para el desarrollador.

### Componentes y utilidades disponibles

* **Camera**
  Proporciona acceso a la cámara del dispositivo mediante el hook `useCamera`.
  Permite capturar imágenes, manejar flujos de video en tiempo real y controlar parámetros como resolución, orientación y permisos.

* **httpClient**
  Cliente HTTP multiplataforma accesible mediante `httpClient` o el alias `http`.
  Compatible con métodos estándar (`GET`, `POST`, `PUT`, `DELETE`), soporte para **interceptores de petición y respuesta**, manejo de errores centralizado y adaptadores para entornos específicos.

* **notifier**
  Sistema de notificaciones unificado expuesto mediante `notify`.
  Soporta notificaciones nativas (móviles y escritorio), personalizadas en la interfaz y asincrónicas.
  Incluye opciones para duración, prioridad y acciones asociadas.

* **store**
  Manejo de almacenamiento local multiplataforma a través de `store`.
  Compatible con almacenamiento persistente (IndexedDB, SQLite, filesystem) y almacenamiento en memoria para datos temporales.

---

## Arquitectura y compatibilidad multiplataforma

* **Entornos soportados**

  * **Web**: Implementaciones nativas del navegador.
  * **Móvil**: Integración mediante **Ionic** y plugins de Capacitor.
  * **Escritorio**: Integración mediante **Electron**, aprovechando APIs del sistema operativo.

* **Carga perezosa (Lazy Loading)**
  Los módulos se cargan **únicamente cuando son requeridos** por la plataforma en ejecución. Esto optimiza el peso final del bundle y mejora el tiempo de arranque.

* **Interfaces unificadas**
  Todas las implementaciones comparten **la misma interfaz pública**, permitiendo que el código de negocio sea agnóstico de la plataforma. Esto reduce el acoplamiento y favorece la **reusabilidad del código**.

* **Principios de diseño aplicados**

  * **Bajo acoplamiento**: El código que usa estas utilidades no necesita conocer detalles de la plataforma subyacente.
  * **Alta cohesión**: Cada módulo tiene una única responsabilidad bien definida.
  * **Escalabilidad**: Se pueden agregar nuevas plataformas o reemplazar implementaciones sin romper la API existente.