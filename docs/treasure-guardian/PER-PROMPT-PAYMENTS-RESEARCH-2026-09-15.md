# Cada intento financia su propia inferencia

Investigación 15/09/2026. El usuario pide eliminar la dependencia de recargar manualmente OpenRouter: la consulta debe tener su costo financiado por el jugador antes de ejecutarse. Investigación y cotizaciones sin pagar; no se conectaron wallets, firmaron autorizaciones ni cambiaron proveedores de la beta.

**Actualización posterior del mismo día:** el usuario fijó Robinhood como red obligatoria para jugar. El [mapa completo en Robinhood](ROBINHOOD-SYSTEM-MAP-2026-09-15.md) reemplaza las alternativas de red de este reporte como dirección del producto: pago del usuario en Robinhood, caja de inferencia en Base y conversión automática por lotes. Relay devolvió cotizaciones sin firma para USDG Robinhood → USDC Base; ejecución pendiente. Las opciones de pago directo del jugador en Base que aparecen debajo quedan como investigación comparativa, no como decisión para V1.

## Resultado

Decisión técnica posterior: desarrollar primero contra BlockRun x402, sujeto a calificación de pago/configuración/evidencia; OpenRouter queda para práctica. La verificación oficial confirmó que su antigua API de compra cripto fue retirada y deriva al checkout web, por lo que no se adopta como recarga cripto automática. Política comercial y validación local: [decisiones de beta paga](../plans/2026-09-15-vault-paid-beta-decisions.md).

Existe una ruta más adecuada que reponer una cuenta prepaga: inferencia con pagos por request x402. BlockRun y NanoGPT respondieron en vivo con HTTP 402 y opciones de pago cripto para consultas sin API key. Se elimina nuestra cuenta de créditos OpenRouter de ese circuito. No se elimina la dependencia de disponibilidad del gateway/modelo/red ni el costo de hosting y gestión de errores.

La propuesta siguiente reemplaza la recarga manual como dirección principal de investigación para V1. OpenRouter queda como integración actual de práctica; no se retira hasta validar la alternativa. Ninguna alternativa está calificada todavía para premios reales o prueba independiente de inferencia.

## Comparación acotada

| Ruta | Evidencia | Implicación para Vault |
| --- | --- | --- |
| BlockRun x402 | Catálogo GET 200; Haiku 4.5 disponible según metadatos. Quote POST sin firma respondió 402 con exact USDC Base. | Primer candidato para probar precio cerrado y pago por consulta. Falta probar preservación de configuración, recuperación y alcance de evidencia. |
| NanoGPT accountless x402 | Matriz GET 200 anuncia chat no streaming. Quote POST sin key respondió 402 con Nano, Base USDC y Solana USDC. | Segundo candidato, interesante por rutas/pinning y documentación TEE. Las cotizaciones de chat son estimadas y la conciliación/costo máximo requieren ensayo. |
| NanoGPT API de depósitos | Documenta creación y seguimiento de depósitos programáticos. | Automatiza reposición, pero conserva cuenta prepaga y demora de acreditación; no es la mejor respuesta al pedido de pago directo. |
| OpenRouter | Crypto API antigua retirada; recarga automática con tarjeta disponible. | Ya integrado, pero conserva capital de trabajo/recargas o liquidez de tarjeta. |
| Cluster + Phala | Blog del proveedor describe x402 Base e inferencia confidencial. | Pista para unir pagos y evidencia; sin endpoint/quote/verificación probados aquí. No adoptar afirmaciones del blog como garantía. |
| x402gate | README anuncia pasarela hacia OpenRouter; documenta reintentos y saldo prepagado en memoria. | Referencia de código, no candidato inicial de custodia o ejecución imparcial. Reintentos genéricos de inferencia no sirven para rondas elegibles. |

Fuentes primarias: [BlockRun chat](https://blockrun.ai/docs/api-reference/chat-completions), [BlockRun pago](https://blockrun.ai/docs/x402/payment-flow), [NanoGPT x402](https://docs.nano-gpt.com/api-reference/miscellaneous/x402), [NanoGPT depósitos](https://docs.nano-gpt.com/api-reference/endpoint/crypto-deposits), [OpenRouter deprecación](https://openrouter.ai/docs/cookbook/administration/crypto-api), [Cluster integración](https://www.clusterprotocol.ai/blog/verifiable-inference-how-cluster-protocol-and-phala-network-close-the-last-gap-in-the-ai-stack-1781674763), [x402gate](https://github.com/oponfil/x402gate). Consultados hoy, sin instalar sus SDK ni ejecutar su código.

## Evidencia de red sin gasto

Script propio: `vault-lab/audit/inference-payment-probe.mjs`. Ejecutar desde `vault-lab` con `node audit/inference-payment-probe.mjs`. Solo GET de catálogos/matriz y POST sin credenciales a flujos documentados de cotización. No crea wallet ni ejecuta una solicitud firmada. Informe: `vault-lab/output/payment-research/unpaid-quotes-20260915.json`, 16:03:46 UTC.

- BlockRun: prompt sintético «Say ok.», Haiku 4.5, máximo 128 tokens, sin streaming. HTTP 402, precio 0.002000, 2.000 unidades de USDC de 6 decimales, cadena `eip155:8453`, autorización de hasta 300 segundos. No es costo de una conversación real de Vault ni costo final de inferencia ejecutada; solo quote de esa entrada pequeña.
- NanoGPT: ejemplo documentado gpt-4.1-nano con la misma entrada y límite. HTTP 402, precio descriptivo USD 0.00005742, body hash y expiración. Las opciones difieren: x402-exact Base exige 1.000 unidades, mientras base-usdc exige 57. No son precios comparables a Haiku, ni todas las vías cobran lo mismo.
- En NanoGPT, `amountUsd` descriptivo no coincide con 1.000 micro-USDC de la vía exact. Usar importe entero de la vía elegida, verificar decimals/activo y explicar o rechazar discrepancias; nunca autorizar basándose solo en el texto USD. La relación puede ser un mínimo de vía, pero no se asume su causa.
- La matriz NanoGPT actualmente anuncia más vías que el texto histórico de junio de su documentación. Lo observado en HTTP tiene fecha propia y no prueba que la liquidación funcione.
- Cero firmas, pagos o completions pagadas. No se guardaron invoices, tokens L402 ni payloads de autorización en el informe.

## Circuito recomendado

Separar costo de inferencia Q de entrada de juego G. Mostrar total T = Q + G + cargos externos explícitos. G alimenta bounty, continuidad y operación según términos; Q paga el proveedor. Alternativa de UX: precio total fijo P por modelo con Q acotado dentro de su fracción operativa; se rechaza la admisión cuando la cotización ya no cabe, en vez de reducir silenciosamente el premio. Simular ambas opciones antes de congelar precios.

Primera prueba con pago directo del jugador al proveedor y reserva separada del componente de juego. Esta variante no requiere saldo agregado en OpenRouter ni adelantar inferencia con capital del fundador:

1. El ejecutor construye el request exacto con prompt base, contexto y herramientas y obtiene quote sin pago. Fija round/config/beneficiario/request hash e ID de intento.
2. Verifica método/red/activo/decimals/payee autorizado, importe total, expiración y cobertura. Obtiene compromiso de admisión antes de revelar estrategia o permitir inferencia elegible.
3. El jugador reserva G en el escrow y autoriza el pago exacto Q desde su wallet al proveedor. Puede requerir más de una confirmación; no prometer una sola firma o atomicidad entre ambos sistemas. El orden asegura que inferencia de prueba fuera de la ronda no pueda reclamar su premio.
4. El ejecutor envía el cuerpo comprometido y la autorización al gateway. El jugador no puede entregar una respuesta arbitraria al contrato ni sustituir el prompt del guardián. EIP-3009 firma transferencia, no el cuerpo del chat: la vinculación request/resultado debe tener evidencia adicional verificable.
5. Al recibir resultado, validar configuración, evidencia y liquidación. G solo se consume si el intento es válido, incluso si gana; se contabiliza el aporte y se adjudica el premio conforme al orden preestablecido. Un éxito HTTP no prueba que el pago del proveedor se haya liquidado.
6. Si falla la reserva de G, no autorizar Q. Si hay pago o ejecución ambiguos, conservar ID y resolver sin volver a inferir ni emitir otra autorización pagada a ciegas. Cada estado tiene TTL y vía de recuperación publicada.

El protocolo x402 comunica requerimientos/autorizaciones/resultado de settlement. El momento de liquidación depende de la vía; no implica que toda inferencia haya sido prepagada en cadena. BlockRun documenta verificar autorización, reclamar nonce, ejecutar y liquidar después; puede devolver respuesta con settlement false. Fuente: [x402 HTTP](https://docs.x402.org/core-concepts/http-402), [BlockRun flujo](https://blockrun.ai/docs/x402/payment-flow).

**Garantía buscada:** no admitir una ejecución elegible sin un mecanismo de pago válido y fondos suficientes para su precio aceptado. No prometer disponibilidad perpetua; si falta pago, liquidez o proveedor, se rechaza antes de admitir/cobrar el componente del juego, con tratamiento explícito para fallos posteriores.

## Red y token: decisión que sí cambia el trabajo

El circuito más corto sin balance puente propio usa el mismo activo/red que el proveedor: USDC Base es la primera vía observada para ensayar. Es una propuesta para la prueba de pagos, no una migración de la beta Robinhood ni permiso para trasladar fondos existentes.

Si el juego permanece en Robinhood, hay tres posibilidades:

- Dos componentes visibles: G en el token Robinhood y Q en USDC Base desde la wallet del jugador. Elimina saldo propio de inferencia, pero introduce doble red/firma y no es la mejor UX mobile.
- Convertir y trasladar Q procedente de ese intento, esperando fondos finales en la vía aceptada antes de autorizar inferencia. Depende de ruta real soportada, mínimo, slippage, gas, demora y expiración de quote. La transferencia cross-chain no es atómica con el modelo. Si el proceso falla, las obligaciones se conservan en los activos efectivamente recibidos según términos explícitos.
- Mantener inventario operativo USDC Base repuesto desde cobros Robinhood. Es más fluido, pero vuelve a necesitar capital de trabajo y reserva de liquidez por intento; no cumple la versión estricta de cero saldo intermedio.

Para el token Long futuro aplica lo mismo. Un token de juego no se convierte automáticamente en medio de pago del proveedor, aunque tenga cotización. No iniciar inferencia basándose en una promesa de swap o en el valor teórico del token.

## Créditos y errores

El pago directo por intento permite prescindir de una recarga masiva en la primera prueba. No borra créditos anteriores ni cambia los derechos de sus dueños. Si se conserva crédito prepago de Vault, lo disponible queda respaldado y retirable; Q se separa únicamente al autorizar ese intento. Un escrow no debe presuponerse compatible con la firma de USDC que exige el facilitador: probar EOA/smart-wallet/contrato y la vía precisa. [Compatibilidad x402](https://docs.x402.org/advanced-concepts/wallet-compatibility).

No existe atomicidad automática entre pago al proveedor, inferencia y el juego. Si el proveedor cobra Q pero su respuesta no supera nuestras reglas/evidencia, devolver G no recupera Q. Hay dos políticas posibles: costo de cómputo efectivamente pagado no reembolsable y divulgado antes de jugar, o compensación desde un fondo operativo acotado. No cambiar la política de devolución completa vigente sin decisión explícita. Para conservarla se necesita reserva de errores, aunque ya no se necesite saldo OpenRouter.

Es crucial distinguir: no financiar inferencia por adelantado, no tener ninguna reserva operativa y nunca sufrir interrupciones son tres objetivos diferentes. El primero es alcanzable por diseño de pago directo; los otros dos no se deducen de x402.

## Aspectos que deben superar los candidatos

BlockRun publica precio firmado exacto sin devolución por menor salida; su FAQ comercial también dice cobrar por uso real. Sus páginas de errores tampoco tienen el mismo alcance entre servicios. Para Vault manda el contrato del endpoint elegido y el ensayo de settlement: no asumir que todo error devuelve Q. No usar autorouting/fallbacks ni truncamiento oculto de contexto; verificar flags y exigir fallo cerrado, no aceptar una respuesta modificada.

NanoGPT documenta conciliación posterior de quotes de chat y posible devolución/ajuste tras errores. Falta comprobar máximo exigible, destino y plazo de devoluciones para cada vía. Ofrece pinning y [verificación TEE](https://docs.nano-gpt.com/api-reference/tee-verification), pero esos endpoints muestran autenticación por key: acceso a prueba de una llamada accountless, modelo exacto y correspondencia de bytes siguen sin demostrar. [Routing](https://docs.nano-gpt.com/api-reference/miscellaneous/provider-selection).

Pagar x402 prueba autorización/liquidación según evidencia obtenida, no ejecución honesta del LLM. El ejecutor verificable y resistencia a muestras ocultas del plan principal siguen siendo obligatorios. Tampoco se puede copiar el consejo de algunos SDK de generar otro nonce/reintentar en todos los errores: un nuevo pago podría generar otra muestra elegible. La extensión [Payment-Identifier](https://docs.x402.org/extensions/payment-identifier) es una referencia de recuperación, no se presupone implementada por un gateway.

## Próxima prueba concreta

Recomiendo ensayar primero BlockRun exact USDC en su testnet documentada, como prueba de pago, y contrastar NanoGPT cuando se resuelvan las discrepancias de quote/conciliación. No elegir proveedor final por catálogo o precio solamente.

Pruebas de aceptación: quote→firma acotada→respuesta→settlement comprobado; dos solicitudes simultáneas; nonce repetido; conexión cortada después del pago; error/truncamiento y refund; intento A/B con mismo precio pero distinto cuerpo; configuración/prompt sin cambios; wallet beneficiaria distinta rechazada; comprobación de evidencia de modelo. Gas/infraestructura presupuestados por separado. Usar prompt sintético y claves de prueba sin acceso al treasury; no iniciar una ronda con premio para probar el transporte.

No usar balance, key o sponsors de la beta real para esos ensayos sin configuración revisada. La siguiente entrega debe resolver tanto pago como procedencia del resultado, o reportar con precisión cuál de las dos propiedades sigue pendiente.
