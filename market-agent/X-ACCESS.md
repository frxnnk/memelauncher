# Acceso opcional a X

Documentación oficial revisada el **12 de septiembre de 2026**. En el proceso
actual no están presentes `X_BEARER_TOKEN` ni `TWITTER_BEARER_TOKEN`. No se verificó
una app aprobada, saldo, acceso efectivo o límite de gasto de la cuenta.

La [tarifa pública](https://docs.x.com/x-api/getting-started/pricing) consultada
indica USD 0,005 por post leído y USD 0,010 por usuario leído. Deben contrastarse
las condiciones efectivas de la cuenta antes de habilitar consumo. Este adaptador
omite expansiones de usuarios y consulta una sola página de 10 posts por defecto,
con máximo configurable de 100; no programa llamadas recurrentes.

## Uso cuando el operador habilite una lectura paga

Configurar el Bearer en una variable de entorno del proceso; no ponerlo en el
código, archivos de resultados ni argumentos de línea de comandos. El adaptador
no extrae credenciales del navegador ni convierte una sesión de X en acceso API.

```powershell
node market-agent/followup.mjs x-search --story u2-unwanted-album-resurfacing --query '"Songs of Innocence" -is:retweet' --max-results 10 --out captura-x.json --allow-paid-read
```

El archivo de salida debe ser nuevo y su directorio debe existir. Después de
revisar el resultado y su cobertura, puede incorporarse a la memoria local:

```powershell
node market-agent/followup.mjs import captura-x.json
```

Una página con `nextToken`, errores parciales o filas descartadas sigue siendo
parcial. `newestId` describe esa página; no acredita que se hayan recibido todas
las páginas ni se guarda como cursor confirmado. La paginación y cualquier nuevo
consumo son decisiones explícitas del operador.

El adaptador usa GET `/2/tweets/search/recent`, consultas de hasta 512 caracteres,
`tweet.fields=created_at,public_metrics,author_id` y timeout de 12 segundos. La
documentación oficial tiene diferencias entre la referencia generada y el
quickstart; se siguió el quickstart para `tweet.fields`. La compatibilidad real
con la app aún requiere una prueba autenticada autorizada.

Fuentes: [recent search](https://docs.x.com/x-api/posts/search/quickstart/recent-search),
[referencia del endpoint](https://docs.x.com/x-api/posts/search-recent-posts),
[límites](https://docs.x.com/x-api/fundamentals/rate-limits),
[Bearer tokens](https://docs.x.com/fundamentals/authentication/oauth-2-0/bearer-tokens).

## Qué queda fuera

No hay proceso continuo, reglas de filtered stream, scheduler ni notificaciones
externas activadas. No se hicieron consultas pagas durante la implementación.
La lectura asistida con navegador sigue disponible para investigar y generar
capturas sin invocar este adaptador. El análisis de lenguaje y selección de
interpretaciones sigue a cargo del agente; el comparador detecta diferencias
documentales y no pretende medir originalidad cultural automáticamente.
