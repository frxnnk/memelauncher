# Autoridad del premio: propuesta y prueba pendiente

14/09/2026, consulta de fuentes y commits hasta 19:23 UTC. Investigación técnica acotada; sin infraestructura contratada, inferencia, firma, atestación real o contrato desplegado.

## Recomendación para Vault

Preparar una prueba de **ejecutor verificable por ronda + escrow con reglas fijas**, manteniendo Privy para la cuenta y wallet del jugador. El ejecutor contendría la construcción del prompt, la llamada al proveedor, la validación de herramientas y la autorización del resultado. El escrow fijaría qué ronda, intento, destinatario y monto acepta. El selector conservaría los 2–3 guardianes aprobados de un cofre común.

Es una dirección propuesta, no una garantía disponible. La primera prueba debe demostrar autenticidad del resultado y resistencia a repeticiones ocultas; si no lo consigue, no cumple el requisito del fundador sin control sobre el ganador. No se reemplaza ese requisito por un multisig del equipo o una etiqueta de transparencia.

## Qué aportan las opciones revisadas

| Opción | Evidencia primaria revisada | Consecuencia para nuestro diseño |
|---|---|---|
| Privy | Describe generación de claves, políticas y firmas dentro de enclaves. La misma página anuncia como futura la exposición de mediciones a clientes. [Documentación](https://docs.privy.io/security/wallet-infrastructure/secure-enclaves) | Protege operaciones de wallet. Inferencia nuestra: una firma permitida no certifica que el modelo produjo la decisión. No llamar a nuestra integración actual «IA atestiguada». |
| Freysa Sovereign Framework | El README describe AWS Nitro, acceso a claves según PCR y actualizaciones aprobadas por Safe; incluye un proxy compatible con OpenAI con respuestas firmadas. [README fijado](https://github.com/0xfreysa/sovereign-freysa/blob/002a3d75097f15f6abe7f3680394188d80d01fd8/README.md) | Precedente técnico útil, pero su gobierno conserva autoridad de actualización. No prueba qué versión protegió un bounty histórico ni que todo el juego sea portable tal cual. |
| dstack / Phala | Hay verificación de plataforma, KMS, configuración y conexión; gobierno y claves requieren comprobaciones adicionales al resultado básico del verificador. [Guía](https://docs.phala.com/phala-cloud/attestation/verify-the-platform) | Candidato prioritario para probar nuestro proceso Node en un entorno atestiguado. La selección de runtime/imagen y evaluación de su gobierno están pendientes. |
| TLSNotary | Permite acreditar contenido recibido por TLS; los verificadores deben confiar en el notario o verificar directamente. Documenta TLS 1.2 y TLS 1.3 pendiente. [Protocolo](https://tlsnotary.org/docs/intro/) | Alternativa para procedencia de respuestas API; falta comprobar compatibilidad exacta con el endpoint, JSON completo, latencia y notarios. No se probó OpenRouter con este protocolo. |

La API pública del framework Freysa documenta un endpoint de atestación, pero muestra un ejemplo genérico, no un reporte real de nuestro juego. [Referencia](https://framework.freysa.ai/api-reference/get-attestation-details). GitHub devolvió para `sovereign-freysa` el commit `002a3d7`, del 28/02/2025, como HEAD de `main`; su [SECURITY.md](https://github.com/0xfreysa/sovereign-freysa/blob/002a3d75097f15f6abe7f3680394188d80d01fd8/SECURITY.md) contiene «TBD». Esto no prueba vulnerabilidad o abandono, pero tampoco una revisión de seguridad suficiente para copiarlo con fondos.

Para dstack se comprobó el HEAD de la rama predeterminada `next`, `0a2f04c`, del 14/09/2026. Es un snapshot de investigación, **no una release de producción elegida**. Se preservaron URLs inmutables, fechas y hashes de los textos consultados en [evidencia de fuentes](../../vault-lab/output/authority-research/source-checks.json). No se ejecutaron scripts de esos repositorios.

## El riesgo que una firma no elimina

Ejemplo propio: alguien clona o restaura el ejecutor justo antes de enviar un prompt. Ejecuta el mismo intento varias veces y presenta solo la respuesta que abre el cofre. Todas las firmas podrían pertenecer a código correcto: el problema sería ocultar repeticiones y elegir el resultado. Un contrato que paga una sola vez evita el doble pago, pero por sí solo no evita esa selección anterior.

El modelo de seguridad actual de dstack declara que el almacenamiento cifrado no acredita frescura y exige una referencia externa cuando la aplicación necesita resistir rollback. También distingue aislamiento de memoria de disponibilidad y corrección del programa. [Documento fijado](https://github.com/Dstack-TEE/dstack/blob/0a2f04cf88e17dd6094f28d6ef44f3bdf8ceb0f3/docs/security/security-model.md). El paper **The Forking Way: When TEEs Meet Consensus**, NDSS 2025, estudia clonación y rollback como problemas diferentes. Se usa como base del escenario, no como afirmación de una vulnerabilidad vigente en la release que eventualmente elijamos. [Paper original](https://www.ndss-symposium.org/wp-content/uploads/2025-1934-paper.pdf).

Aplicación a Vault: no basta con sumar un contador a SQLite dentro de un TEE. También debe demostrarse quién autoriza una instancia, cómo se conserva una única historia y qué impide que una misma autorización produzca varias muestras de una API no determinista. Fijar temperatura o seed no se aceptará como prueba de esa propiedad.

## Diseño concreto para la prueba

Los siguientes son requisitos propios de Vault, todavía sin implementar:

1. **Ronda comprometida.** Registrar externamente el hash del manifiesto antes de aceptar pagos: guardianes/rutas, prompt, herramientas, precios, reparto, política de errores, deadlines, versión del ejecutor y autoridad admitida. Cambios solo para rondas futuras. Una ruta API fija no demuestra pesos inmutables del proveedor.
2. **Intento ligado al jugador.** Antes de inferencia, vincular chain ID, escrow, ronda, secuencia, destinatario verificado, guardián, hash del historial completo y compromiso del prompt con salt aleatorio. El salt evita que un hash público de un prompt corto sea trivial de adivinar. El hash no oculta el texto al proveedor de inferencia.
3. **Orden e instancia comprobables.** El ejecutor consume una autorización externa de intento y valida estado canónico/finalidad. Probar control exclusivo, clonación, reinicio y rollback. Si existe un punto donde puede repetir una solicitud ya enviada o elegir entre muestras, el diseño falla. La serialización en cadena por sí sola no demuestra que la llamada externa ocurrió una única vez.
4. **Decisión dentro del perímetro verificado.** El operador no puede cambiar prompt, endpoint, herramientas, destinatario o políticas mediante variables sin autenticar. La key API es un secreto de acceso, no una instrucción del juego. El modelo solo puede invocar la acción publicada; ninguna herramienta tiene acceso genérico a la wallet, shell o red.
5. **Autorización completa.** La evidencia debe cubrir entrada, salida, ruta solicitada y reportada, decisión, secuencia, configuración, instancia/época y estado anterior. El pago liga esa evidencia a la ronda y destinatario fijados. No aceptar una firma sobre el texto aislado «released» ni sobre campos elegidos por el cliente.
6. **Escrow y gobierno.** Ninguna función del operador puede designar ganador, sustituir durante la ronda la autoridad efectiva o retirar el premio comprometido. Revisar también el KMS: fijar una dirección de firma es insuficiente si una actualización puede obtener la misma clave. Una clave solo en memoria por época es una alternativa a evaluar, con consecuencias reales de recuperación; no está seleccionada.
7. **Caída sin premio editorial.** Publicar de antemano timeout, cancelación y destino de cada saldo. Diseñar devolución de créditos sin consumir y tratamiento de aportes/semilla conforme al ledger; no improvisar un ganador o retirar el premio por una caída. Demostrar disponibilidad de los datos necesarios para reclamar. Montos y tiempos aún requieren decisión de producto.

La guía actual de dstack exige fijar digests de imágenes y autenticar configuración; advierte que un `pre_launch_script` no siempre precede al reinicio de contenedores. Nuestra comprobación de configuración deberá ocurrir antes de admitir solicitudes o usar la clave. No se propone resolverlo únicamente con un script de arranque. [Guía fijada](https://github.com/Dstack-TEE/dstack/blob/0a2f04cf88e17dd6094f28d6ef44f3bdf8ceb0f3/docs/security/security-best-practices.md).

## Criterios de aceptación de la prueba

| Prueba adversarial | Resultado requerido | Evidencia actual |
|---|---|---|
| Fabricar un JSON ganador en el servidor web | El ejecutor/escrow no lo acepta | Pendiente |
| Sustituir prompt, modelo, endpoint o imagen | Rechazo antes de inferencia/firma, o nueva ronda explícita | Manifiesto local probado; entorno atestiguado pendiente |
| Cambiar destinatario, cadena, ronda o contexto | Firma/compromiso inválido; ningún pago | Contrato y autorización pendientes |
| Repetir una autorización desde clones/restores | Ninguna muestra adicional elegible; fallo cerrado demostrable | Pendiente; principal criterio para elegir infraestructura |
| Ocultar rechazo y presentar otra muestra | Detectable y sin posibilidad de cobrar ese resultado | Pendiente |
| Actualizar aplicación/KMS durante una ronda | La versión nueva no obtiene autoridad sobre su premio | Pendiente |
| Caer después de llamar al proveedor | Recuperación sin reinferencia oculta ni costo inventado | Recibos/conciliación locales probados; anti-rollback pendiente |
| Cortar operador/proxy y copiar el prompt ganador | Dueño y orden previos conservados; reclamo/cancelación predefinidos | Pendiente |
| Verificar desde otra máquina sin confiar en la web | Medición, claves, gobierno y evidencia verificables con herramientas independientes | Pendiente |

No se califica una ruta porque pase solo firma o pago único. El mínimo es cubrir la cadena completa de estos escenarios con una instancia real y datos de testnet antes de una ronda financiada.

## Próximo trabajo habilitante

Actualización posterior: se identificó una release específica del verificador oficial, se fijó su digest y se preparó un probe local acotado. La [propuesta ejecutable de prueba](AUTHORITY-PROOF-PROPOSAL.md) distingue verificador/runtime, costo orientativo de CVM, datos que debe producir y criterio de rechazo ante clones. No constituye una atestación ni habilita fondos.
Preparar una prueba aislada con dstack TDX como primer candidato, usando una release soportada que se elija expresamente, un firmante sin fondos y respuestas de fixture. Antes de gastar en esa infraestructura, concretar proveedor, release, costo máximo y tratamiento de estado/claves; hoy no hay cuenta ni presupuesto de hosting elegidos. Reutilizar verificadores del proyecto y comprobar KMS/gobierno, sin inventar un verificador criptográfico propio. Solo si supera los escenarios de autenticidad/repetición, agregar una llamada API con presupuesto aprobado y después un escrow en testnet.

La promesa evaluable sería: «El operador no puede sustituir resultados ni destinatarios dentro del protocolo verificado, bajo sus supuestos publicados». Incluso entonces quedan hardware, gobierno relevante y proveedor API como dependencias. No prueba ausencia de amigos del fundador, no impide investigación externa del prompt y no demuestra pesos de modelos cerrados. Esos límites deberán ser visibles para el jugador.
