# Radar de ideas: noticias, X e interpretaciones para lanzar

El radar parte de lo que ocurre en el mundo y de cómo se interpreta en X. Genera
varias ideas por evento y compara su pitch, qué hacen, por qué ahora, diferenciación,
esfuerzo de construcción, competencia y timing. La metadata viene después.

Una **brecha** es una oportunidad temprana y de interpretación. No necesita un token
existente, liquidez ni una comunidad consolidada. La actividad de otros pools sirve
para entender competidores; sus filtros nunca son requisitos de entrada para ideas.

## Flujo y archivos

### Pasada autónoma

```powershell
node market-agent/scout.mjs status
node market-agent/scout.mjs run
node market-agent/scout.mjs run --focus "Noticias de IA y personajes que surgen en X"
node market-agent/scout.mjs view
```

`scout.mjs` ejecuta un modelo real mediante la CLI de Codex instalada y su sesión
existente. Consume uso de esa cuenta; no requiere una clave nueva ni contrata APIs.
La sesión debe ser accesible desde el proceso que ejecuta Node. Se puede comprobar
con `codex -c model_reasoning_effort=high login status`. No copiar credenciales a este
repositorio. `RADAR_CODEX_BIN` permite indicar la ruta de un ejecutable de Codex.

El proceso realiza descubrimiento con búsqueda web, congela propuestas y fuentes,
consulta DEX Screener con las consultas elegidas por el modelo y pide una segunda
revisión sobre los resultados reales. Después valida las referencias y crea su
propio mapa e informe. No hay que preparar `concepts.json` ni importar un lote a mano.
`view` genera `output/market-agent/autonomous/latest-map.html` desde la última corrida
completa, sin repetir investigación ni modificar el archivo histórico.

Cada corrida guarda sus etapas, prompts, eventos del modelo, consumo informado,
evidencia, decisiones, memoria acumulada y hashes en
`output/market-agent/autonomous/run-.../`. `latest.json` señala únicamente una corrida
completa; una falla no reemplaza el último resultado válido. La memoria conserva
fuentes aunque no aparezcan en la siguiente muestra. Un lock evita corridas
simultáneas. Tras una interrupción abrupta, comprobar que no hay un escritor activo
antes de retirar un lock persistente. No borrar corridas fallidas para mejorar el historial.

Los límites por pasada son hasta 3 historias, 2–3 interpretaciones por historia,
6 consultas de competencia y dos llamadas al modelo. Cada etapa de modelo tiene
un máximo de 10 minutos, 6 MB de salida y 16 llamadas de búsqueda web. Una llamada
web puede agrupar consultas/aperturas; este límite no es un techo monetario ni de
tokens. No se reintentan automáticamente llamadas al modelo que fallan.

La CLI se inicia sin cargar la configuración de usuario y con shell, apps, plugins,
hooks, herramientas de navegador y delegación deshabilitados. Solo el orquestador
escribe los archivos de la corrida. No existe capacidad de token execution en este
camino. El proceso es una pasada bajo demanda: no instala ni activa un scheduler.

**Cobertura:** búsqueda web no equivale al feed completo de X ni a su API autenticada.
Cada fuente distingue lectura completa informada por el modelo de extractos de
búsqueda, y declara si pudo inspeccionar imágenes. Los eventos permiten auditar
las acciones, pero no son una verificación independiente de todas las afirmaciones.
La fecha con día solamente se conserva sin inventar hora. La ausencia de posts de
X no impide proponer una hipótesis temprana apoyada en noticias; queda señalada como
recepción social pendiente. Un visual esencial sin inspeccionar o solo snippets
degradan una propuesta a `REWORK`. Se puede abstener de proponer por completo.

Validación: `node --test market-agent/scout.test.mjs`. Estas pruebas verifican el
circuito y sus límites, no que el modelo tenga mejor criterio que una persona.

### Curación asistida anterior

1. Investigar noticias y expresiones culturales actuales siguiendo [AGENT.md](./AGENT.md).
2. Generar varias propuestas distintas por hecho y curarlas en `concepts.json`.
3. Validar y evaluar mediante `ideas.mjs`, con razones y datos pendientes, sin scores
   de éxito inventados.
4. Regenerar el mapa y congelar hipótesis y decisiones antes de resultados posteriores.
5. Preparar metadata local solo cuando corresponda desarrollar una idea elegida.

`map-social.json` y `map-market.json` conservan evidencia y sus timestamps.
`concepts.json` contiene las nuevas propuestas, con sus propios tiempos de creación.
El mapa distingue hechos, expresiones observadas, interpretaciones e hipótesis.
Una arista no demuestra causalidad económica ni rentabilidad.

Desde la raíz del workspace, con Node instalado y sin nuevas dependencias:

```powershell
node market-agent/build-map.mjs
```

El constructor usa las fuentes locales y las propuestas curadas; no refresca noticias
ni X. Regenera `output/market-agent/radar-map.html` y `map-data.json`, y guarda un
historial inmutable de hipótesis y decisiones en un directorio nuevo
`output/market-agent/ideas-<timestamp>-<uuid>/`. La visualización actual puede
sobrescribirse; el historial de decisiones no. El primer argumento permite elegir
otra ruta para la visualización.

## Tiempo y evaluación prospectiva

Se distinguen cuatro relojes: publicación del evento, primera observación por el
radar, primera observación de mercado y lanzamiento confirmado (`firstLaunchAt`).
La primera consulta que encuentra un pool no es la fecha de emisión. Los tiempos
desconocidos siguen `null`, sin sustituirlos por la fecha de otra observación.

`node market-agent/sightings.mjs observations.json` registra primeras observaciones
en archivos nuevos bajo `output/market-agent/sightings/`. Cada entrada requiere
`storyKey`, `title`, `sourceUrl`, `publishedAt` (fecha con zona o `null`),
`observedAt` y `context`: `new_to_radar` para una señal recién observada o
`known_before_tracking` si ya era conocida y su descubrimiento original no consta.
Las observaciones repetidas conservan la primera detección registrada; no la
reemplazan por la fecha de publicación. El historial conocido conserva `null`.
Este registro se alimenta explícitamente; no implementa un feed continuo de X.
El constructor contrasta `firstSeenAt` con el historial indicado por
`concepts.json.sightingsFile` y archiva esa evidencia junto con las propuestas.
Si otro proceso está escribiendo, `SIGHTINGS_BUSY` indica que se debe reintentar.
Tras una interrupción abrupta puede quedar un lock: inspeccionar que el escritor
ya no esté activo antes de retirarlo; no se elimina automáticamente.

Una idea nueva conserva su fecha real aunque use una noticia anterior. Las fuentes
mantienen sus timestamps históricos. El ejemplo de la mosca es retrospectivo y no
acredita que el sistema lo hubiera detectado antes del lanzamiento.

Para medir ventaja se conservan propuestas, decisiones y descartes antes de mirar
resultados futuros. No hay una tasa de aciertos conocida ni un modelo predictivo
entrenado. Las observaciones posteriores deben distinguir fallos de cobertura,
ausencia en una muestra y resultados realmente observados.

## Consulta de competidores

```powershell
node market-agent/cli.mjs scan --limit 3 --query CATGPT --query ANTHROPIG
node --test market-agent/analyze.test.mjs market-agent/collect.test.mjs
node --test market-agent/ideas.test.mjs
node --test market-agent/sightings.test.mjs
node --test market-agent/build-map.test.mjs
```

Cada `scan` guarda `scan.json`, `decision.json` y `REPORT.md` nuevos bajo
`output/market-agent/`. Conserva respuestas y tiempos de consulta. Los errores de
cobertura devuelven código 2 y mantienen el diagnóstico. Se verifican red, contrato
y pool exactos antes de usar una coincidencia como competidor; no se mezclan homónimos.

`RESEARCH`, `WATCH`, `NO_DATA` y `SOURCE_ERROR` describen evidencia de pools existentes.
Los umbrales provisionales de USD 25k de liquidez, USD 1k de volumen horario y una
hora de edad no están calibrados para retorno ni seleccionan ideas de lanzamiento.
Liquidez nominal no equivale a profundidad ejecutable; volumen no es beneficio neto.

## Alcance actual

El mapa de `build-map.mjs` sigue correspondiendo a la curación asistida. El comando
`scout.mjs run` produce mapas nuevos mediante el proceso autónomo descrito arriba.
La ingestión continua de X no está implementada. El seguimiento de mercado compara
muestras y no vuelve a consultar automáticamente todos los pools desaparecidos.

## Seguimiento de fuentes entre capturas

```powershell
node market-agent/followup.mjs status
node market-agent/followup.mjs import captura.json
```

`captura.json` contiene `version: 1`, `recordedAt`, `observations` y `coverage`.
Cada observación lleva `storyKey`, `sourceUrl`, `author`, `publishedAt` (ISO o
`null`), `observedAt`, `text` y `kind`. `textBasis` distingue `verbatim`,
`paraphrase` o `unknown`; `metrics` admite contadores numéricos y desconocidos
`null`. La cobertura declara por historia `observed`, `unavailable` o `not_checked`
con una nota. La fecha de una fuente se registra durante su lectura.

El comparador distingue una historia nueva en su memoria, otra fuente, una nueva
asociación y una relectura. Solo dos textos literales pueden activar una revisión
por cambio de texto; una paráfrasis distinta no se considera edición del post.
Cambios de contadores no validan demanda. Una URL nueva pide revisión editorial,
no implica que su contenido o narrativa sean nuevos.

Cada importación guarda `batch.json`, `changes.json`, `state.json`, `REPORT.md` y
hashes en una carpeta nueva de `output/market-agent/social/`. La memoria conserva
fuentes ausentes, por lo que una consulta vacía o fallida no las elimina ni las
convierte en descubrimientos al reaparecer. Los directorios incompletos `_pending-`
no son capturas válidas. Un lock persistente tras un corte requiere inspección;
no se elimina automáticamente.

`concepts.json.followupFile` puede enlazar una revisión editorial fechada. El mapa
muestra esa lectura posterior y archiva sus evidencias sin reescribir los relojes
de las propuestas originales.

## Adaptador opcional de X

`followup.mjs x-search` prepara una captura desde una página de recent search.
Requiere `X_BEARER_TOKEN` o `TWITTER_BEARER_TOKEN` y `--allow-paid-read`; se mantiene
desactivado al no proporcionarlos. No hay expansiones de usuarios, reintentos,
paginación ni avance de cursor automáticos. Un fallo devuelve cobertura
`unavailable` y código 2; una respuesta parcial conserva esa limitación.

Ver [X-ACCESS.md](./X-ACCESS.md) antes de habilitar consumo. El adaptador se probó
con respuestas simuladas; no se ha verificado acceso autenticado a X en esta cuenta.
`status` e `import` funcionan sin credenciales y no hacen solicitudes a X.

`node market-agent/cli.mjs prepare input.json` genera metadata y una propuesta local
desde un concepto e informe previo. No emite contratos, firma, publica ni determina
presupuesto. Ver `node market-agent/cli.mjs --help`.

Este módulo es independiente de BELLFLY y no modifica `server/`, `runner/`,
`package.json` ni los pins de sus experimentos.

Fuentes del colector: [API oficial DEX Screener](https://docs.dexscreener.com/api/reference)
y [condiciones de boosts](https://docs.dexscreener.com/privacy/boosting-terms-and-conditions).
La visibilidad pagada no demuestra demanda orgánica.
