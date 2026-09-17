# Guardián del tesoro — propuesta de funcionamiento

Fecha: 14 de septiembre de 2026. Estado: diseño del producto con fondos; todavía sin implementar ni publicar ese circuito.
La dirección aceptada es un núcleo por API con **un cofre común y 2–3 guardianes aprobados por ronda**, seleccionables por el jugador. [Entrega actual](LAUNCH-HANDOFF.md) y [laboratorio](../../vault-lab/README.md). Los bounties por modelo y logros quedan para después; la autoridad y financiación del primer premio siguen pendientes.
Nombre anterior de trabajo: DEAR VAULT. El usuario dejó el nombre abierto y aclaró que quiere relacionar el token con una acción. Identidad, ticker, plataforma, activo exacto del par y moneda del premio siguen pendientes.

Nueva entrega: [piloto funcional](PILOT.md), [modelos y evaluación](MODEL-EVALUATION-RESEARCH.md), [wallet, créditos y creator fees](TREASURY-RESEARCH.md). El banco de pruebas local está implementado; la comparación por inferencia y la integración con fondos siguen pendientes.

Para retomar: [handoff del 14/9](HANDOFF-2026-09-14.md), [circuito implementado](IMPLEMENTATION.md), [decisiones para aceptar fondos](LAUNCH-DECISIONS.md) y [propuesta de sponsors sin publicar](SPONSOR-PACK.md).

Investigación ampliada: [jailbreaks, configuración del guardián y Privy](JAILBREAK-DEFENSE-RESEARCH.md), con 25 referencias y revisión de material público de X. Suite local de 30 escenarios disponible; prompt candidato preparado e inactivo. Privy es la preferencia de wallet; NVIDIA sigue como activo posible sin validar. No hay resultados nuevos de inferencia real.

## Qué construimos

Un juego de persuasión: una IA protege un premio y el jugador intenta conseguir que autorice su entrega mediante una conversación. Cada intento válido consume créditos comprados con el token del proyecto. Una parte definida de ese consumo alimenta el premio. Sponsors pueden aportar al premio y contratar visibilidad identificada como publicidad.

La experiencia principal es cofre + chat + premio + precio del intento. La evidencia detallada está a un clic y es exportable. Un estado desconocido, vencido o pendiente se muestra como tal.

Robinhood Chain y Long son la ruta candidata para el token, según el research previo y la documentación consultada el 14/9. Todavía no se verificó la transacción de creación de este proyecto. No se heredan los contratos, permisos o términos de BELLFLY u OCAT.

## Circuito de una ronda

1. **Preparar:** publicar reglas, precio, reparto, moneda del premio, condición de victoria, orden de intentos, cierre, cancelación, reembolsos, versión del guardián y permisos del operador.
2. **Financiar:** ingresar el premio inicial y aportes recibidos de sponsors al escrow de la ronda. Promesas de aportes quedan separadas del saldo disponible.
3. **Recargar:** confirmar el pago y acreditar el saldo del jugador una única vez. Los créditos sin consumir son una obligación separada; no cuentan automáticamente como premio o ingreso.
4. **Aceptar intento:** reservar su costo y entregar recibo que vincule jugador, ronda, sesión, mensaje y posición aceptada. El contenido publicado sigue una política conocida antes de enviar.
5. **Evaluar:** procesar la cola por orden aceptado con la configuración comprometida. Conservar entrada efectiva, contexto, parámetros, salida y acción solicitada.
6. **Resolver:** una respuesta válida consume el intento y aplica el reparto publicado. Un error de infraestructura libera la reserva y deja un registro de error; nunca se convierte silenciosamente en derrota.
7. **Pagar:** una autorización válida de liberar el premio cierra la ronda, reserva el importe para el ganador y lo paga una sola vez. La UI distingue victoria, pago pendiente y pago confirmado.
8. **Cerrar:** devolver reservas de intentos aún no procesados, publicar conciliación y resultados y preparar la siguiente generación.

La regla debe determinar si el aporte del intento ganador integra su premio y qué sucede con aportes concurrentes. Para el piloto proponemos que su consumo válido forme parte del premio antes de liquidarlo. Los fondos de nuevas rondas y los gastos operativos quedan separados.

Una cola por ronda evita que gane la respuesta de inferencia que termina primero. El orden de aceptación debe tener una fuente comprobable. Un número asignado solo por nuestro servidor no acredita ausencia de censura o reordenamiento previo.

## Cómo ganás

La victoria es una acción estructurada del guardián vinculada al intento: `release_prize(round_id, attempt_id)`. Es una interfaz propuesta, no una integración existente.

El ejecutor toma destinatario e importe de las reglas y de la sesión aceptada. El LLM no inventa direcciones ni montos. El contrato impide repetir un pago. Una victoria válida no queda sujeta a un segundo juicio editorial o a la preferencia del sponsor.

La autoridad que firma el resultado es parte central del diseño: publicar quién controla su clave, cómo puede cambiarse y qué facultades de pausa o actualización existen. Un firmante controlado por el operador no demuestra control exclusivo del agente.

## Dinero y denominaciones

Decidir por separado:

- Token del proyecto que compra créditos.
- Activo de cotización del pool del token.
- Activo o activos que pueden ganarse en el cofre.

Si son diferentes, la conversión necesita una ruta y una política explícitas. Un aporte al premio solo se reconoce en la moneda prometida cuando ese activo fue recibido; una cotización o conversión pendiente no es saldo disponible.

Para cada activo, conciliar entradas recibidas, créditos sin consumir, reparto de intentos consumidos, aportes al premio, fondos reservados para ganadores, pagos y gastos. Mantener cantidades originales y transacciones; cualquier valuación en USD incluye fuente y hora.

Los fees de trading deben aparecer como: devengados estimados, cobrados, convertidos si corresponde y asignados. Solo los cobros asignados al premio lo aumentan. La tarifa total del swap no equivale al ingreso del creador. No financiar compromisos con volumen o fees futuros supuestos.

## Qué significa demostrar

| Afirmación | Evidencia necesaria | Lo que esa evidencia no demuestra por sí sola |
| --- | --- | --- |
| Hay un premio disponible | Saldo por activo, escrow, obligaciones, bloque y permisos de retiro | Un saldo en una wallet no asegura que esté reservado |
| El sponsor aportó | Transferencia y asignación confirmadas; confirmación de la identidad de la empresa | Una dirección pagadora no prueba afiliación o autorización de logo |
| Estas son las reglas | Configuración publicada antes de abrir y mecanismos que la aplican | Un hash no prueba que se ejecutaron esas reglas |
| Tu intento fue aceptado | Mensaje/identificador vinculados y recibo contrastable con el registro | El registro del servidor no demuestra que no omitió solicitudes |
| El modelo produjo esta decisión | Evidencia de ejecución vinculada a la entrada, salida y entorno esperado | Logs o un hash de la respuesta pueden ser fabricados por un operador |
| El ganador cobró | Transacción confirmada al destinatario correcto y conciliación | Una animación, tool call o transacción enviada no son pago final |
| La siguiente generación mejora | Versiones, datos, evaluación separada y resultados de seguridad y utilidad | Repetir ataques entrenados o rechazar todo no demuestra generalización |

Etiquetas propuestas: **verificado en cadena**, **reproducible**, **declarado por operador**, **atestiguado**, **pendiente**. Cada etiqueta enlaza a evidencia y límites. No usar un único check verde para afirmaciones distintas.

## La inferencia requiere una decisión técnica

Qwen3.5-9B por API es un candidato para explorar el juego. Registrar modelo y proveedor no demuestra la revisión exacta que se ejecutó. Alojar pesos propios permite control y reproducción, pero tampoco acredita remotamente cada ejecución.

Para una promesa de inferencias verificables, estudiar un entorno de ejecución atestiguado que vincule código, pesos, configuración, clave de firma, solicitud y respuesta. Un proxy atestiguado que consulta una API no verificada deja pendiente la ejecución de esa API.

Phala y NEAR AI documentan atestación y verificación de respuestas. Son candidatos técnicos para evaluar; no se comprobó en este trabajo una ruta para nuestro modelo ni su vínculo completo con el pago. La atestación mantiene supuestos sobre hardware y software y no prueba ausencia de errores, imparcialidad universal o veracidad del razonamiento.

La arquitectura pública con premio real debe elegirse conforme al nivel de prueba exigido. La demo con API no se presentará como sistema totalmente verificable.

## Publicidad de reglas, conversaciones y aprendizaje

- Propuesta: reglas y system prompt públicos al abrir cada ronda. Nada de cambiar la dificultad sobre una ronda ya pagada.
- Para las conversaciones, elegir publicación inmediata o compromiso al aceptar y revelación al cierre. La segunda protege temporalmente las estrategias, pero la evidencia del contenido llega después.
- Explicar la política antes de enviar. No publicar credenciales, claves o información personal. Si un registro público requiere redacción, marcarla y delimitar qué ya no puede comprobarse públicamente.
- No equiparar identidad de wallet a persona única.
- Entrenamiento entre generaciones, con revisión del dataset y separación de evaluación. Una mejora de instrucciones, memoria o pesos se identifica correctamente.
- Mantener pruebas nuevas reservadas antes de evaluar y publicar su versión/resultados después. Medir resistencia y utilidad; bajar entregas mediante rechazo indiscriminado no basta.

## Patrocinio de una ronda

Propuesta: un sponsor principal, con entrega comercial acotada. Marca junto al cofre, ficha de contribución y publicaciones de apertura y cierre identificadas como patrocinadas. No prometer audiencia, alcance o conversiones inexistentes.

| Modalidad | Destino | Contraprestación |
| --- | --- | --- |
| Donación al premio | 100% al bounty si así se anuncia | Sin publicidad contratada |
| Patrocinio de ronda | Aporte al premio y honorario comercial separados | Visibilidad, piezas e informe acordados |
| Aporte en especie | Operación; por ejemplo, créditos de inferencia | Reconocimiento de infraestructura según acuerdo |

Ejemplo ilustrativo: 1.000 unidades del activo premio al cofre y 200 a producción/publicidad. La contribución al premio es 1.000, nunca 1.200. Los créditos de inferencia tampoco se suman al premio.

Publicar aporte comprometido/recibido/asignado, destinatarios, concepto, ronda, evidencia y términos de cierre. Atribuir una marca requiere autorización; no agregar logos porque una wallet envió dinero.

Propuesta de cierre para acordar: cancelación antes de abrir devuelve el aporte al premio; una ronda abierta somete el aporte a las reglas publicadas, sin retiro discrecional del sponsor. Definir qué pasa si nadie gana, plazos, gas y reembolsos. Las disputas de publicidad se atienden sobre el componente comercial, sin vaciar el premio comprometido.

El sponsor no compra acceso privilegiado, cambio de dificultad, selección del ganador ni acceso a conversaciones privadas. Los aportes y relaciones de participantes vinculados deben declararse; no prometer que detectamos toda relación oculta.

Informe de cierre: intentos válidos, wallets participantes, visitas, impresiones visibles y clics según metodología, más recibos de las piezas entregadas. No llamar usuarios únicos a wallets ni volumen orgánico a toda actividad.

## A quién podría interesarle

- Inferencia y computación verificable: uso demostrable de su tecnología y consumo medido.
- Wallets, RPC y exploradores: recargas y premios con trazabilidad visible.
- Seguridad y evaluación de IA: experimento documentado, metodología y resultados.

Son categorías con encaje hipotético. No hay empresas contactadas ni sponsors confirmados. Antes de contactar: demo, reglas, ejemplo de comprobante, tratamiento de datos y propuesta comercial de una página.

## Decisiones pendientes y siguiente entrega

1. Nivel de prueba exigido para inferencia y autoridad de pago; validar una ruta completa de recibo verificable.
2. Elegir moneda del premio, activo del par y conversión de recargas; revalidar catálogo y términos de Long.
3. Cerrar reglas de una ronda, orden, contenido público, errores y cierre sin ganador.
4. Elegir dirección de identidad; ver IDENTITY.md. No se verificaron handles, dominio, marca ni ticker.
5. Construir una demo con datos de prueba identificados y preparar un paquete de patrocinio basado en su funcionamiento real.

No se habilitaron pagos, creó token, conectó wallet, contactó empresas ni publicó contenido.

## Fuentes y contexto

- Robinhood Chain: https://docs.robinhood.com/chain/connecting/
- Long actual: https://app.long.xyz/
- Stock Tokens y sus condiciones: https://docs.robinhood.com/chain/stock-tokens/
- Modelo para demo: https://openrouter.ai/qwen/qwen3.5-9b/api
- Phala: qué demuestra y qué no su verificación: https://docs.phala.com/phala-cloud/confidential-ai/verify/overview
- NEAR AI: https://docs.near.ai/cloud/verification
- Integridad de registros: https://www.rfc-editor.org/rfc/rfc9162.html
- [Research local histórico de fees](../../output/research-2026-09-12/round-03/DECISION.md).
