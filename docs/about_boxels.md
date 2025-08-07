# Boxels — Propósito, Motivaciones y Principios de Diseño

## Introducción

Boxels es una alternativa moderna y liviana a frameworks como Angular o React, que tienden a introducir complejidad innecesaria, consumo elevado de recursos, y estructuras rígidas difíciles de adaptar. Este proyecto nace del deseo de simplificar la forma de construir aplicaciones web sin renunciar a las herramientas que hacen eficiente el desarrollo: reactividad, composición declarativa y herramientas integradas.

---

## Motivaciones del Proyecto

Las herramientas actuales de frontend, aunque poderosas, presentan varios problemas recurrentes:

- **Ciclo de vida no predecible** (como ocurre en React con sus efectos y reconciliación).
- **Arquitecturas excesivamente rígidas o poco guiadas** (como en Angular o React respectivamente).
- **Curvas de aprendizaje innecesarias debido a herramientas no cohesionadas**.
- **Consumo elevado de memoria y ciclos de CPU** en estructuras y patrones complejos.
- **Acoplamiento alto entre las piezas del sistema**, lo que dificulta la personalización.

Boxels plantea una solución equilibrada, partiendo de la idea de que el desarrollador necesita **control explícito** sobre los procesos, sin renunciar a la expresividad y eficiencia de una arquitectura declarativa.

---

## Principios de Diseño

Boxels está construido bajo un conjunto de principios claros:

### 1. Bajo Acoplamiento, Alta Componibilidad

Cada módulo de la librería (reactividad, hooks, formularios, routing, etc.) está diseñado para poder **funcionar de manera independiente**, permitiendo reemplazos, extensiones y personalizaciones sin romper el sistema principal.

Los módulos pueden interactuar entre sí únicamente a través de **interfaces explícitas**, lo que facilita la extensión mediante plugins o integraciones externas.

### 2. Ciclo de Vida Explícito

A diferencia de otras librerías que ocultan o sobrecargan el ciclo de vida, Boxels implementa un ciclo de vida **declarativo y predecible**, con fases claras como:

- `$lifecycle:mount`
- `$lifecycle:unmount`

Esto permite mayor control y evita efectos colaterales inesperados.

### 3. Equilibrio entre Declarativo y Lógico

Boxels promueve una arquitectura donde la lógica del sistema se expresa de manera declarativa a través de JSX, pero con herramientas que permiten una **composición programática clara**, sin ocultar el flujo real de ejecución.

### 4. Tipado Estricto y API Estable

Toda la librería está escrita en TypeScript con tipado estricto, ofreciendo una **API robusta y predecible**, sin recurrir a tipos mágicos ni inferencias ambiguas.

### 5. Bajo Consumo

Desde el diseño de su sistema de señales hasta la estrategia de renderizado y ciclo de vida, Boxels prioriza un **uso eficiente de memoria y CPU**. Esto se traduce en mejores tiempos de respuesta, menor carga inicial y mejor rendimiento general.

---

## Qué Ofrece Boxels

Boxels proporciona un conjunto de herramientas listas para usarse, sin necesidad de dependencias externas:

### JSX Personalizado

Un motor de JSX liviano y propio, diseñado para funcionar con el sistema reactivo nativo de la librería, sin transformaciones complejas ni tiempo de compilación adicional.

### Sistema Reactivo Integrado

Con primitivas como:

- `signal` — para estado reactivo
- `computed` — para derivaciones automáticas
- `effect` — para efectos secundarios controlados
- `persistentSignal` — para sincronizar estado con almacenamiento

### Hooks Estandarizados

Un sistema de hooks reutilizables y simples, que pueden usarse dentro o fuera de Boxels, diseñados para extender el comportamiento sin acoplarse a una estructura fija.

### Sistema de Ciclo de Vida

Todos los componentes y elementos pueden suscribirse a eventos de ciclo de vida específicos, lo que facilita:

- Inicialización de recursos
- Limpieza controlada
- Subscripciones temporales

### Router Integrado

Routing para SPAs con soporte para:

- Rutas anidadas
- Parámetros dinámicos
- Historial y estado
- Lazy loading de vistas

### Formularios Reactivos

Sistema integrado para construir formularios declarativos con validación reactiva, lógica condicional y manejo de estado desacoplado del DOM.

---

## Extensibilidad

Boxels está diseñado desde su núcleo para ser extendido:

- Puedes crear **hooks personalizados**, **eventos de ciclo de vida**, o **comportamientos compartidos** sin tocar el core.
- La arquitectura permite el reemplazo de sistemas internos (por ejemplo, el sistema de señales o el enrutador), siempre que se respeten las interfaces.
- Soporta integración sencilla de plugins, middlewares y utilidades adicionales, que interactúan sin acoplarse directamente.

Ejemplos de extensibilidad:

- Crear un `plugin-analytics` que escuche al ciclo de vida `mount` y envíe métricas.
- Definir un `hook:usePermission` para validar permisos de usuario en componentes críticos.
- Reemplazar el cliente HTTP base por uno compatible con interceptores.

---

## Adaptabilidad

Boxels **no impone una estructura rígida**. Proporciona una base sólida y una serie de herramientas que pueden usarse en conjunto o de forma aislada.

Casos de uso:

- Integración parcial en una aplicación existente (por ejemplo, solo el sistema de formularios).
- Proyectos nuevos con control total sobre la estructura de componentes, estado y navegación.
- Sistemas complejos que requieren desacoplamiento entre módulos funcionales.

---