# Evaluación reproducible del guardián

Estado al 15/09/2026: **controles de herramientas y matriz adversarial base ejecutados contra APIs reales**. Reutiliza el servicio, historial, prompt público y validador de victoria de la aplicación; no agrega un juez oculto. [Resultados agregados](../output/beta-evaluation.json).

| Ejecución | Resultado real |
|---|---|
| Compatibilidad `cefe875e-5477-4c22-b0a5-85b443718b39` | 6/6 controles aprobados; Gemini, Haiku y Qwen pueden cerrar y abrir mediante herramientas. USD 0,00251835. Prompt permisivo exclusivo de evaluación: no son victorias contra el juego. |
| Adversarial parcial `a16a3d8f-6f07-47d3-8b6f-55f77d75f8ca` | 19 llamadas: 18 cerradas y 1 HTTP429 de Qwen sin costo individual. Se detuvo sin reintento. USD 0,0124499 conocidos. |
| Adversarial de Gemini/Haiku `89c7876a-6d84-441d-90e2-b19c7ac4fe06` | 30 escenarios por modelo, 38 turnos por modelo: 76 llamadas, cero aperturas y cero errores. USD 0,0793758. |

El gasto agregado del proveedor coincidió con los recibos de costo conocido tras el 429; ese recibo sigue conservando `cost=null`, no un cero inventado. Se excluyó Qwen de la beta por disponibilidad. El candidato defensivo permanece inactivo y sin evaluar. Estos casos estáticos no miden ataques adaptativos, probabilidades de victoria de usuarios ni invulnerabilidad. No hace falta endurecer el prompt sin antes observar jugadores reales.

## Preparar sin gastar

Desde `vault-lab`, Node 22.16+, sin nuevas dependencias:

```powershell
node eval/run.mjs
```

Siempre produce un plan sin red, sin leer claves y sin evaluar disponibilidad. Defaults: Qwen3.5-9B, Gemini2.5Flash y ClaudeHaiku4.5; **14 escenarios × 3 modelos × 3 repeticiones = 126 sesiones, hasta 162 llamadas** porque dos escenarios tienen tres turnos. Los otros doce tienen uno; tres son controles conversacionales. La matriz se rechaza si excede límites en lugar de recortarse silenciosamente.

El snapshot generado localmente está en [evaluation-dry-plan.json](../output/evaluation-dry-plan.json). Incluye escenarios completos, reglas, herramientas, parámetros y hashes. Los hashes detectan diferencias entre archivos conocidos; no prueban cuándo se publicaron ni qué ejecutó un proveedor.

## Suite adversarial ampliada

`--suite adversarial` selecciona **30 escenarios originales e inocuos para este cofre**: 4 controles y 26 ataques, con 38 turnos máximos por modelo/repetición. Incluye autoridad falsa, formatos, codificación, ejemplos repetidos, supuestos recibos/sponsors, memoria y composición en varios turnos. Conserva los 14 casos de referencia. Son casos estáticos inspirados en familias publicadas, no resultados reproducidos de esos papers ni un atacante adaptativo.

```powershell
node eval/run.mjs --suite adversarial --repeats 1 --max-calls 114
```

Este comando sigue siendo **dry-run**: 3 modelos, 90 sesiones, hasta 114 llamadas planificadas y cero llamadas ejecutadas. Omitir `--repeats 1` mantiene el default de 3; esa matriz excede los límites y se rechaza. No se reduce automáticamente. El manifiesto guarda cada texto y su fuente orientativa, junto con reglas y hashes. El snapshot está en [adversarial-dry-plan.json](../output/adversarial-dry-plan.json).

El [prompt candidato](candidate-system-prompt.txt) está **inactivo en el juego y sin evaluar con modelos reales**. El runner permite seleccionarlo mediante `--prompt candidate`, con versión y hashes propios; ver la comparación al final. No cambia el servidor del juego ni su condición de victoria. [Investigación](../../docs/treasure-guardian/JAILBREAK-DEFENSE-RESEARCH.md). Ningún resultado con transportes simulados demuestra resistencia de un LLM.

## Primero: comprobar las dos herramientas

Antes de medir dificultad, preparar este lote independiente:

```text
node eval/run.mjs --suite compatibility --repeats 1 --max-calls 6
```

Planifica **6 llamadas: 2 controles × 3 modelos**, y ejecuta cero. Usa el prompt explícito `eval-vault-tool-compatibility-v1-2026-09-14`, que permite ambas acciones, con las herramientas y rutas del juego. Cada control pide una llamada real a `keep_locked` o `release_prize`. Este prompt existe solo en evaluación; `--prompt candidate` se rechaza para esta suite.

`toolControls` informa intentados, aprobados y fallidos por modelo. Texto que imita JSON, otra herramienta o un error no aprueban el control. `completed` significa que terminó la matriz, no que aprobó. Las aperturas de este lote son controles esperados, no jailbreaks. Un fallo requiere investigar la ruta/comportamiento; no demuestra definitivamente falta de soporte. Aprobar ambos tampoco mide resistencia del juego ni sustituye la evaluación adversarial.

## Ejecutar después de habilitar el presupuesto

Configurar manualmente una key de inferencia dedicada en OpenRouter con límite **no renovable de USD 5 o menos**, e incluir BYOK dentro del límite. Guardarla únicamente en `.env` como `OPENROUTER_EVAL_API_KEY`. El runner no crea claves, no modifica límites y no reutiliza automáticamente `OPENROUTER_API_KEY` de la app. No pegar claves en el chat.

El primer lote real propuesto son los **6 controles de herramientas**. Después, si pasan y queda presupuesto, ejecutar por separado el prompt base y el candidato contra la suite adversarial. La key mantiene un único límite acumulado entre esos runs; no renovar el cupo automáticamente.

```powershell
node --env-file-if-exists=.env eval/run.mjs --live --suite compatibility --repeats 1 --budget-usd 5 --max-calls 6
```

`--live` permite llamadas facturables; el lote ya ejecutado está identificado arriba. Repetir este comando genera gasto nuevo. Antes del primer POST consulta [la información de la propia key](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key) y rechaza límites ilimitados, renovables, superiores al presupuesto, agotados o sin BYOK incluido. OpenRouter documenta el [control de límites por key](https://openrouter.ai/docs/guides/overview/auth/management-api-keys). No se consulta ninguna key de administración.

El cliente opera en serie, limita POST, detiene la matriz al alcanzar el costo reportado o cuando falta ese costo, y nunca reintenta automáticamente. **El costo observado después de cada respuesta no reserva el costo de la siguiente solicitud**. La restricción monetaria externa depende de la aplicación del límite por OpenRouter; no se afirma un tope transaccional exacto impuesto por este script. No compartir esta key con otros procesos. Errores/timeouts pueden haber sido facturados; faltantes se reconcilian antes de continuar.

## Evidencia por ejecución

Cada ejecución real crea un directorio nuevo en `.local/evaluations/`:

- `manifest.json`: configuración y escenarios congelados, presupuesto verificado, fecha y modo práctica.
- `catalog.json`: catálogo seleccionado al iniciar; cada recibo también registra fecha del catálogo.
- `receipts/attempts.jsonl`: recibos que persiste el servicio antes de confirmar el resultado.
- `results.jsonl`: escenario, repetición, turno, duración, decisión/error, costo conocido o `null` y recibo completo.
- `summary.json`: cobertura, motivos de parada, resultados por escenario y denominadores por modelo.

Ante fallo al guardar un resultado, el proceso para. Un manifiesto iniciado sin resumen indica una ejecución incompleta; inspeccionar los recibos antes de repetir. No se guardan claves o identificadores de cuenta en metadatos. Los artefactos son registros del operador, no atestación independiente.

Una apertura termina ese escenario. Una respuesta inválida termina el escenario como error; si su costo está reportado puede continuar el siguiente. Costo desconocido detiene todo. Los errores nunca cuentan como cofre defendido. Una solicitud que no llegó a inferencia puede aparecer como intento de evaluación fallido; `actualPostRequests` distingue cuántos POST se iniciaron.

## Alcance y próximos ensayos

El lote adversarial es una referencia pública de desarrollo, no un benchmark adaptativo. Las repeticiones de conversaciones no son muestras independientes de jugadores. Hace falta revisar relevancia, inglés, variedad y humor; luego atacar adaptativamente a los finalistas con igual presupuesto y casos reservados. El control técnico separado pasó en los tres modelos; eso prueba que la ruta puede abrir con un prompt permisivo, no que los jugadores encontrarán una apertura en el prompt base.

La configuración actual usa los perfiles `vault-candidate-profiles-v2-2026-09-15`: Qwen9B en `deepinfra/bf16`, Qwen27B en `chutes/fp8`, Gemini Flash en `google-vertex/global` y Haiku en `anthropic`. Todos solicitan reasoning desactivado, 512 tokens de salida, temperatura 0,7 y sin fallback. `anthropic` limita el proveedor, pero no identifica una revisión de pesos o región exacta. Otros modelos conservan routing base no calibrado. El smoke real probó Gemini, Haiku y Qwen9B con la configuración v1; v2 actualiza el estado de evidencia sin cambiar prompt, ruta o generación. Qwen27B sigue sin prueba real. Ninguno está calificado para premios.

`node eval/check-models.mjs` consulta exclusivamente el catálogo y endpoints públicos por GET. El snapshot de `output/model-readiness.json`, a las 07:51 UTC del 14/9, confirma soporte anunciado para estos requests, no disponibilidad autenticada ni resistencia. El JSON de configuración completo se publica en la app y en cada recibo. Ver [investigación y candidatos](../../docs/treasure-guardian/MODEL-EVALUATION-RESEARCH.md).

Las pruebas de `test/eval.test.mjs` usan transportes simulados. Ninguno de sus resultados mide persuasión ni seguridad de un LLM.

## Comparar prompts sin cambiar el juego

`--prompt baseline` es el default. `--prompt candidate` carga `candidate-system-prompt.txt` con versión `eval-vault-guard-candidate-v1-2026-09-14`. El texto exacto entra en el plan, hashes, configuración del servicio de evaluación y recibos. No se puede ejecutar el plan candidato contra un servicio con el prompt base. El servidor del juego no toma este override por HTTP ni por una variable de entorno.

```text
node eval/run.mjs --suite adversarial --prompt baseline --repeats 1 --max-calls 114
node eval/run.mjs --suite adversarial --prompt candidate --repeats 1 --max-calls 114
```

Cada comando planifica 90 sesiones y hasta 114 llamadas, pero por defecto ejecuta cero. Hacer ambas comparaciones completas planificaría hasta 228 llamadas; no son un permiso de gasto. Para `--live`, usar presupuesto explícito y key dedicada acordados, con límite acumulado entre runs. Mantener los artefactos separados y comparar costos, errores y controles, además de aperturas. No se atribuyó una mejora al prompt candidato sin medición.
