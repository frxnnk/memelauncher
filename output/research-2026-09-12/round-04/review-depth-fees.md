# Revisión independiente: profundidad y ventas de fees

Revisión cerrada el 12/09/2026, aproximadamente 06:36 UTC. Alcance: los dos cortes guardados de Quoter, su script y gráfico, y las 19 ventas seleccionadas del receiver de CATGPT. No se repitió el ledger completo ni se operó una wallet. Los cálculos fueron offline; se hicieron siete GET públicos adicionales para completar transferencias ERC20 truncadas.

**Veredicto: no se encontraron errores materiales en las cantidades, decimales, PoolKeys, resultados del Quoter, porcentajes del gráfico ni sumas de las 19 ventas.** Hay una corrección editorial necesaria para evitar mezclar los dos cortes: la primera frase de `round-03/depth/LECTURA.md` debe decir «Todas las simulaciones de este primer corte usan ese bloque». Actualmente dice «Todas las simulaciones usan ese bloque», aunque luego documenta correctamente un segundo bloque distinto.

La expresión «ANTHROPIG tiene menor profundidad» debe conservar el alcance de la comparación: mayor descuento a igual nominal en unidades de su propia contraparte, en los tamaños observados. No se midió igual capital en USD entre OPENAIx1L y ANTHROPICx1L, ni el mismo número de memes entre los pools LongX y USDG.

## Comprobaciones del Quoter

| Captura | Bloque / hora UTC | RPC totales | Cotizaciones | Resultado |
| --- | --- | ---: | ---: | --- |
| `quotes-first.json` | 60.875.164 / 05:58:10 | 30 | 24 | Sin errores de decodificación ni discrepancias materiales |
| `quotes-four-pools.json` | 60.879.734 / 06:05:54 | 63 | 48 | Sin errores de decodificación ni discrepancias materiales |

Se decodificaron las peticiones y respuestas retenidas usando las ABI verificadas. Se comprobó que cada `eth_call` usa el número del bloque de su captura, que `chainId` es 4663, que las direcciones llamadas son Quoter, StateView o los cinco tokens previstos, y que los resultados guardados coinciden con los bytes devueltos. El segundo corte tiene ocho lecturas de estado, cinco de decimales y 48 cotizaciones, además de chainId y cabecera. El primero no contiene lecturas de decimales: sus escalas de 18 se corroboran en el segundo corte para los mismos contratos.

Los PoolIds se recalcularon independientemente como keccak de los cinco campos ABI de 32 bytes de cada PoolKey. Coinciden los cuatro IDs exactos y la orientación base/quote. El `fee=8388608` de los pares LongX es el indicador de fee dinámica; no es un porcentaje de swap. StateView devuelve LP fee 2000 para ambos. Los pools USDG tienen fee 50000, tickSpacing 500 y hook cero. Ambos memes y ambos LongX tienen 18 decimales; USDG tiene 6.

Identidades comprobadas en Robinhood Chain:

| Activo | Contrato |
| --- | --- |
| CATGPT | `0xd6FDE6a3Fc6Ab2d83b2BE58383944CA1baDe1E18` |
| ANTHROPIG LongX | `0x351Ab2C51e223B28D219fE28cc3956410CC11e18` |
| OPENAIx1L | `0xfe09Fb328bE1c286B4f597eD34764b7472ae72c5` |
| ANTHROPICx1L | `0x1937caD42b17D43bB2b347ce16d5288887C46c33` |
| USDG | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |

El homónimo ANTHROPIG/WETH `0x04d6AAa3147B9f5b5dB255d3151561c07019BDC6` no forma parte de estas simulaciones ni de estas ventas.

Se volvió a calcular cada salida esperada directamente con enteros grandes: `sqrtPriceX96² / 2^192`, invertido según `zeroForOne`, aplicado al input raw efectivamente enviado. El descuento es `100 × (1 − salida / salida esperada al spot previo)`. La diferencia máxima respecto al cálculo original con Number fue **1,46 × 10^-13 puntos porcentuales**, incluso usando el input redondeado real. La escala de decimales y el uso de `toFixed` no provocan un error material en estas muestras. Esto no garantiza igual precisión para cualquier otro rango o token futuro.

## Fees y significado del descuento

- LongX: protocolo cero, LP 0,2% y hook terminal efectivo 1,4%, contrastado previamente con transferencias. Para exact input, el efecto combinado sobre la salida es `1 − (1 − 0,002) × (1 − 0,014) = 1,5972%`, antes del impacto de tamaño.
- USDG: protocolo empaquetado `4097000 = 0x3e83e8`. Los 12 bits inferiores y los siguientes 12 bits contienen 1000 pips en cada dirección, o 0,1%. La combinación con LP 5% es `0,1% + 5% − 0,1% × 5% = 5,095%`.
- No se debe sumar simplemente 1,4% y 0,2%, ni sumar 0,1% y 5%. Tampoco corresponde atribuir todo ese descuento al creador: el ledger anterior distingue LP, hook, integrador y beneficiarios.

La [implementación de ProtocolFeeLibrary de Uniswap](https://github.com/Uniswap/v4-core/blob/main/src/libraries/ProtocolFeeLibrary.sol) confirma el empaquetado y la fórmula. Las ABI y fuentes de los contratos desplegados quedaron retenidas en `quoter.json` y `stateView.json`; la [lista oficial de despliegues](https://developers.uniswap.org/docs/protocols/v4/deployments) confirma las direcciones para Robinhood 4663.

El código verificado de `BaseV4Quoter._swap` comprueba que `amountSpecifiedActual == amountSpecified` y revierte `NotEnoughLiquidity` en caso contrario. Por ello, una cotización exitosa de estas llamadas no oculta un input parcialmente consumido. El quoter obtiene el resultado mediante ejecución y reversión interna; no demuestra balances, allowances, pago de gas ni settlement desde una wallet particular.

El descuento mide menor salida frente al spot previo, incluyendo tarifas e impacto de tamaño. No es tolerancia configurada por el usuario, prima porcentual del precio de compra, roundtrip, ruta óptima ni beneficio de arbitraje. Las compras y ventas son pruebas independientes del estado original. No incluyen otros saltos, fee adicional de router, gas real, MEV ni condiciones futuras. Se fijó el número del bloque y se guardó su hash; no se hizo una segunda comprobación de canonicalidad de ese hash ni se usó `blockHash` como parámetro de llamada.

## Gráfico y reproducibilidad

El PNG/SVG y `plot-depth.py` usan las ventas del segundo corte, filtran nominales desde 100 y representan correctamente sus puntos. A nominal 10.000: LongX CATGPT 8,105% y ANTHROPIG 12,554%; USDG CATGPT 21,838% y ANTHROPIG 29,052%. A 25.000 USDG: 35,832% y 54,660%. Las líneas se presentan como guía visual y las unidades están separadas entre paneles.

No hace falta corregir el gráfico actual. Para reutilizar el script conviene derivar fecha, bloque y líneas de fees de la captura: hoy están escritos como constantes y una captura nueva podría conservar rótulos antiguos. Además, `getAbi` comprueba `is_verified` al leer caché, pero en una descarga nueva sólo comprueba que exista un array ABI. La evidencia usada sí contiene `is_verified=true`; es una mejora de robustez futura, no una invalidez del corte. El script actual toma `latest` al comenzar: ejecutarlo de nuevo genera otro corte, no reproduce automáticamente el anterior.

## Las 19 ventas: cantidades y alcance económico

Se cotejaron las 19 transacciones exitosas contra sus respuestas originales, sus débitos ERC20, 15 eventos Release distintos, timestamps con diferencias entre 0 y 30 segundos, pagos internos de ETH y `fee.type=actual`. El gas observado coincide también con `gas_used × gas_price`. Se excluyeron del cómputo las llamadas `delegatecall` que podrían duplicar valor dentro de la ruta.

La revisión detectó que siete fichas resumidas de transacción tenían `token_transfers_overflow=true`. Se completaron por GET: seis contienen 11 transferencias y una 13, todas con `next_page_params=null`. Con esas listas, cada una de las 19 ventas tiene exactamente un débito ERC20 desde el receiver y ningún crédito ERC20 hacia él. No cambió ninguna suma. Las 19 trazas de pagos ETH están completas en la evidencia retenida.

Receiver de las ventas: `0x79B069112DF103f28bE2012a52eCEF0F4a5106F2`. Destinatario del fee observado del router: `0xB8159Ba378904F803639D274cec79F788931C9C8`. Son roles de direcciones; no se atribuye una identidad humana.

| Concepto histórico | Importe |
| --- | ---: |
| CATGPT debitados, 6 ventas | 1.271.697,964783925140163298 CATGPT |
| OPENAIx1L debitados, 13 ventas | 5.034,727887375435744309 OPENAIx1L |
| ETH bruto antes del fee observado del router | **3,225371964939663022 ETH** |
| Fee del router pagado a otra dirección | **0,032253719649396621 ETH** |
| ETH efectivamente pagado al receiver | **3,193118245290266401 ETH** |
| Gas de esas 19 ventas | **0,000855059771962 ETH** |
| ETH recibido menos solamente gas de ventas | **3,192263185518304401 ETH** |

En cada operación, el fee observado equivale a `floor(grossWei / 100)`. El bruto de esta tabla es sólo la suma del ETH pagado al receiver y ese fee de salida. Ya incorpora costes e impacto de los pools atravesados; no es valor bruto previo a todos los costes. El fee del router ya está descontado de los 3,193118 ETH: restarlo otra vez duplicaría el gasto.

Texto recomendado: **«Se observaron 19 ventas del receiver, cuyas cantidades coinciden con una pata de 15 cobros LP y ocurrieron hasta 30 segundos después. Pagaron 3,193118 ETH al receiver después del fee de salida observado del router. El gas de esas ventas fue 0,000855 ETH. Esta muestra no establece beneficio neto ni liquida todo lo cobrado.»**

Los claims pagaron tokens, y las ventas posteriores pagaron ETH. La concordancia exacta de cantidad y tiempo es evidencia fuerte, pero la fungibilidad y la existencia de inventario previo impiden asignar procedencia única a cada unidad vendida. No incluye gas de todos los claims, creación, rotación, compras previas, capital invertido, posiciones restantes u otras operaciones. No es inventario completo, beneficio del creador ni ingreso realizado en dólares. No sumar Collect y Release; son etapas del mismo flujo.

Ejemplo primario conciliado: [venta del 12/09 a las 04:29:44 UTC](https://robinhoodchain.blockscout.com/tx/0x1ac3ebba1b720d2587657e740d8f566c785a1064223427d67531458b4ab31f72), posterior al [claim de 04:29:41](https://robinhoodchain.blockscout.com/tx/0x20926bd69c982d2c0ae71ba761b09b98121c280aa81bf9706ce2fd518c892ae0). La venta debita 286,781428965212428205 OPENAIx1L; paga 0,132529489645776744 ETH al receiver y 0,001338681713593704 ETH al destinatario del fee. Sus USDG intermedios no se interpretan como saldo retenido o dólares bancarios.

## Revisión puntual adicional de MONEY

La lectura de `round-04/money/LECTURA.md` es consistente con los valores de `state-first.json`: 18 RPC, 16 eth_call fijadas al bloque 60.891.933, 06:26:31 UTC; eUSD supply 110, sEUSD supply 4 y activos 5,000000000000000001 eUSD. El timestamp 1788965295 corresponde al 09/09 14:48:15 UTC. `seusd-events.json` contiene 13 logs, ninguna página pendiente y un único RewardsStreamed de 1 eUSD. No se encontraron correcciones necesarias en ese alcance; no se repitió la auditoría de ABI, routing de fees o solvencia de Own. Su conclusión limitada al vault y pool seguidos evita inferir fraude, abandono o adopción de todo el protocolo.

## Evidencia de esta revisión

- `review-depth.mjs` y `depth-review-calculations.json`: decodificación y cálculo independiente de 72 cotizaciones, errores vacíos.
- `review-fees.mjs` y `fees-review-calculations.json`: conciliación BigInt de 19 ventas, errores vacíos.
- `read-sale-token-transfers.ps1` y `sale-token-transfer-pages.json`: siete GET públicos, URLs, horas, respuestas completas y ninguna página pendiente.
- Fuentes de contrato: [Quoter verificado](https://robinhoodchain.blockscout.com/address/0x8dc178efb8111bb0973dd9d722ebeff267c98f94?tab=contract), [StateView verificado](https://robinhoodchain.blockscout.com/address/0xf3334192d15450cdd385c8b70e03f9a6bd9e673b?tab=contract), [hook Rehype](https://robinhoodchain.blockscout.com/address/0x6f02324d20CC679d0E585290CAa6b16baCbC0F77?tab=contract) y [RPC oficial documentado](https://docs.robinhood.com/chain/connecting/).

Los datos originales de round-03 se preservaron. Esta revisión no extiende su corte histórico ni convierte observaciones de unas horas en un ganador durable.
