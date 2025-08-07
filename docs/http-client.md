# http-client.ts: Cliente HTTP avanzado para Boxels

Este documento explica el funcionamiento y las capacidades del archivo `src/core/client/http-client.ts`, que implementa un cliente HTTP robusto y flexible para el framework Boxels.

## Propósito

El módulo `http-client.ts` proporciona una API para realizar solicitudes HTTP con características avanzadas como:
- Reintentos automáticos con backoff exponencial
- Soporte para caché configurable (localStorage/sessionStorage)
- Transformación y post-procesamiento de respuestas
- Cancelación y timeout
- Seguimiento de progreso de descarga
- API utilitaria para métodos HTTP comunes (GET, POST, etc.)

## Tipos y opciones principales

### Tipos de métodos y respuestas
- `HttpMethod`: `'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'`
- `ResponseType`: `'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData'`

### Opciones de configuración (`HttpClientOptions`)
- `method`: Método HTTP a usar
- `headers`: Encabezados personalizados
- `body`: Cuerpo de la solicitud (soporta JSON, FormData, Blob)
- `retries`: Número de reintentos ante fallo
- `timeout`: Tiempo máximo de espera (ms)
- `signal`: Permite cancelar la solicitud externamente
- `onProgress`: Callback para progreso de descarga
- `cache`: Habilita caché de respuesta
- `cacheTtl`: Tiempo de vida del caché (ms)
- `cacheStorage`: `'storage'` (localStorage) o `'session'` (sessionStorage)
- `responseType`: Tipo de respuesta esperado
- `transform`: Función para transformar la respuesta cruda
- `preRequest`: Hook para modificar la configuración antes de enviar
- `postResponse`: Hook para modificar la respuesta antes de retornar
- `keepalive`: Mantiene la conexión viva (útil en eventos como `unload`)

### Estructura de respuesta (`HttpResponse`)
- `ok`: Indica si la respuesta fue exitosa
- `status`: Código de estado HTTP
- `data`: Datos procesados de la respuesta
- `error`: Mensaje de error (si aplica)
- `fromCache`: Indica si la respuesta provino de caché
- `headers`: Encabezados de respuesta
- `url`: URL final de la solicitud
- `duration`: Duración total de la solicitud (ms)

## Funcionamiento interno

### 1. Caché
- Si `cache` está habilitado, se busca una respuesta válida en el almacenamiento configurado.
- Si existe y no ha expirado, se retorna directamente.
- Si ha expirado, se elimina.

### 2. Reintentos y timeout
- Se realizan hasta `retries` intentos en caso de error, con espera exponencial entre cada uno.
- Se usa `AbortController` para cancelar la solicitud si excede el `timeout`.

### 3. Progreso de descarga
- Si se provee `onProgress` y la respuesta tiene cuerpo, se lee el stream y se notifica el avance.

### 4. Procesamiento de respuesta
- Según `responseType`, se procesa la respuesta (`json`, `text`, `blob`, etc.).
- Se puede aplicar una función `transform` para modificar los datos antes de retornarlos.
- Si la respuesta es exitosa y el caché está habilitado, se almacena.
- Se puede aplicar un hook `postResponse` para modificar la respuesta final.

### 5. API utilitaria
Se expone un objeto `http` con métodos abreviados:
- `http.get(url, opts)`
- `http.post(url, body, opts)`
- `http.put(url, body, opts)`
- `http.patch(url, body, opts)`
- `http.delete(url, opts)`

## Ejemplo de uso

```ts
import { http } from 'src/core/client/http-client';

// GET simple
const res = await http.get('https://api.ejemplo.com/data');
if (res.ok) {
  console.log(res.data);
}

// POST con cuerpo y caché
const res2 = await http.post('https://api.ejemplo.com/items', { nombre: 'Boxel' }, {
  cache: true,
  cacheTtl: 30000,
  transform: (data) => data.resultado,
});
```

## Notas avanzadas
- El sistema de caché es opcional y configurable por endpoint.
- Permite integración con hooks para modificar la solicitud o la respuesta.
- Soporta cancelación y timeout nativo vía `AbortController`.
- El seguimiento de progreso es útil para descargas grandes.

---