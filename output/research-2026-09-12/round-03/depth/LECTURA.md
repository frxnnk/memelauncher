# Profundidad simulada de CATGPT y ANTHROPIG LONG

Corte de cadena: 12/09/2026 05:58:10 UTC / 02:58:10 ART, bloque **60.875.164**, hash `0xe95a4d581e0a9123d1a2938151a79548644d806470a7a863293fd07022c1c52a`. Todas las simulaciones de este primer corte usan ese bloque; la ampliación posterior documenta su propio bloque fijo. No hubo conexión de wallet, firma, aprobación, pago de gas ni envío de una transacción.

**Revisión independiente completada:** [resultado y conciliaciones](../../round-04/review-depth-fees.md). Las72cotizaciones de ambos cortes se recalcularon sin errores materiales. El gráfico representa únicamente el segundo corte.

## Resultado

**La curva de ANTHROPIG es menos profunda que la de CATGPT en los tamaños observados.** El desvío respecto al precio previo del pool crece con el tamaño, incluso sin movimiento del mercado entre consultas. El tamaño de la tabla está en unidades del wrapper contraparte, **no dólares**.

| Tamaño nominal en quote | CATGPT: menor salida frente a spot | ANTHROPIG: menor salida frente a spot |
| ---: | ---: | ---: |
| 1 | 1,598% | 1,599% |
| 100 | 1,671% | 1,732% |
| 1.000 | 2,330% | 2,931% |
| 5.000 | 5,153% | 7,924% |
| 10.000 | 8,461% | 13,486% |
| 25.000 | 17,132% | 26,760% |

Se probaron compras con el quote y ventas del número de memes equivalente a ese quote al precio previo. Ambas direcciones dan porcentajes equivalentes dentro de la precisión numérica en este estado. Son simulaciones independientes, no una compra y venta consecutivas sobre el estado modificado por la primera.

Ejemplo: vender los ANTHROPIG equivalentes a 10.000 ANTHROPICx1L al spot devuelve aproximadamente **8.651,379 ANTHROPICx1L**. Vender los CATGPT equivalentes a 10.000 OPENAIx1L devuelve **9.153,851 OPENAIx1L**. Convertir esos wrappers a USDG o ETH requiere otra ruta con sus propios costes y estado.

El desvío incluye fees e impacto sobre la curva; no es una medida aislada de impacto ni la tolerancia de slippage configurada por un usuario. Tampoco incluye gas, comisiones adicionales de un router, MEV o cambios posteriores del mercado.

## Cómo se comprobó

- [Despliegues oficiales Uniswap v4](https://developers.uniswap.org/docs/protocols/v4/deployments): Quoter `0x8dc178efb8111bb0973dd9d722ebeff267c98f94`, StateView `0xf3334192d15450cdd385c8b70e03f9a6bd9e673b` y PoolManager `0x8366a39cc670b4001a1121b8f6a443a643e40951`, Robinhood Chain 4663.
- [RPC público documentado por Robinhood](https://docs.robinhood.com/chain/connecting/). La llamada HTTP POST contiene `eth_call`; no es un envío de transacción a la cadena.
- PoolKeys recuperadas de los eventos `Initialize` de las creaciones ya documentadas. Su hash se recalculó y coincide con cada poolId exacto. Ambos pares tienen tokens y wrappers de 18 decimales, tickSpacing 8 y el hook `0x4e3468951D49f2EEa976eD0D6e75fFCb44a9a544`.
- ABI de [Quoter](https://robinhoodchain.blockscout.com/address/0x8dc178efb8111bb0973dd9d722ebeff267c98f94?tab=contract) y [StateView](https://robinhoodchain.blockscout.com/address/0xf3334192d15450cdd385c8b70e03f9a6bd9e673b?tab=contract) obtenidas del explorador, ambas verificadas.
- 30 llamadas RPC: chainId, cabecera del bloque, cuatro lecturas de estado y 24 simulaciones. Cero errores RPC, todas las `eth_call` fijadas al mismo bloque. El script solo admite esos tres métodos RPC y no tiene firmante.

El precio spot se deriva de `sqrtPriceX96` del pool, no de la valoración redondeada de DEX Screener. CATGPT: **0,00562251019 OPENAIx1L por token**; ANTHROPIG: **0,00161883540 ANTHROPICx1L por token**.

## Comisiones: lo que la simulación permite contrastar

StateView devuelve `lpFee=2000`, equivalente a 0,2% en la unidad de Uniswap. El desvío de las operaciones minúsculas se acerca a **1,5972%**, consistente con aplicar 1,4% y 0,2% de forma multiplicativa, más el pequeño impacto de tamaño. El frente de auditoría de fees encontró una transferencia real del hook de 1,4% y una distribución distinta de la comisión LP; su reconstrucción completa se guarda en `../fees/`.

No atribuir todo el 1,5972% al creador. Un comentario de código usa un denominador diferente de la constante ejecutable: la lectura superficial 80%→1,12% del schedule no describe el porcentaje efectivo que aplica ese hook. La tasa final debe apoyarse en código, eventos y flujos efectivos, no solo en el nombre de un parámetro.

## Contraste con una ruta pública

La UI de [Matcha Meta para CATGPT](https://meta.matcha.xyz/robinhood?chainId=4663&sellToken=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&buyToken=0xd6fde6a3fc6ab2d83b2be58383944ca1bade1e18) permitió pedir una cotización de 0,04 ETH sin wallet. Mostró varias rutas, algunas con resultado de simulación y otras marcadas `Revert`. En otra actualización, rutas antes fallidas cambiaron de estado. Esta lectura es dinámica y no está fijada al bloque de la tabla.

La cotización es un resultado de la plataforma, no una operación nuestra. Las valoraciones en USD y el ranking variaban al refrescar; no se usaron para reemplazar el precio spot onchain de esta tabla ni se dedujo un arbitraje de diferencias entre capturas.

## Límites

Quoter prueba la curva y la ejecución interna de la simulación; no certifica una transacción completa desde una wallet concreta con balances, permisos ERC20, ruta externa y condiciones futuras. La ruta completa desde/hacia efectivo todavía no está incluida. La liquidez nominal y el resultado del quoter responden preguntas diferentes. La ampliación siguiente sí incorpora los pools USDG secundarios.

Evidencia: `quotes-first.json`, `quoter.json`, `stateView.json`; código reproducible `quote-depth.mjs`. La lectura previa fallida por HTML/JSON no se interpretó como un error del contrato; las ABI se recuperaron correctamente antes de simular.

## Ampliación: los cuatro pools al mismo bloque

Segundo corte: **06:05:54 UTC, bloque60.879.734**, hash `0xffdd12a250c9118eeb538e7a4a7b057f73e00ea14f87d5b704c6e634543c3b6d`. Los cuatro pools se simularon en ese mismo bloque. Esta ampliación leyó los decimales de los cinco tokens por contrato: los memes y LongX tienen18; USDG tiene6. No se reutilizó la escala18 para el stablecoin.

Los eventos `Initialize` de CATGPT/USDG y ANTHROPIG/USDG muestran fee50000, tickSpacing500 y hookcero. StateView confirma LPfee5% y protocolo empaquetado4097000, que representa1000pips (0,1%) en cada dirección. La [fórmula de Uniswap](https://github.com/Uniswap/v4-core/blob/main/src/libraries/ProtocolFeeLibrary.sol) aplica primero protocolo y luego LP: comisión combinada **5,095%**, antes del impacto de tamaño. Es el parámetro de estos pools concretos, no una comisión general de USDG.

### Venta directa hacia USDG

Cada venta usa la cantidad de meme equivalente al nominal indicado según el spot de su propio pool. Por eso los números no representan vender el mismo número de tokens en dos pools ni una búsqueda de mejor ruta.

| Nominal al spot, USDG | CATGPT: USDG recibidos | Desvío CATGPT | ANTHROPIG: USDG recibidos | Desvío ANTHROPIG |
| ---: | ---: | ---: | ---: | ---: |
| 100 | 94,685465 | 5,315% | 94,664123 | 5,336% |
| 1.000 | 927,346920 | 7,265% | 925,260060 | 7,474% |
| 5.000 | 4.253,418734 | 14,932% | 4.198,504467 | 16,030% |
| 10.000 | 7.816,224227 | 21,838% | 7.094,838783 | 29,052% |
| 25.000 | 16.041,910227 | 35,832% | 11.334,983412 | 54,660% |

**Tener otro pool cotizado en stablecoin no demuestra una salida barata.** Estos pools tienen una comisión y una curva distintas. Las compras y ventas dejan de ser simétricas en tamaños grandes porque cruzan distribuciones de liquidez diferentes; por ejemplo, ANTHROPIG/USDG a25K tiene desvío50,08% comprando y54,66% vendiendo. No sumarlo ni llamarlo roundtrip ejecutado.

En los pares LongX, al segundo bloque, los desvíos de venta10Kquote eran8,105%CATGPT y12,554%ANTHROPIG. No comparar esas10.000unidadeswrapper con10.000USDG como idéntico capital: haría falta convertir a una referencia común y simular todos los saltos.

63llamadasRPC en la ampliación: cabecera/chainId, ocho lecturas de estado, cinco de decimales y48simulaciones. Todas fijadas al mismo bloque para las `eth_call`; no hubo errores en las cotizaciones. Archivos: `quotes-four-pools.json` y `usdg-initializations.json`. Se preservó el primer corte.
