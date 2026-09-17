# Tesorería del guardián: recargas, premio y creator fees

Revisión: **14 de septiembre de 2026, 07:14 UTC**. Documento de diseño y research; no configura una emisión ni habilita fondos. Complementa la [propuesta completa](README.md). Robinhood Chain + Long es una **ruta candidata, todavía no seleccionada para este juego**.

Actualización posterior del 14/9: el registro RHJ y el RPC público permitieron comprobar el candidato NVDA sobre 4663, incluidos código presente y decimales. [Evidencia de esa consulta](ASSET-CHECK-2026-09-14.md). A las 22:30 UTC se pudo leer en Long un par AI/NVDA y su Community Vault, con quema/distribución de fees declaradas en la interfaz. El formulario de creación sigue sin cargar; no se heredan sus porcentajes o contratos para Vault. [Consulta actual y separación del bounty](LONG-LAUNCH-CHECK-2026-09-14.md).

La recomendación es separar tres cosas desde el primer depósito: créditos pendientes de consumir, premio comprometido y dinero de operación. Una recarga no aumenta automáticamente el premio. Un intento válido consume su precio y aplica un reparto publicado; un error técnico devuelve la reserva. Los creator fees y sponsors pueden subsidiar el premio cuando sus activos fueron efectivamente recibidos y asignados.

## Hechos actuales y límites de verificación

| Tema | Evidencia consultada hoy | Implicación para este producto |
| --- | --- | --- |
| Red | Robinhood anunció mainnet pública el **1 de julio de 2026**. [Anuncio oficial](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading/?lang=en). | Mainnet disponible; no es un proyecto limitado a testnet. No prueba disponibilidad de una factory concreta. |
| Configuración | Mainnet **4663**, testnet **46630**, gas **ETH**. RPC público mainnet `https://rpc.mainnet.chain.robinhood.com`; testnet `https://rpc.testnet.chain.robinhood.com`. Los endpoints públicos tienen límites y no se recomiendan para producción. [Conexión oficial](https://docs.robinhood.com/chain/connecting/). | Mantener chain ID en toda orden, recibo e identificador de activo. Token del juego no paga el gas nativo por sí solo. |
| Wallet y contratos | La documentación describe Robinhood Wallet y wallets EVM como MetaMask; Solidity/Vyper y herramientas Ethereum. [Wallets](https://docs.robinhood.com/chain/add-network-to-wallet/), [contratos](https://docs.robinhood.com/chain/deploy-smart-contracts/). | Un depósito ERC-20 es técnicamente plausible. No equivale a listado en el broker Robinhood ni demuestra que nuestro conector móvil funcione. No se conectó ninguna wallet. |
| Finalidad | La documentación distingue confirmación del secuenciador, publicación en Ethereum y finalidad L1. [Finalidad](https://docs.robinhood.com/chain/transaction-finality/). | Publicar qué nivel vuelve gastable una recarga y qué nivel confirma un payout. No etiquetar una transacción enviada como pagada. |
| Long | La app anuncia lanzamientos con Stock Tokens en Robinhood Chain. Sus términos, efectivos el **8/9/2026**, describen creación y operaciones mediante contratos. [App](https://app.long.xyz/), [términos, §2](https://app.long.xyz/terms). | Ruta real a investigar; no se verificó hoy su formulario completo, factory vigente o configuración emitida para este proyecto. |
| Claims de Long | Los términos §8 requieren iniciar el claim aplicable; la cifra estimada no es pago automático. Disponibilidad y reparto dependen de contratos y permisos. [Fuente oficial](https://app.long.xyz/terms). | No presupuestar el premio con el contador de fees ni con volumen futuro. |
| Stock Token | RHJ describe ERC-20 que dan exposición económica, sin derechos sobre las acciones subyacentes. Emisión primaria restringida a participantes autorizados. [Documentación del emisor](https://docs.robinhood.com/chain/stock-tokens/). | Nuestro token sería otro activo; emparejarlo con una acción tokenizada no le transfiere respaldo ni derechos sobre esa empresa. |
| Acceso a activos | Los documentos RHJ incluyen restricciones de jurisdicción/persona. Long §5 aclara que una ruta intermedia por Stock Tokens también conserva restricciones. [RHJ](https://docs.robinhood.com/chain/stock-tokens/), [Long](https://app.long.xyz/terms). | Antes de fijar quote o premio, revisar activo, operador, usuarios y rutas concretas. Este documento no concluye elegibilidad ni clasificación legal del juego. |

**Limitación de esta revisión:** las páginas oficiales anteriores fueron leídas hoy. `docs.long.xyz` no devolvió documentación utilizable; tampoco se logró refrescar el contrato de Robinhood Blockscout: el navegador de búsqueda no abrió el recurso y el GET de shell encontró una restricción de socket. Se conserva la evidencia histórica local como tal. No se afirma auditoría actual del bytecode, estado, saldos ni permisos de Long. No se cambió ubicación ni se usó una cuenta para superar esos límites.

## Creator fees: qué está demostrado y qué falta

El expediente [round-03 / DECISION](../../output/research-2026-09-12/round-03/DECISION.md) y su [ledger de fees](../../output/research-2026-09-12/round-03/fees/LECTURA.md) son una auditoría histórica del **12/9**, con corte al bloque **60.871.576, 05:52:06 UTC**. No son las condiciones universales de Long.

Para **CATGPT / OPENAIx1L**, el expediente conserva calldata, código y transferencias:

- Componente LP: **0,2%**; share inicial del creador: **95% de ese componente**, nominal **0,19%** de la base correspondiente. No es 95% de todo el swap ni una fórmula aplicable sin más al volumen USD de un agregador.
- Hook separado: tasa terminal **1,4%** en los swaps contrastados, con distribución al integrador; no se atribuye toda al creador. El expediente encuentra un schedule inicial distinto y advierte que el denominador ejecutable difiere del comentario.
- **16 claims positivos** entregaron tokens CATGPT y OPENAIx1L. **19 ventas** relacionadas por cuenta, cantidad y proximidad entregaron **3,193118245290266401 ETH** al receptor. No es beneficio total, saldo actual ni prueba de futuras ventas.
- `Collect` mueve/cuenta fees del pool al contrato; `Release` registra la distribución al beneficiario. Sumarlos como dos ingresos duplica el flujo.

Fuentes primarias enlazadas en el expediente: [initializer](https://robinhoodchain.blockscout.com/address/0x4e3468951D49f2EEa976eD0D6e75fFCb44a9a544?tab=contract), [hook](https://robinhoodchain.blockscout.com/address/0x6f02324d20CC679d0E585290CAa6b16baCbC0F77?tab=contract), [claim de ejemplo](https://robinhoodchain.blockscout.com/tx/0x20926bd69c982d2c0ae71ba761b09b98121c280aa81bf9706ce2fd518c892ae0), [rotación del beneficiario](https://robinhoodchain.blockscout.com/tx/0x74fab9540e2fe6c7cb4fd9f11aa7e0722258be33e9dcd66203eb3ea80e9c1239). Estas transacciones no fueron reconsultadas exitosamente hoy; su respaldo es el raw preservado por aquella auditoría.

### Quién puede cobrar y cambiar el destinatario

El [FeesManager.sol guardado en la auditoría](../../output/research-2026-09-12/round-03/fees/FeesManager.sol) permite llamar `collectFees(poolId)`, pero libera la participación correspondiente a **`msg.sender`**. Un tercero que dispare la recolección no se convierte en beneficiario ni cobra la participación ajena.

`updateBeneficiary(poolId, newBeneficiary)` traslada **la participación del llamador**, liquida lo acumulado para los beneficiarios involucrados y registra `UpdateBeneficiary`. No ofrece en `collectFees` un destinatario arbitrario para cada cobro. La auditoría conserva una rotación real de CATGPT.

El [código upstream de Whetstone leído hoy](https://raw.githubusercontent.com/whetstoneresearch/doppler/main/src/base/FeesManager.sol) mantiene esa estructura, pero añade `CallerNotBeneficiary` y otras diferencias frente al snapshot. **No se equipara upstream/main con el contrato desplegado por Long.** Tampoco se infiere del comentario de `updateBeneficiary` una recolección nueva del pool: en el código examinado llama a `_releaseFees`, no a `_collectFees`.

Consecuencia de implementación: si el beneficiario es un contrato de tesorería, debe poder ejecutar el claim desde su propia dirección. Una dirección de escrow que solamente recibe ERC-20 no basta. Un keeper externo necesitaría una función del contrato que efectúe esa llamada; la capacidad, destino y límites se verifican antes de asignarle shares. Una multisig ejecutora sería otra alternativa a comprobar, sin presentarla como «wallet autónoma de la IA».

**Para este juego sigue pendiente:** factory/initializer/hook exactos; PoolKey; LP fee y schedule; beneficiarios y shares; autoridad de rotación; actualizaciones/pausas; activos cobrados; función de claim; compatibilidad del receptor y políticas de gas/conversión. No hay un `feeRecipient` seleccionado ni aprobado aquí.

## No importar la economía de otros proyectos

| Referencia local | Qué dice su propio expediente | Qué no hereda el guardián |
| --- | --- | --- |
| OCAT | El [roadmap de OCAT](../../../ocat/docs/ROADMAP.md) advierte que contiene historia prelaunch y una actualización posterior. Su historial describe LP 0,1% × share 95% = **0,095% nominal**, y una propuesta 80/20 de fees cobradas para liquidez/operación. | Ticker, CA, META, supply 1B, asignaciones, destinatario, 80/20 ni 0,095%. Esa reserva de liquidez tampoco es un premio de juego. No se reauditaron sus contratos hoy. |
| BELLFLY | [Research del 10/9](../RESEARCH.md): Bankr candidato, Pons v2 alternativa, NVDA por validar; cita defaults del proveedor y se declara provisional. | Defaults Bankr, supply 100B, vesting, límites de creación ni tarifa 1,75%. No son términos de Long ni de nuestro juego. |
| CATGPT | Caso histórico con LP 0,2%, share 95% y hook separado. | Su volumen, conversiones, beneficiarios o tasa nominal no se convierten en presupuesto nuestro. |

## Circuito mínimo propuesto

**Primer piloto contable:** un solo activo aceptado `T` para recargar y denominar el premio; créditos internos no transferibles. La identidad de `T` será `(chainId, tokenAddress, decimals)`, todavía sin elegir. No hace falta emitir un segundo token de créditos. Mantener premio y recargas en el mismo activo evita introducir una conversión obligatoria antes de validar el circuito.

Esto no estabiliza el valor de `T` ni paga la API en moneda fiat. La operación necesita presupuesto líquido propio y una conversión comprobada si se pretende financiarla vendiendo `T`. El premio se anuncia como una cantidad de `T`; USD es una referencia con fuente y hora, nunca una garantía.

1. **Orden de recarga:** wallet, chain, token exacto, destino, cantidad mínima/esperada, créditos ofrecidos, vencimiento y política de devolución visibles antes de confirmar. Verificar autorización de la wallet mediante challenge con nonce/dominio/vencimiento; conectarse no es aprobar gasto.
2. **Depósito:** verificar receipt exitoso y evento del token/destino correctos. Acreditar el importe realmente recibido, con decimales leídos del activo; para el piloto aceptar un ERC-20 sin rebasing ni transfer tax verificado. Rechazar supuestos por ticker o transacciones de otra red.
3. **Idempotencia y finalidad:** identificar `(chainId, tokenAddress, txHash, logIndex)` y registrar bloque/hash. Aplicar una política de confirmación explícita, detectar reorganizaciones y no acreditar dos veces. Un hash enviado por el cliente es un candidato, no evidencia suficiente de pago.
4. **Crédito:** el depósito confirmado aumenta la obligación por créditos disponibles. No se reconoce simultáneamente como ingreso, bounty o token quemado. Propuesta de devolución: créditos no consumidos reembolsables en sus unidades de `T`, con gas y mínimos publicados.
5. **Intento:** precio fijo en créditos según ronda/modelo; reservar antes de llamar al proveedor. Un `attemptId` idempotente, una posición de cola y un único resultado evitan doble cobro o doble payout.
6. **Respuesta válida locked:** consumir una vez y asignar el reparto comprometido. «No convenciste al guardián» es distinto de un error técnico.
7. **Error/resultado ambiguo:** no convertirlo en derrota. Error técnico confirmado libera la reserva; ambigüedad exige reconciliar antes de cobrar, devolver o permitir una repetición que pueda duplicar el intento. El costo de API ya incurrido se cubre con operación.
8. **Respuesta válida released:** aplicar la política del intento ganador, cerrar admisión, reservar el premio y ejecutar un único payout. La propuesta previa incluye el aporte del intento ganador antes del payout. Devolver reservas posteriores que no fueron procesadas.
9. **Pago:** destinatario fijado por la sesión aceptada y reglas; el LLM solicita una decisión estructurada, no controla direcciones, montos, firmas generales o retiros operativos. Publicar quién firma y qué permisos tiene.

Si el premio debe ser una stablecoin `S`, tratarlo como otra decisión: depósito `T` → cotización y swap ejecutado → crédito denominado en `S`. Solo el `S` realmente recibido respalda esas unidades; deben publicarse mínimo recibido, fees, slippage, vencimiento y moneda de devolución. No prometer un saldo fijo en `S` conservando únicamente `T` volátil como respaldo. La ruta y elegibilidad de `S` siguen sin verificar.

## Reparto de partida: hipótesis para medir, no tokenomics demostrada

Para probar el ledger proponemos **70% premio activo / 20% operación / 10% reserva para próximas rondas**, aplicado al precio de cada intento válido consumido, incluido el ganador. Es un punto de partida ilustrativo: prioriza el premio, muestra el costo operativo y evita que ganar vacíe también la semilla siguiente. No es una tasa óptima, un compromiso publicado ni una consecuencia de las tarifas de Long.

La validación económica es obligatoria antes de adoptar ese reparto: el valor realizable neto de la parte operativa debe cubrir inferencia, errores pagados al proveedor, infraestructura, gas y conversión. Medir por modelo y longitud de contexto; no vender al mismo precio ilimitado modelos con costos distintos. El costo de un error reembolsado al usuario sigue existiendo para el negocio.

Condición de continuidad: `operación líquida disponible >= costo comprometido de intentos aceptados + margen operativo definido`. Si no se cumple, pausar nuevas admisiones o cambiar el precio/reparto de la **siguiente** ronda. No gastar los créditos sin consumir ni reducir un premio ya comprometido. Creator fees futuros y nuevas compras de jugadores no se incluyen en esa cobertura.

Ejemplo exclusivamente en `T`, con precio 100 créditos y 1 crédito = 1 T:

| Evento | Activos custodiados T | Créditos pendientes T | Premio activo T | Operación T | Reserva siguiente T | Ganador por pagar T |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Recarga de 1.000 T | 1.000 | 1.000 | 0 | 0 | 0 | 0 |
| Un intento válido locked | 1.000 | 900 | 70 | 20 | 10 | 0 |
| Otro intento falla técnicamente y se libera | 1.000 | 900 | 70 | 20 | 10 | 0 |
| Intento válido ganador, payout pendiente | 1.000 | 800 | 0 | 40 | 20 | 140 |
| Payout de 140 T confirmado | 860 | 800 | 0 | 40 | 20 | 0 |

La reserva de intentos es un subconjunto de créditos pendientes, no otra obligación sumada dos veces. El ejemplo excluye seed externo, sponsors, gas y conversión. **40 T operativos no equivalen a 40 USD ni a beneficio neto.** Una semilla futura finita no demuestra un bounty infinito.

Supply, reparto inicial, vesting, LP, mint/burn/admin y transfer tax son decisiones distintas del reparto por intento. No fijamos supply o asignación del equipo por copiar a OCAT/BELLFLY. El token compra acceso; esta propuesta no añade dividendos, interés, respaldo accionarial, recompra garantizada o derecho de los holders al premio. Su demanda y sostenibilidad siguen sin validar.

## Creator fees y sponsors como ingresos separados

**Creator fees opcionales:** mantener el módulo inactivo hasta verificar destinatario/contrato. Luego una política simple a evaluar es destinar el 100% de los activos cobrados que se asignen a esta campaña al premio; pagar el gas de claim con presupuesto operativo separado. Si se elige otro porcentaje, mostrarlo sobre el importe efectivamente cobrado, no sobre el volumen de trading.

Estados separados: `estimado no cobrado → claim enviado → recibido por activo → conversión pendiente/ejecutada → asignado a ronda`. No asignar el mismo claim a premio y liquidez; no contar el `Collect` y el `Release` dos veces. Si el claim entrega `T` y un quote `Q`, registrar ambos. `Q` solo aumenta un premio denominado en `T` cuando la conversión a `T` y su asignación terminan, o si las reglas prometieron expresamente un premio compuesto.

**Sponsors:** separar aporte al premio, servicio publicitario e infraestructura en especie. Una promesa o factura no aumenta caja. Publicar importe comprometido/recibido/asignado, contrato de activo, transferencia, ronda, entregables y autorización de marca. Propuesta: 100% del componente «aporte al premio» al escrow; el honorario de publicidad va a operación. No extrapolar audiencia, clics ni conversiones todavía inexistentes.

Antes de abrir, acordar cancelación y devolución del aporte. Tras abrir, ni sponsor ni operador deberían poder retirarlo discrecionalmente para modificar el resultado; definir plazo y cierre sin ganador. La publicidad no compra cambios de prompt, orden, dificultad, ganador o acceso privado. Los créditos de API patrocinados reducen costos operativos; no son dinero ganable.

## Conciliación y evidencia mínima

Para cada activo `a`, en unidades enteras y al mismo bloque:

`activos controlados_a = obligaciones de créditos_a + premios activos_a + ganadores por pagar_a + reserva siguiente_a + operación retenida_a + partidas sin asignar_a`

La identidad se aplica a saldos presentes, sin volver a sumar ingresos históricos. Un gasto operativo o payout reduce activos y la cuenta correspondiente. Una conversión tiene salida en un activo y entrada en otro; no se compensan unidades diferentes. Conciliar también `saldo inicial + entradas externas − salidas externas = saldo final`; las asignaciones internas no son nuevas transferencias recibidas. Investigar cualquier diferencia, no taparla con una cotización USD.

Mostrar al público, con timestamp/bloque y enlaces:

- Premio realmente reservado y obligaciones que no están disponibles para ganarlo.
- Recargas confirmadas/pending, créditos disponibles/reservados/consumidos y devoluciones.
- Intentos válidos locked/released, errores y recibos; precio, reparto y versión de reglas de cada uno.
- Fees por activo: estimados, reclamados, recibidos, vendidos y asignados; gastos de claim/ruta por separado.
- Sponsors y contribuciones, seed de cada ronda, pagos pendientes y pagos confirmados.
- Direcciones, contratos, claves con autoridad descritas por rol —sin exponer secretos—, pausas, retiros y cambios permitidos.
- Export JSON/CSV con IDs de depósito/intento/ronda/asignación y transacciones. La conciliación del operador no es atestación independiente de la inferencia.

## Antes de una integración con dinero

1. Fijar red, `T`, quote, activo premio, factory y destinatarios exactos; verificar contrato y configuración actual, sin reutilizar direcciones de otros proyectos.
2. Elegir autoridad de resultados, custodia de créditos, escrow del premio y política de cambios/cierre. Si el operador puede moverlo, describirlo sin atribuir autonomía exclusiva a la IA.
3. Probar con fixtures/testnet duplicados, fondos en otra red, token incorrecto, reorganización, reserva/reembolso, timeout, carrera con ganador, reinicio y reintento de payout. Testnet no demuestra el comportamiento del token mainnet ni su liquidez.
4. Medir costos reales por modelo y probar el precio/reparto con un presupuesto acotado, previamente definido. Validar conversiones con cantidades netas y límites; un quote no prueba ejecución.
5. Publicar reglas y reconciliación de ejemplo antes de aceptar recargas. La revisión de elegibilidad del operador/usuarios y del juego queda pendiente; no hay conclusión legal en este documento.

No se leyeron claves, conectaron wallets, firmaron mensajes, movieron fondos, emitieron tokens ni contactaron sponsors. Solo se creó este documento; app y README quedan fuera de esta entrega.
