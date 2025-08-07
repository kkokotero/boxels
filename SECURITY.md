# **Política de Seguridad**

## 1. Introducción

Esta política define los lineamientos para la **recepción**, **evaluación**, **gestión** y **divulgación responsable** de vulnerabilidades de seguridad en los productos y servicios desarrollados por **Boxels**.
Su propósito es garantizar una comunicación clara con investigadores, usuarios y partes interesadas, así como mantener la seguridad y la integridad del software.

---

## 2. Alcance

Esta política aplica a:

* Todo el software desarrollado y mantenido oficialmente por **Boxels**.
* Servicios, APIs, librerías y componentes relacionados.
* Documentación técnica y herramientas asociadas.

No aplica a software de terceros no administrado por nuestro equipo, aunque podamos recomendar medidas para mitigar riesgos.

---

## 3. Reporte de Vulnerabilidades

**Canales de reporte:**

* **GitHub (público)**: Abrir un *issue* en el repositorio oficial [Boxels Issues](https://github.com/kkokotero/boxels/issues) para problemas no sensibles.

**Tiempos de respuesta:**

| Acción                          | Tiempo máximo            |
| ------------------------------- | ------------------------ |
| Acuse de recibo                 | 48 horas                 |
| Primera actualización de estado | 5 días hábiles           |
| Comunicación de solución o plan | Variable según severidad |

---

## 4. Proceso de Manejo de Vulnerabilidades

Nuestro flujo sigue las directrices de **ISO/IEC 30111**:

1. **Recepción** del reporte y confirmación al investigador.
2. **Validación** técnica del hallazgo y asignación de severidad (según CVSS v3.1).
3. **Análisis de impacto** y versiones afectadas.
4. **Desarrollo de la corrección** (hotfix o actualización planificada).
5. **Pruebas de regresión y QA** para evitar impactos colaterales.
6. **Publicación de parche** y documentación técnica.
7. **Divulgación coordinada** con el investigador (si aplica).

---

## 5. Política de Divulgación Responsable

* No divulgar públicamente los detalles técnicos antes de que el parche esté disponible.
* El investigador puede solicitar **divulgación conjunta** una vez liberada la actualización.
* Reconoceremos la contribución en las notas de versión, salvo que el investigador solicite anonimato.
* Vulnerabilidades críticas recibirán un **CVE** (Common Vulnerabilities and Exposures) emitido en coordinación con MITRE.

---

## 6. Mejores Prácticas Recomendadas

Para reducir riesgos de seguridad, recomendamos:

* Mantener siempre la última versión estable de **Boxels**.
* Activar cifrado de extremo a extremo en comunicaciones (HTTPS/TLS).
* Habilitar **autenticación multifactor (MFA)** en cuentas críticas.
* Aplicar el principio de **mínimos privilegios** en permisos.
* Revisar y auditar dependencias con herramientas como `npm audit` o `OWASP Dependency-Check`.
* Realizar copias de seguridad cifradas de forma periódica.
* Configurar sistemas de detección de intrusos (IDS/IPS).

---

## 7. Contacto de Seguridad

Para cualquier comunicación relacionada con vulnerabilidades:

* **GitHub**: [https://github.com/kkokotero/boxels/issues](https://github.com/kkokotero/boxels/issues)
* **Política de seguridad actualizada**: [Security.md](https://github.com/kkokotero/boxels/blob/main/SECURITY.md)

---

## 8. Anexo — Ciclo de Vida de un Reporte (Diagrama)


![Boxels Security](./misc/security.png)

---

## 9. Anexo — Severidad (CVSS v3.1)

| Puntuación | Severidad |
| ---------- | --------- |
| 0.1–3.9    | Baja      |
| 4.0–6.9    | Media     |
| 7.0–8.9    | Alta      |
| 9.0–10.0   | Crítica   |

Aquí tienes una **plantilla oficial de reporte de vulnerabilidades** en **Markdown**, alineada con la política de seguridad que te preparé antes, lista para que los investigadores puedan copiarla y enviarla:

---

# Plantilla de Reporte de Vulnerabilidades — Boxels

> **Nota:** No incluyas información sensible en canales públicos.

---

## Información del Reporte

**Título de la vulnerabilidad:**
*(Ej. “Ejecución remota de código en API de autenticación”)*

**Fecha del descubrimiento:**
`AAAA-MM-DD`

**Investigador(es):**
*(Nombre o alias, opcional si desea anonimato)*

**Versión afectada:**
*(Incluye versión exacta o rango de versiones afectadas)*

**Entorno donde se detectó:**

* [ ] Producción
* [ ] Desarrollo
* [ ] Pruebas / Local
* [ ] Otro: \_\_\_\_\_\_\_\_\_\_\_

---

##  Descripción Técnica

**Resumen breve:**
*(Explica en 1-3 líneas en qué consiste el problema)*

**Detalles técnicos:**
*(Describe paso a paso el problema y por qué es una vulnerabilidad)*

**Vector de ataque:**

* [ ] Local
* [ ] Remoto
* [ ] Físico
* [ ] Otro: \_\_\_\_\_\_\_\_\_\_\_

**Severidad estimada (CVSS v3.1):**
*(Si sabes calcularla, indícalo. Ej.: 9.8/Crítica)*

---

## Pasos para Reproducir

1.
2.
3.

---

## Evidencias / Pruebas de Concepto

*(Capturas de pantalla, logs, requests HTTP, scripts de prueba, etc.)*
*(En caso de código, adjuntarlo en bloque `code` o como archivo)*

---

## Impacto Potencial

*(Explica qué podría pasar si la vulnerabilidad no se corrige)*

---

## Mitigación Propuesta (opcional)

*(Sugerencias para resolver o reducir el riesgo mientras se prepara un parche oficial)*

---

## Confirmación

* [ ] Confirmo que este reporte es **original** y no copiado de otra fuente.
* [ ] Acepto que Boxels gestione este reporte siguiendo la **Política de Seguridad** publicada.

---

**Contacto de seguimiento (opcional):**
*(Email o usuario de GitHub para recibir actualizaciones)*