# Comisiones CATGPT y ANTHROPIG LongX: cobros, ventas y economía

Auditoría pública y de solo lectura realizada el 12 de septiembre de 2026. Historial de eventos cerrado al bloque RH **60.871.576, 05:52:06 UTC**. RH chain ID 4663. No se conectó wallet, firmó ni envió ninguna transacción.

## Resultado que cambia la lectura económica

**CATGPT tiene comisiones pagadas verificables, pero el contador USD de LONG no representa por sí solo ingresos realizados. ANTHROPIG LongX todavía no había retirado comisiones LP en este corte.** El creador participa del componente LP: no cobra toda la tarifa de aproximadamente 1,6% que soporta un swap del pool principal.

| Concepto | CATGPT | ANTHROPIG LongX |
|---|---:|---:|
| CA | `0xd6FDE6a3Fc6Ab2d83b2BE58383944CA1baDe1E18` | `0x351Ab2C51e223B28D219fE28cc3956410CC11e18` |
| Quote | OPENAIx1L `0xfe09Fb328bE1c286B4f597eD34764b7472ae72c5` | ANTHROPICx1L `0x1937caD42b17D43bB2b347ce16d5288887C46c33` |
| Pool ID v4 | `0x086f510359ad57e4f8588b71ffa21fe29bbed044e4d13aa2f72ecaefeda95a36` | `0xaf28b153a45c4647ed76860811f734152e3c93e29c6a4489691954b71716d310` |
| Bloque de creación | 60.652.312 | 60.661.247 |
| Creación UTC | 11-sep 23:40:32 | 11-sep 23:55:47 |
| `collectFees(bytes32)` / eventos Collect | 16 | 0 |
| Release con valor positivo | 16 | 0 |
| Meme transferido al beneficiario | **1.848.755,210494633688854640 CATGPT** | **0 observado** |
| Quote transferido al beneficiario | **5.500,083712736491249354 OPENAIx1L** | **0 observado** |
| Gas de collectFees, `fee.actual` del explorer | **0,000486402672844 ETH** | 0 por ausencia de cobros |
| Último cobro UTC | 12-sep 04:58:29 | No observado |

Los 16 pagos CATGPT concuerdan, en unidades enteras, entre cada evento Release y las dos transferencias ERC20 de su transacción. Collect suma **1.946.058,116310140725110156 CATGPT + 5.789,561802880517104591 OPENAIx1L** recogidos desde el pool al initializer. No es un segundo ingreso que pueda sumarse a Release: el 95% fue pagado al beneficiario y el resto pertenece a la otra participación LP. No hubo Release positivo del beneficiario LP de 5% en el rango consultado. El saldo aún no recogido desde el pool no se cuantificó con este ledger.

Fuentes: [initializer y código verificado](https://robinhoodchain.blockscout.com/address/0x4e3468951D49f2EEa976eD0D6e75fFCb44a9a544?tab=contract), [ejemplo de cobro CATGPT](https://robinhoodchain.blockscout.com/tx/0x20926bd69c982d2c0ae71ba761b09b98121c280aa81bf9706ce2fd518c892ae0). Raw completo: `fee-event-pages.json`, `claim-transactions.json`, `fee-ledger.json`, `verified-claims-and-rate.json`.

## Beneficiarios y rotación

| Rol | Cuenta | Evidencia |
|---|---|---|
| CATGPT launcher / beneficiario LP inicial 95% | `0x3a8e5Ba5Aa9C2464C75621C2bFFB9CF912DB995d` | Lock en creación |
| CATGPT beneficiario LP posterior 95% | `0x79B069112DF103f28bE2012a52eCEF0F4a5106F2` | UpdateBeneficiary 11-sep **23:44:59 UTC**, bloque 60.654.929; 16 Release posteriores |
| ANTHROPIG LongX launcher / beneficiario LP 95% | `0x346895802e1AeCB0E4951b3Ee96aA37c2CB368Eb` | Lock en creación, ninguna rotación para ese pool hasta el corte |
| Beneficiario LP inicial 5%, ambos | `0x21E2ce70511e4FE542a97708e89520471DAa7A66` | Lock en ambas creaciones |
| Destino de comisiones del hook, ambos | `0x92d435C96E63c43E12d6D0AB28f6b0B04072F765` | `buybackDst` de calldata y Transfer automático observado; también campo integrator en LaunchMetadata |

La [rotación CATGPT](https://robinhoodchain.blockscout.com/tx/0x74fab9540e2fe6c7cb4fd9f11aa7e0722258be33e9dcd66203eb3ea80e9c1239) liberó cero tokens al beneficiario anterior. El contrato permite trasladar shares mediante updateBeneficiary; la reconstrucción de eventos no asigna una identidad humana ni prueba que dos cuentas pertenezcan a la misma persona. El historial público del beneficiario ANTH, 23 transacciones y sin página siguiente, tampoco muestra un retiro de estas comisiones. Cero retiros **no significa** cero comisiones devengadas.

## Tarifa efectiva: código, calldata y swaps reales

Ambas creaciones fijaron el componente LP en **2000/1.000.000 = 0,2%** y un hook Rehype separado. El 95% de la participación LP del launcher equivale nominalmente a **0,19% de la base sujeta al fee LP**, antes de otros costos y supuestos sobre la distribución entre posiciones. No se puede aplicar 0,19% a cualquier volumen USD de un agregador sin reconciliar dirección, monedas, swaps internos y posiciones.

El schedule del hook tiene `startFee=800000`, `endFee=11200`, duración 10 s. **Hay una discrepancia entre los comentarios del código y la constante ejecutable:** RehypeTypes comenta denominador 1e6, pero define `MAX_SWAP_FEE=0.8e6`; `_collectSwapFees` divide por esa constante. El schedule equivale por tanto a **100% inicial y 1,4% terminal del feeBase del hook**, no 80% y 1,12%. Para exact input se cobra sobre output; para exact output, sobre input. No se afirma que alguien haya pagado el 100% inicial: es la configuración, y las pruebas siguientes corresponden a swaps posteriores.

Dos transferencias reales verifican 1,4% terminal, con truncamiento entero:

| Pool / transacción | Salida bruta meme | Meme tomado por hook | Ratio |
|---|---:|---:|---:|
| [CATGPT 23:41:00](https://robinhoodchain.blockscout.com/tx/0x9731757b290b626865a76e51b83f7004eed35059d3b932216ef346b164979f63) | 4.824.109,702455737149703741 | 67.537,535834380320095852 | 1,4% |
| [ANTH LongX 23:55:57](https://robinhoodchain.blockscout.com/tx/0x9e603eb62d9c76b0048ab2bb7f2cc9000ab2e86fda2add75a402fe01112445c0) | 4.965.617,862240466120680262 | 69.518,650071366525689523 | 1,4% |

Los eventos Swap del PoolManager de ambos ejemplos además indican LP fee 2000. El efecto compuesto de LP 0,2% y hook 1,4%, para un exact input pequeño y sin impacto, es **1 − 0,998 × 0,986 = 1,5972%**, antes de router, ruta al quote y gas. La simulación independiente V4Quoter del expediente, `../depth/quotes-first.json`, encontró aproximadamente 1,598% frente al spot para tamaños pequeños. Esto no es una cotización de ejecución al momento de leer el informe.

La matriz ABI de ambos pools es `[0,1e18,0,0,0,1e18,0,0]`, routingMode 0 **DirectBuyback**. Después de reservar 5% del hook para el airlock owner, el resto convierte la pata meme al quote y envía el quote al `buybackDst` anterior. No lo añade al retiro LP del creador. En los swaps citados se observaron transferencias de **1,281067631642648747 OPENAIx1L** y **1,673192022203088341 ANTHROPICx1L** a `0x92d435…F765`. La etiqueta de código «buyback» no prueba quema del meme: aquí la ruta configurada termina en quote transferido a esa cuenta. No se reconstruyó el total histórico del integrator, que también recibe actividad de otros pools.

Solo hubo un FeeScheduleSet por pool. CATGPT actualizó al terminal 11200 a las 23:41:00. ANTH tuvo un FeeUpdated 90080 a las 23:55:56 y 11200 a las 23:55:57. No hubo eventos AirlockOwnerFeesClaimed para estos pool IDs en el rango. Contrato y raw: [Rehype](https://robinhoodchain.blockscout.com/address/0x6f02324d20CC679d0E585290CAa6b16baCbC0F77?tab=contract), `RehypeDopplerHookInitializer.sol`, `RehypeTypes.sol`, `hook-events-and-sample.json`, `swap-transfer-proofs.json`.

## El contador USD de LONG

La UI CATGPT observada por el equipo a las 05:53 mostró **CLAIMED $20.203,79**; una observación anterior marcaba $23.946,81. Multiplicar las cantidades históricas retiradas por los precios Dex de 05:50:45 produce **$20.193,83**, diferencia de solo **0,0493%** respecto de la UI posterior.

La cuenta usa CATGPT $0,007738 y OPENAIx1L $1,07055894, este último inferido de priceUsd/priceNative del mismo pool. Es una **valorización actual hipotética del acumulado histórico**, no saldo actual del receiver, ingreso USD realizado ni profundidad de venta. El parecido y la caída del contador son evidencia compatible con mark to market; no se verificó el código de la fórmula de la UI. Los tokens vendidos antes no deben valorarse hoy y contabilizarse como ingreso histórico.

Raw y horas: `ui-mark-check.json`, `../catgpt-ui.txt`, `../tracked-first.json`.

## Ventas verificadas y ETH efectivamente recibido

Se identificaron **19 ventas** en los 30 segundos posteriores a 15 de los 16 cobros: la cuenta, el token y la cantidad vendida coinciden exactamente con una pata de un Release. Las 19 tienen trazas de pago completas. Se conservan seis candidatos cercanos que no coinciden y se excluyen de esta atribución. La concordancia no elimina la fungibilidad del inventario: el receiver también había comprado CATGPT y recibido monedas de otras fuentes.

| Cantidad de ventas | Token vendido | Cantidad histórica | ETH transferido al receiver |
|---:|---|---:|---:|
| 6 | CATGPT | 1.271.697,964783925140163298 | 0,766118969172475838 |
| 13 | OPENAIx1L | 5.034,727887375435744309 | 2,426999276117790563 |
| **19** | Dos monedas | No se suman unidades diferentes | **3,193118245290266401 ETH** |

Las trazas además muestran **0,032253719649396621 ETH** enviados por el router al fee recipient `0xB8159Ba378904F803639D274cec79F788931C9C8`, separados del pago al usuario. El gas de las 19 ventas fue **0,000855059771962 ETH**. El saldo aritmético de esos 19 ingresos menos únicamente su gas es **3,192263185518304401 ETH**; no es beneficio total del lanzamiento y todavía no descuenta todos los cobros, approvals, lanzamiento, compras, capital, marketing ni variaciones del inventario.

Ejemplo completo: [venta del 12-sep 04:29:44](https://robinhoodchain.blockscout.com/tx/0x1ac3ebba1b720d2587657e740d8f566c785a1064223427d67531458b4ab31f72), tres segundos después del cobro, transfirió 286,781428965212428205 OPENAIx1L desde el receiver al PoolManager. La ruta pasó por 336,239884 USDG y retiró 0,133868171359370448 WETH a ETH; el router pagó **0,132529489645776744 ETH** al receiver y **0,001338681713593704 ETH** al fee recipient, 1% del resultado antes de esa comisión, con truncamiento entero. Gas de la venta: 0,000032203402214 ETH. Los USDG fueron un paso intermedio, no dólares ingresados en una cuenta bancaria ni stablecoins conservadas por el receiver.

Como costos adicionales observados, la creación CATGPT usó 0,000193519619352 ETH de gas y su rotación de beneficiario 0,00000782492477 ETH. La creación ANTH LongX usó 0,000193525829198 ETH. No se convirtieron estos flujos históricos a USD actuales.

El cobro LP está reconstruido completo al corte; **la conversión de todo ese inventario no**. Las cantidades restantes fuera de las 19 concordancias no deben presentarse como saldo retenido ni como tokens nunca vendidos. Datos fila por fila, hash y cantidades enteras: `sales-final.json`. Receipts completos: `sale-transactions.json`; trazas: `sale-internal-transfers.json`, `internal-legacy-test.json`, `sale-internal-v2-pages.json`.

## Cobertura y límites

Se consultaron por GET público los eventos Release, Collect y FeeScheduleSet desde cada bloque de creación hasta 60.871.576; también todos los UpdateBeneficiary del initializer en ese rango y todos los eventos de Rehype indexados por esos dos pool IDs. Todos los resultados quedaron por debajo del límite pedido de 1000 registros por página: CAT 17 Release / 16 Collect, ANTH 0 / 0, diez rotaciones globales filtradas localmente, dos/tres eventos Rehype. Se guardaron URLs, horas y raw. No se confundió este ANTHROPIG con el homónimo WETH `0x04d6…BDC6`.

Para ventas se paginaron tres páginas de 50 transacciones salientes CAT, hasta una transacción anterior a la creación; se examinó una ventana de 30 segundos después de cada cobro y se contrastó cantidad ERC20 exacta. Esto identifica ventas relacionadas por cuenta, moneda, cantidad y cercanía temporal, pero **no constituye una contabilidad completa de inventario** de una cuenta que también operó otros tokens. Algunas transacciones mezclan cantidades que no coinciden con un único cobro y quedan excluidas de la atribución estricta.

La API produjo algunos 429 en consultas complementarias y un 422 inicial de paginación por serialización de fecha/duplicación de filtro; el historial se completó preservando fechas ISO y los eventos de cobro no quedaron afectados. Tras un reintento limitado del endpoint legado, nueve trazas se completaron mediante veinte páginas REST, sin errores ni página siguiente pendiente. Todas las19 conversiones incluidas tienen trazas completas. Se conservan los intentos fallidos. No se atribuye coordinación, wash trading, rentabilidad total, control humano compartido ni fraude.

**Lo que cambia una decisión de lanzamiento:** hay un mecanismo de cobro LP que ya pagó en CATGPT, pero la economía del creador es una fracción del fee total y parte de la cifra visible son memes revalorizados. Se necesita continuidad de volumen externo, resultado de ventas e inventario, costos y distribución propios para hablar de beneficio neto. Un cero de retiros ANTH tampoco permite concluir que esa narrativa no produce fees.

