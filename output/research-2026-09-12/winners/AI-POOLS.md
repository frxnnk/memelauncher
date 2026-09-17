# Revisión de liquidez reportada: CATGPT y ANTHROPIG

Primer corte: 12 septiembre 2026, 04:12:33–04:12:35 UTC. Datos originales en `../new-pairs.json`; cálculo reproducible en `ai-pool-composition-first.json` y CSV.

La cifra de liquidez agregada de los dos pools vinculados a nombres de empresas AI está dominada por la valoración del propio memecoin. Es incorrecto presentar USD8.9M de CATGPT como USD8.9M disponibles para absorber ventas.

Se calculó `base USD = liquidity.base × priceUsd`; `quote USD implícito = liquidity.usd − base USD`; `porcentaje base = base USD / liquidity.usd`. Son cálculos aproximados sobre campos de un indexador. `priceUsd` tiene precisión limitada. No se observaron posiciones, rangos de liquidez, rutas, cotizaciones de salida ni slippage; el residual no mide profundidad realizable.

| Token y par | Contrato base abreviado | Liquidez reportada | Base valuado | Porcentaje base | Quote USD implícito | Precio token USD |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| CATGPT / OPENAIx1L | 0xd6FD…1E18 | 8,908,069 | 8,680,459 | 97.44% | 227,610 | 0.01412 |
| CATGPT / USDG | **mismo contrato** | 151,425 | 23,311 | 15.39% | 128,115 | 0.01358 |
| ANTHROPIG / ANTHROPICx1L | 0x351A…1e18 | 3,952,179 | 3,785,585 | 95.78% | 166,593 | 0.006026 |
| ANTHROPIG / USDG | **mismo contrato** | 102,970 | 15,065 | 14.63% | 87,905 | 0.006090 |
| ANTHROPIG / WETH | **otro contrato**, 0x04d6…BDC6 | 367,648 | 183,683 | 49.96% | 183,965 | 0.01049 |

Los pools USDG reportan 128,100 y 87,902 unidades de quote, cerca de los residuos derivados. La aparente liquidez de millones en el otro par no elimina la necesidad de verificar contrapartida y rutas de salida. Tampoco se suma el ANTHROPIG/WETH a los otros dos: es un activo distinto que reutiliza nombre y símbolo.

## Precios entre pools del mismo contrato

En este corte, CATGPT/OPENAIx1L cotiza 3.98% sobre CATGPT/USDG. ANTHROPIG/ANTHROPICx1L cotiza 1.05% debajo de ANTHROPIG/USDG. No se comparó el precio del homónimo WETH porque corresponde a otro contrato. Las capturas se hicieron en segundos distintos y los valores tienen precisión limitada; esta diferencia exige cautela, pero no demuestra por sí sola un error del indexador ni una oportunidad de arbitraje realizable.

## Identidades y fuentes

- CATGPT: `0xd6FDE6a3Fc6Ab2d83b2BE58383944CA1baDe1E18`; [OPENAIx1L](https://dexscreener.com/robinhood/0x086f510359ad57e4f8588b71ffa21fe29bbed044e4d13aa2f72ecaefeda95a36), [USDG](https://dexscreener.com/robinhood/0x2817c7a4f38cca11a4904ae67684fdbf0ac3fc4db36d796e82038b1f59725b34).
- ANTHROPIG vinculado por el nombre del par a ANTHROPICx1L: `0x351Ab2C51e223B28D219fE28cc3956410CC11e18`; [ANTHROPICx1L](https://dexscreener.com/robinhood/0xaf28b153a45c4647ed76860811f734152e3c93e29c6a4489691954b71716d310), [USDG](https://dexscreener.com/robinhood/0x494aac14b381472ecb618bd9fc62f2040d3e2132b1957cd01a31ca9e5cd97058).
- Homónimo ANTHROPIG: `0x04d6AAa3147B9f5b5dB255d3151561c07019BDC6`; [WETH](https://dexscreener.com/robinhood/0xd3246b31d9254a726dc81f3b3000e42147868856).

Los nombres de los quotes son campos de DEX Screener. Esta revisión no valida emisor, respaldo, canje, afiliación con empresas AI ni riesgos de esos productos.

## Segundo corte: 04:18:12–04:18:13 UTC

Repetición de los mismos cinco pools aproximadamente 5.64 minutos después. Evidencia completa en `ai-pools-second-snapshot.json` y cálculos en `ai-pools-second-comparison.json`. La concentración de la liquidez reportada en el propio memecoin persiste; esta repetición breve no demuestra sostenibilidad.

| Token y par | MC USD | Cambio precio entre cortes | Liquidez USD | Porcentaje base | Quote USD implícito | Precio token USD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| CATGPT / OPENAIx1L | 14,063,460 | -0.42% | 8,868,617 | 97.47% | 223,959 | 0.01406 |
| CATGPT / USDG | 14,475,360 | +6.55% | 150,501 | 12.08% | 132,321 | 0.01447 |
| ANTHROPIG / ANTHROPICx1L | 5,557,421 | -7.78% | 3,649,240 | 95.73% | 155,783 | 0.005557 |
| ANTHROPIG / USDG | 5,638,857 | -7.42% | 107,681 | 18.03% | 88,271 | 0.005638 |
| ANTHROPIG / WETH, otro contrato | 9,589,991 | -8.16% | 353,302 | 50.00% | 176,657 | 0.009634 |

CATGPT en el pool OPENAIx1L pasa de cotizar 3.98% por encima del USDG a 2.83% por debajo. La diferencia cambia de signo entre capturas; no se puede tomar cualquiera de ellas como un precio firme único de todo el token. ANTHROPIG/ANTHROPICx1L está 1.44% debajo de su USDG en la segunda captura. No se determinó cuánto corresponde a movimientos entre lecturas, desfases del indexador, comisiones, restricciones de rutas o divergencia efectiva entre pools.
