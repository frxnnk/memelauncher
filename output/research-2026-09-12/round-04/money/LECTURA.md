# MONEY / Own: precio activo, staking todavía diminuto

**Actualización de mercado:** a06:33 MONEY/SPY pasó aMCUS$1.060.265,−17,70% frente a06:12 y todavía+73,17% frente a04:11. Este documento conserva la lectura de contratos de06:26. [Comparación nueva](../MERCADO-0635.md).

12/09/2026. Estado leído al bloque Robinhood **60.891.933, 06:26:31 UTC**. Mercado citado: captura 06:12:36 UTC. Investigación pública, sin wallet ni transacciones enviadas.

**MONEY merece una categoría distinta de los memes que solo adoptan un ticker de acciones: tiene un protocolo y un destino de fees documentados. Pero el crecimiento de su precio todavía no demuestra adopción del producto eUSD.** El contrato oficial de eUSD tenía 110 tokens de supply total y el vault sEUSD contenía aproximadamente cinco eUSD. Su única recompensa registrada es anterior al lanzamiento del pool MONEY seguido.

## Identidad y promesa exacta

La [documentación de MONEY](https://docs.own.money/money-token) enlaza el mismo contrato que la cohorte DEX, `0x0a8B4763C71aC39101b3B8a97e62Da0B81549a4f`, y lo describe como token de protocolo lanzado en Pons contra SPY. Declara dividir las fees 50/50 entre staking sEUSD y tesorería. También aclara que tener MONEY no da rendimiento por sí mismo y no es requisito para usar eUSD. No se auditó en esta subinvestigación todo el routing de esas fees, la distribución inicial ni la ausencia de insiders anunciada.

El [resumen de Own](https://docs.own.money/) sitúa eUSD como `Launching` y OwnX como `Live`. Describe eUSD respaldado por eSPY sobrecolateralizado y eTokens con reservas y garantías adicionales. Es el diseño declarado por el operador; esta lectura no prueba solvencia de todas sus posiciones ni derecho de rescate frente a un emisor de acciones. No se confundió eUSD, USDG, eSPY y el wrapper SPY.

| Identidad oficial | Contrato Robinhood 4663 |
| --- | --- |
| MONEY | `0x0a8B4763C71aC39101b3B8a97e62Da0B81549a4f` |
| SPY, quote real del pool MONEY | `0x117cc2133c37B721F49dE2A7a74833232B3B4C0C` |
| eSPY, collateral declarado de eUSD | `0xb9D2F8A79F59b84269Adf7d82Fe44ad41139FcF5` |
| eUSD | `0x8B84D644CECaeE6d21373F37E1bA00f85eD7CdB7` |
| sEUSD, proxy del vault | `0x4fefDd560c076CfE9EA0b8f4d21E60Af5A39fE96` |
| Implementación sEUSD vigente según Blockscout | `0x74F5A0C905d22eF2DC2cC7ae0390BbfEc99bE154` |

La [lista de direcciones del operador](https://docs.own.money/resources/addresses) coincide con DEX para MONEY y SPY. El explorador identifica la implementación del proxy; las fuentes EUSD y StakedEUSD están verificadas. Verificación de código no significa auditoría independiente de seguridad ni ausencia de controles administrativos.

## Estado observado: no extrapolar el precio del meme al uso de eUSD

Las llamadas `eth_call` se fijaron al mismo bloque y comprobaron 18 decimales para eUSD y sEUSD. `asset()` del vault devuelve exactamente el eUSD de la lista oficial.

| Lectura de contrato | Resultado al bloque |
| --- | ---: |
| eUSD `totalSupply` | **110 eUSD** |
| sEUSD `totalSupply` | **4 shares** |
| sEUSD `totalAssets` | **5,000000000000000001 eUSD** |
| eUSD `balanceOf(sEUSD)` | **5,000000000000000001 eUSD** |
| sEUSD `convertToAssets(1 share)` | 1,25 eUSD |
| sEUSD `vestingAmount` | 1 eUSD |
| sEUSD `getUnvestedAmount` | 0 |
| sEUSD `vestingPeriod` | 28.800 segundos / ocho horas |
| sEUSD `lastDistributionTimestamp` | **09/09/2026 14:48:15 UTC** |
| sEUSD `incentivesController` | Dirección cero |

El explorador reporta dos direcciones holders de sEUSD y cuatro de eUSD. No son personas únicas. En sEUSD, uno de los destinatarios históricos es la dirección de burn usada para sembrar shares: no contarlo como usuario adquirido.

No se traduce 1,25 eUSD por share a un APY: la variación histórica depende del tamaño y fecha de los depósitos/recompensas. Tampoco se interpreta la dirección cero de `incentivesController` como prueba de que no pueda haber `transferInRewards`; son mecanismos diferentes.

## Historia de recompensas y depósitos

La consulta pública de logs devolvió **13 eventos y `next_page_params=null`**, desde la creación hasta el evento más reciente del vault. Se conservaron todos, incluidos Initialize/Upgraded y Transfer, para evitar presentar solo eventos positivos. La lectura de `lastDistributionTimestamp` concuerda con el recibo de la recompensa.

| Fecha UTC | Evento comprobado |
| --- | --- |
| 09/09 14:43:28 | [Creación del proxy](https://robinhoodchain.blockscout.com/tx/0x24c2882981872e2ce80961d3087b79ba7e171a1759f96978443a64ab3f8d7d28). En el mismo bloque hubo un depósito inicial de 1 eUSD que emitió 1 share a `0x…dEaD`. |
| 09/09 14:48:15 | En ese bloque: depósito de 5 eUSD, retiro de 2 eUSD y [una recompensa de 1 eUSD](https://robinhoodchain.blockscout.com/tx/0x2f26932b6714b4e21c8f2b2f1d4cd4ad780415f57566c1227912f2fef7d6e63a) desde la cuenta creadora del proxy. La tabla no supone un orden dentro del bloque. |
| 10/09, bloque 59.275.850 | Depósito de 101 eUSD por otra dirección, a cambio de 80,800000000000000004 shares. Hora exacta del depósito no consultada. |
| 10/09 08:54:48 | [Retiro de esas shares](https://robinhoodchain.blockscout.com/tx/0xc119a62c20b3a3acfc9afb98c731602682c5623a96f78a64bd7764243b92439f), por 100,999999999999999999 eUSD. |
| 11/09 17:56:08 | Creación del pool MONEY/SPY según `pairCreatedAt` de DEX. |
| 12/09 06:26:31 | La lectura actual conserva como última distribución la del 9/9; no apareció otro RewardsStreamed en el historial del vault consultado. |

La única recompensa precede en más de dos días al pool MONEY observado. **No se puede atribuir ese eUSD a fees de ese pool.** La fecha del pool no certifica por sí sola la fecha de despliegue del token ni excluye otros pools; la conclusión aquí se limita al par seguido y al vault oficial.

La [documentación de staking](https://docs.own.money/eusd/staking) explica que un operador llama `transferInRewards`, y que las recompensas se liberan gradualmente. Por tanto, el destino prometido de las fees requiere ejecución operativa; no se comprobó un ingreso actual al vault por cada trade. El estado `Launching` hace compatible que ese circuito aún no tenga escala. No se deduce fraude ni abandono de estos valores.

## Mercado y espacio residual

A las 06:12, MONEY/SPY tenía MC **US$1.288.556**, liquidez reportada **US$93.585,52**, volumen 1h **US$49.071,04** y 119 compras/86 ventas. El precio USD aumentó 110,42% frente a 04:11 y 9,43% frente a 05:50. [Pool exacto](https://dexscreener.com/robinhood/0x13c339deb9ea2f31a6616e89aa097940667d77fa5de2de063f7bcf04b75dd8e5).

Estos datos sostienen continuidad de negociación en MONEY. Los 110 eUSD y cinco en staking no sostienen todavía una narrativa de adopción masiva del producto. No se midió el resto de OwnX, sus reservas, préstamo o liquidez. No se declara que todo el protocolo valga cinco dólares.

La [documentación de gobernanza](https://docs.own.money/protocol/governance) reconoce administración configurable y una migración a multisig como compromiso. No se verificaron aquí titulares activos de todos los roles ni poderes de upgrade; un compromiso futuro no se trata como control vigente.

**Implicación:** este caso abre una familia más específica —token de fees de una aplicación con activos tokenizados—, pero ya tiene un implementador y requiere producto, contraparte y operación reales. Copiar MONEY o añadir una promesa de yield a un meme no constituye un espacio validado. La siguiente señal útil sería un flujo de recompensas posterior al lanzamiento, conciliado con fees, y crecimiento voluntario de depósitos; no otro aumento aislado del token.

## Evidencia y cobertura

- `state-first.json`: 18 llamadas públicas, 16 `eth_call` al bloque fijo; cero errores. Incluye requests/responses y cabecera con hash. `read-state.mjs` solo permite métodos de lectura y no contiene firmante.
- `seusd-implementation.json`, `eusd.json`: ABI/fuentes verificadas; no se ejecutó código descargado.
- `seusd-proxy-info.json`, `eusd-info.json`: metadata y relación proxy/implementación.
- `seusd-creation.json`, `seusd-events.json`, `event-transactions.json`: creación, 13 eventos sin página pendiente y recibos para las fechas citadas.
- Mercado: `../../round-03/tracked-second.json` y `tracked-interval.json`.

Consulta acotada de producto y flujo. No es auditoría completa de seguridad, contabilidad del creador ni solvencia de Own.
