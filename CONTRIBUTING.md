# Guía de Contribución al Proyecto

¡Gracias por tu interés en contribuir a este proyecto!
Siguiendo estas pautas, podremos mantener una colaboración ordenada, eficiente y positiva para toda la comunidad.

---

## Cómo Contribuir

### 1. Reportar Problemas (Issues)

Si encuentras un **bug** o comportamiento inesperado:

* Abre un **issue** en el repositorio.
* Incluye una **descripción clara** del problema.
* Explica los **pasos para reproducirlo**.
* Adjunta **capturas de pantalla** o **logs de error** si es posible.
* Indica la **versión** y el **entorno** donde ocurre (SO, navegador, etc.).

---

### 2. Sugerir Mejoras

Si tienes ideas para mejorar el proyecto:

* Abre un **issue** con la etiqueta `enhancement`.
* Explica la propuesta con detalles:

  * **Objetivo** de la mejora.
  * **Beneficios** para el proyecto.
  * Posibles **desventajas o riesgos**.
* Si es posible, sugiere un **borrador de implementación**.

---

### 3. Contribuir con Código

Para enviar cambios de código:

1. **Haz un fork** del repositorio.
2. **Crea una rama** para tu cambio:

   ```bash
   git checkout -b feature/nueva-funcionalidad
   ```
3. **Realiza los cambios y haz commits claros**:

   ```bash
   git commit -m "Agrega nueva funcionalidad X"
   ```
4. **Sube tus cambios a tu repositorio**:

   ```bash
   git push origin feature/nueva-funcionalidad
   ```
5. **Abre un Pull Request** en el repositorio principal.
6. En el PR:

   * Describe el cambio.
   * Indica si hay dependencias nuevas.
   * Incluye pruebas o ejemplos si aplica.

---

### 4. Estilo y Calidad del Código

Para mantener la coherencia del código:

* Usa **nombres descriptivos** para variables, funciones y clases.
* Comenta el código donde sea necesario.
* Aplica el **formato de código** definido por el proyecto (por ejemplo, Prettier o ESLint).
* Evita introducir **código no utilizado** o **console.log** en PRs.
* Asegúrate de que el código pase todas las **pruebas automáticas** antes de enviar.

---

### 5. Revisión y Aprobación

* Los **Pull Requests** serán revisados por los mantenedores del proyecto.
* Responde a los comentarios y realiza los cambios solicitados.
* La aprobación puede requerir que al menos **dos revisores** acepten el PR (dependiendo de la política del repositorio).
* Los PRs grandes pueden ser divididos en partes más pequeñas para su revisión.

---

### 6. Pruebas y Cobertura

* Si añades nuevas funciones, incluye **pruebas unitarias** y/o **pruebas de integración**.
* Asegúrate de que **todas las pruebas existentes pasen** antes de enviar tu PR.
* Si el proyecto usa cobertura de código (ej. `vitest`), mantén o mejora el porcentaje actual.

---

### 7. Documentación

* Actualiza la documentación si tu cambio introduce o modifica funcionalidades.
* Incluye ejemplos de uso si es relevante.
* Si es una API o librería, actualiza las **definiciones de tipos** y comentarios JSDoc/TypeDoc.

---

### 8. Buenas Prácticas de Git

* Usa **commits atómicos**: un commit = un cambio lógico.
* Prefiere **mensajes de commit en imperativo**:

  * ✅ `"Corrige error en validación de formularios"`
  * ❌ `"Corregido error"`
* Evita *merge commits* innecesarios; usa `rebase` si corresponde.

---

## Código de Conducta

Este proyecto sigue el [Código de Conducta](CODE_OF_CONDUCT.md).
Al contribuir, aceptas y te comprometes a respetar estas reglas de convivencia.

---

## Reconocimientos

* Todas las contribuciones son bienvenidas: código, documentación, reportes y sugerencias.
* Reconoceremos públicamente a los colaboradores que aporten mejoras significativas.
