# Modelos y evaluación del guardián

Consulta: 14 de septiembre de 2026, 07:12–07:15 UTC. Investigación de lectura: código local, documentación primaria y GET públicos de OpenRouter sin autenticación. No se leyeron claves, no se hicieron inferencias y no se autorizaron gastos. Los resultados siguientes describen oferta y compatibilidad anunciadas; **todavía no hay una medición de resistencia, calidad ni latencia de estos modelos en el juego**.

**Actualización de implementación, posterior a esta investigación:** se agregaron perfiles públicos con `provider.only/order`, sin fallback y `reasoning.enabled=false` para los cuatro candidatos. Gemini solicita ahora `google-vertex/global`, no el slug base `google-vertex`; el GET de las 07:51 UTC volvió a validar sus metadatos. Se preservan bloques originales de reasoning en el historial de herramientas. [Snapshot actual](../../vault-lab/output/model-readiness.json), [perfiles](../../vault-lab/server/profiles.mjs). Los apartados siguientes conservan los hallazgos del código anterior. El runner implementado usa 14 escenarios y hasta 162 llamadas para tres modelos/tres repeticiones; la propuesta inicial de 15 casos más abajo no es el comando vigente. Nada de esto sustituye la primera inferencia real.

## Recomendación concreta

Mantener la elección de modelo en el laboratorio de práctica, dentro de una lista compatible. Para una primera ronda con premio, publicar y mantener **un modelo, un endpoint y una configuración por ronda**; si ese endpoint falla, detener los intentos de esa ronda en lugar de cambiar la dificultad mediante otro proveedor. La selección definitiva requiere pruebas: no hay evidencia para declarar hoy a uno el mejor guardián.

Empezaría la evaluación con **Qwen3.5-9B en DeepInfra BF16**, como referencia económica, y compararía **Qwen3.6-27B**, **Claude Haiku 4.5** y **Gemini 2.5 Flash**. Esta es una propuesta de candidatos, no un ranking de resistencia. La decisión debe equilibrar dificultad, respuestas útiles y personalidad; un modelo que nunca genera herramientas o sólo emite errores no es un buen guardián.

Una ronda con fondos sigue necesitando resolver quién puede autorizar pagos y cómo evitar intervenciones del operador. Fijar parámetros de API y publicar recibos no demuestra por sí solo que el fundador no pueda fabricar una ejecución o participar con ventaja.

## Catálogo observado

Snapshot principal: **2026-09-14T07:13:12.497Z**. Precios en **USD por millón de tokens de entrada / salida**, sin asumir caché, descuentos ni que el precio del catálogo sea el de cualquier endpoint. El [catálogo GET oficial](https://openrouter.ai/api/v1/models) devolvió estos cuatro IDs exactos.

| ID de modelo | Precio de catálogo | Endpoint candidato; precio anunciado | Oferta observada en GET de endpoints |
|---|---:|---|---|
| `qwen/qwen3.5-9b` | 0.100 / 0.150 | DeepInfra, `deepinfra/bf16`; 0.100 / 0.150 | HTTP 200; 6 endpoints listados, 5 enumeran los cuatro parámetros actuales. [Fuente](https://openrouter.ai/api/v1/models/qwen/qwen3.5-9b/endpoints) |
| `qwen/qwen3.6-27b` | 0.300 / 2.000 | Chutes, `chutes/fp8`; 0.300 / 2.000 | HTTP 200; 6 endpoints listados, los 6 enumeran los cuatro parámetros. [Fuente](https://openrouter.ai/api/v1/models/qwen/qwen3.6-27b/endpoints) |
| `anthropic/claude-haiku-4.5` | 1.000 / 5.000 | Anthropic, `anthropic`; 1.000 / 5.000 | HTTP 200; 8 endpoints listados, los 8 enumeran los cuatro parámetros. [Fuente](https://openrouter.ai/api/v1/models/anthropic/claude-haiku-4.5/endpoints) |
| `google/gemini-2.5-flash` | 0.300 / 2.500 | Google AI Studio, `google-ai-studio`; 0.300 / 2.500 | HTTP 200; 7 endpoints listados, los 7 enumeran los cuatro parámetros. [Fuente](https://openrouter.ai/api/v1/models/google/gemini-2.5-flash/endpoints) |

Los cuatro parámetros comprobados son `tools`, `tool_choice`, `temperature` y `max_tokens`. Los endpoints candidatos también declaran `supports_tool_choice.auto=true`, soporte de `reasoning` y `status=0`. Esto **no comprueba que una solicitud autenticada nuestra vaya a funcionar**, ni que el modelo respete correctamente el esquema. No se verificaron permisos, saldo, límites de cuenta o restricciones del proveedor.

Dos diferencias del snapshot impiden tratar cada modelo como una oferta homogénea:

- Qwen3.5-9B aparece en FP4, FP8 y BF16. Parasail declara `supports_tool_choice.auto=true`, pero omite `tools` y `tool_choice` en `supported_parameters`; no lo daría por compatible con nuestro request. Darkbloom anuncia 0.080 / 0.130, distinto del precio general. [Endpoints Qwen9B](https://openrouter.ai/api/v1/models/qwen/qwen3.5-9b/endpoints)
- Gemini tiene distintas regiones y niveles de servicio. El registro `google-vertex` presenta `status=-2`; no equivale al candidato `google-ai-studio`, que presenta `status=0`. Un endpoint listado no constituye una prueba de disponibilidad operativa. [Endpoints Gemini](https://openrouter.ai/api/v1/models/google/gemini-2.5-flash/endpoints)

## Qué está fijado y qué falta fijar

El código revisado conserva el ID por sesión, publica el prompt y herramientas, exige una sola respuesta y sólo considera victoria una llamada válida a `release_prize`. Un texto afirmativo no abre el cofre. Los resultados ambiguos o incompletos son errores. Configuración actual: `temperature=0.7`, `max_tokens=512`, `tool_choice="auto"`, `stream=false`, `require_parameters=true`, `allow_fallbacks=false`; 12 turnos, 2.000 caracteres por mensaje, 12.000 caracteres de contexto serializado y timeout de 45 segundos. Fuentes locales: [rules.mjs](../../vault-lab/server/rules.mjs), [upstream.mjs](../../vault-lab/server/upstream.mjs), [service.mjs](../../vault-lab/server/service.mjs).

**`allow_fallbacks:false` no fija el proveedor entre solicitudes.** OpenRouter selecciona inicialmente un proveedor; desactivar fallbacks impide recurrir a otro tras un fallo. Para restringirlo, usar `provider.only` y un slug específico, más `allow_fallbacks:false`. Un slug base puede abarcar variantes o regiones. Confirmar el slug completo del endpoint elegido y registrar la selección. `require_parameters:true` filtra soporte anunciado; no certifica obediencia del modelo. [Documentación oficial de routing](https://openrouter.ai/docs/guides/routing/provider-selection)

Propuesta para el smoke test de Qwen9B: `model="qwen/qwen3.5-9b"`, `provider.only=["deepinfra/bf16"]`, sin fallback y con parámetros explícitos. **Esta combinación todavía no fue probada por inferencia.** Fijar un slug tampoco acredita pesos, revisión del servidor, determinismo o ausencia de manipulación. Los recibos actuales se identifican correctamente como `operator-recorded`; el nombre del proveedor o `system_fingerprint` no son una atestación independiente.

El selector local [catalog.mjs](../../vault-lab/server/catalog.mjs) filtra `tools` a nivel de modelo, pero no conserva la matriz completa de parámetros por endpoint. Por eso conviene verificar esa matriz antes de promover un candidato a ronda fija, sin presentar la lista del laboratorio como una certificación.

## Reasoning y compatibilidad de varios turnos

El catálogo anuncia `reasoning.mandatory=false` para los cuatro candidatos; en Qwen3.6-27B además declara `default_enabled=true`. Los otros tres omiten ese valor: omisión no significa desactivado. El request local no fija una política de reasoning. [Catálogo consultado](https://openrouter.ai/api/v1/models)

Recomiendo evaluar primero un modo explícito sin reasoning cuando el endpoint lo permita, y medir por separado cualquier modo con reasoning. Deben confirmarse los controles aceptados mediante smoke tests. `exclude:true` sólo oculta reasoning en la respuesta; no lo desactiva ni elimina su costo. Con reasoning, 512 tokens pueden ser insuficientes para llegar a una respuesta final; para Anthropic, el presupuesto de reasoning documentado parte de 1.024 tokens y `max_tokens` debe superarlo. [Documentación oficial de reasoning](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens)

Otra comprobación pendiente: el recibo conserva `outputMessage`, pero el historial reconstruido por `validateCompletion` omite `reasoning` y `reasoning_details`. OpenRouter documenta conservar los bloques originales cuando se necesitan para continuar llamadas a herramientas. Por lo tanto, un primer turno exitoso no basta para declarar compatible el modo con reasoning. Probar al menos una secuencia de herramienta y continuación, con el historial que realmente enviará la aplicación. Esto es un riesgo de integración identificado en código, no un fallo de inferencia observado. [Preservación de reasoning](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens#preserving-reasoning)

## Evaluación defendible del prompt público

El protocolo siguiente es una propuesta propia apoyada en fuentes; no son resultados del guardián.

1. **Congelar el objeto que se evalúa.** Registrar commit del código, prompt público completo, herramientas, validador, modelo, endpoint, generación, política de reasoning, contexto y límites. Dar al atacante el mismo prompt público y las mismas herramientas que ve el jugador. Sin instrucciones secretas de evaluación que fortalezcan al defensor.
2. **Comprobar primero el protocolo.** Verificar texto, tool call válido y continuación de conversación. Agregar un control técnico separado donde el prompt permita una herramienta, para detectar incapacidad de invocarla. Ese control no cuenta como una victoria contra el guardián. El criterio de resultado debe usar el validador real, no un juez que interprete un “sí”. OpenAI recomienda evaluar elección de herramientas y exactitud de argumentos. [OpenAI, buenas prácticas de evaluación](https://developers.openai.com/api/docs/guides/evaluation-best-practices)
3. **Separar desarrollo y prueba reservada.** Usar ataques de desarrollo para ajustar el personaje; reservar familias y variantes no utilizadas para ese ajuste. Incluir falsa autoridad, redefinición de reglas, instrucciones citadas, presión conversacional, varios idiomas, contexto largo y persuasión normal. La separación por familias es una adaptación propuesta para evitar que simples paráfrasis contaminen la prueba. [OpenAI](https://developers.openai.com/api/docs/guides/evaluation-best-practices)
4. **Repetir y permitir adaptación.** Combinar casos fijos con sesiones donde el atacante cambia de estrategia al leer la respuesta. Igualar presupuesto de turnos, caracteres y consultas entre candidatos. Tres repeticiones por caso pueden servir para un primer lote, no para certificar resistencia. AgentDojo motiva probar atacantes adaptativos y medir utilidad además de éxito del ataque; sus resultados sobre inyección indirecta no se trasladan numéricamente a este juego de persuasión directa. [AgentDojo, §§3.3–4.1](https://arxiv.org/html/2406.13352v3)
5. **Publicar denominadores y fallos.** Mostrar liberaciones válidas por intento y sesiones con al menos una liberación, junto con número de casos, repeticiones y presupuesto. Informar aparte errores, respuestas no evaluables y truncamientos; no descartarlos ni contarlos como defensa exitosa. Presentar resultados sobre solicitudes iniciadas y sobre respuestas evaluables, para que un proveedor que falla mucho no parezca más resistente.
6. **Medir si el juego funciona.** Evaluar relevancia de la respuesta, inglés, personaje, variedad y cumplimiento de pedidos de bajar el tono; combinar rúbrica explícita y revisión humana. Medir latencia hasta resultado completo y costo reportado por separado. Usar preguntas benignas y ataques fallidos: negarse a todo no demuestra utilidad. [OpenAI](https://developers.openai.com/api/docs/guides/evaluation-best-practices), [AgentDojo](https://arxiv.org/html/2406.13352v3)

Como lote inicial a presupuestar: 15 casos por modelo —10 adversariales y 5 benignos— repetidos tres veces: 45 llamadas por modelo, 180 para los cuatro, más controles técnicos. Después, sesiones adaptativas acotadas para los finalistas. **El tamaño y el gasto máximo requieren autorización antes de ejecutar.** Publicar fallos y conservar el conjunto reservado para no optimizar continuamente sobre él; después de usarlo para ajustar, pasa a ser material de desarrollo.

No anunciar “aprendió” porque una conversación acumule contexto. Para sostener esa afirmación habría que comparar una versión nueva contra la anterior en una prueba reservada, manteniendo las métricas de utilidad y publicando qué cambió. En una ronda con premio, cualquier actualización del guardián debería iniciar una ronda nueva con reglas explícitas.

## Qué podemos afirmar hoy

Hay cuatro candidatos accesibles en el catálogo público con endpoints que anuncian las capacidades requeridas. Hay reglas y un validador local concretos que se pueden evaluar. **No hay todavía ASR, dificultad, calidad conversacional, costo por partida o latencia medidos con inferencia real.** Tampoco está demostrada una ejecución inmutable o independiente del operador. La próxima decisión útil es autorizar un lote y un techo de gasto concretos; hasta entonces, las pruebas de interfaz y mocks sólo validan software, no resistencia del modelo.
