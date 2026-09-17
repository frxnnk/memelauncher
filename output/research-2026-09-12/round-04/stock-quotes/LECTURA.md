# Quotes bursátiles Base y BSC: procedencia y uso real

Corte de mercado: 12 septiembre 2026, 06:22–06:25 UTC. Verificación documental y navegador hasta aproximadamente 06:39 UTC. Investigación de lectura: sin wallet, firmas, compras, rescates ni contacto.

**AAPLc y GOOGLc sí coinciden con activos publicados oficialmente por Coinbase/Base. QQQB también coincide con el contrato divulgado por Binance.** Además, comprobé monedas reales del pool iStonks y una venta FLM que utilizó GOOGLc. Esto resuelve la duda de procedencia; no demuestra reservas actuales mediante auditoría independiente, seguridad integral, respaldo del meme ni una ventaja para otro lanzamiento.

## Identidades exactas

| Activo | Red | Dirección | Emisor identificado | Verificación primaria |
|---|---|---|---|---|
| AAPLc | Base, 8453 | `0xb200000000000000000000C2e324d24d7eEcd1fb` | Coinbase Onchain SPV Ltd | [Catálogo Base](https://www.base.org/stocks), documentación y prospecto |
| GOOGLc | Base, 8453 | `0xb2000000000000000000002D0BA3164cc74f58B7` | Coinbase Onchain SPV Ltd | [Documentación Base](https://docs.base.org/build-on-base/integrate-defi/list-tokenized-stocks), catálogo y prospecto |
| QQQB | BSC, 56 | `0x205812CdBed920aFf76C6580abD681a46D11efc7` | BTech Holdings Limited | [FAQ Binance](https://www.binance.com/en/support/faq/detail/f0c03cd6509a4085b4cce1636f16be38) y enlace exacto de [Proof of Collateral](https://www.binance.com/en/proof-of-collateral/bstocks) |

El nombre DEX de QQQB incluye una grafía distinta; la identidad se resolvió por contrato. Un vínculo aportado por el perfil DEX a Coinbase no fue tomado como acreditación.

## Qué representan y quién controla los activos

Los prospectos AAPL/GOOGL aprobados el 4 de agosto de 2026 identifican a Coinbase Onchain SPV Ltd, sociedad ADGM 37941, y a Alpaca Securities LLC como custodio/broker. Los certificados representan interés beneficiario proporcional en activos del trust, no propiedad directa de acciones Apple/Alphabet ni su patrocinio. El adquirente DeFi puede permanecer **Unvested**: adquirir el token no completa automáticamente identificación, elegibilidad o derechos de rescate. No se comprobó la custodia actual contra un estado de cuenta. [Prospecto AAPL, pp. 5, 14, 21 y 85–86](https://assets.ctfassets.net/o10es7wu5gm1/6t7LV7NUfghwRYjZpReFYH/6e08881544b683a4c886aaa809c2d51a/Coinbase_Onchain_SPV_Ltd_-_Prospectus__AAPL__-_FSRA_VERSION.pdf).

La FAQ comercial concentra mint/redeem en participantes autorizados. El prospecto GOOGL también contempla redenciones por holders que satisfagan las condiciones de vesting. Por eso sería excesivo afirmar que todo comprador minorista puede rescatar o que ninguno puede hacerlo. El registro legal prevalece sobre el registro onchain; restricciones geográficas, KYC/AML y facultades de suspensión/freeze condicionan los derechos. No se probó una ruta de rescate para el usuario. [Coinbase](https://www.coinbase.com/tokenize), [Prospecto GOOGL, pp. 20, 24 y 73](https://assets.ctfassets.net/o10es7wu5gm1/4Z7WbCZC0rQ6AkkEV6sBgX/b6ecb474929fa9b4802b258a7ef6e948/Coinbase_Onchain_SPV_Ltd_-_Prospectus__GOOGL__-_FSRA_VERSION.pdf).

**Base B20:** son activos nativos mediante precompiles; no corresponde exigir bytecode Solidity verificado individual en cada dirección como si fueran ERC20 desplegados. Tienen 8 decimales. El estándar permite multiplicadores, políticas de transferencia y pausas; una aprobación no asegura que la transferencia esté permitida. El administrador puede modificar configuraciones y algunas medidas admiten efecto inmediato. Los feeds bursátiles 24/5 pueden mantener el último cierre mientras el DEX opera 24/7. No consulté en vivo roles, cap, multiplicador ni políticas de AAPLc/GOOGLc; tampoco validé frescura de sus oráculos. [Documentación técnica Base](https://docs.base.org/build-on-base/integrate-defi/list-tokenized-stocks).

**QQQB:** la FAQ identifica un certificado bStock emitido por BTech Holdings Limited, con elegibilidad territorial y controles del emisor; no entrega al holder los mismos derechos que una acción directa. Su documentación exige restricciones geográficas a integradores. No se leyó el prospecto individual de la serie QQQB ni se comprobó elegibilidad argentina. El portal de prospectos no entregó contenido útil en la extracción estática. [FAQ Binance](https://www.binance.com/en/support/faq/detail/f0c03cd6509a4085b4cce1636f16be38), [portal de prospectos](https://www.binance.com/en/about-legal-disclosures/bstocks-digital-securities-documentation-prospectuses).

El navegador de Binance mostró 74 bStocks emitidos y, para QQQB, **69.541 QQQ en custodia / 69.541 QQQB / 100%**, actualizados según la pantalla `09/12/2026 00:47:18`, sin zona horaria indicada. Es divulgación redondeada del operador, no auditoría de custodia hecha aquí. La extracción estática decía cero activos: era una limitación de renderizado. [Proof of Collateral](https://www.binance.com/en/proof-of-collateral/bstocks).

En [BscScan](https://bscscan.com/token/0x205812cdbed920aff76c6580abd681a46d11efc7) observé BeaconProxy e implementación `0xCFEd6c4679297ea4889F8183bC057B4A86C64e46`. Read Contract devolvió 18 decimales, multiplicador `1e18`, mint y burn habilitados **para ISSUER_ROLE**, compliance `0x53dBa7AaBDe774787A1F57236B235567dA8e14F4` y pauseManager `0x9fc74Be63f3589485B2423984a7a0557e0CF700a`. No se resolvieron miembros del rol, propietario del beacon ni estado efectivo de pausa. Son controles observados, no una auditoría.

## Pools y salida observada

DEX devolvió 30 pares por cada quote consultado: 90 filas preservadas; esto no es un censo completo. Las cifras siguientes son declaraciones del indexador, no profundidad ejecutable ni entradas netas.

| Pool | Liquidez USD declarada | Reserva quote | Volumen 1 h USD | Compras / ventas 1 h |
|---|---:|---:|---:|---:|
| FLM / GOOGLc, Base | 76.219,77 | 81,442 GOOGLc | 34.330,82 | 94 / 236 |
| iStonks / AAPLc, Base | 48.714,87 | 67,165 AAPLc | 5.552,28 | 23 / 16 |
| BinanceTown / QQQB, BSC | 61.943,76 | 43,2903 QQQB | 43.442,70 | 251 / 169 |

Direcciones de los memes y pools:

- FLM `0x39988BF0638Edb8c65cE0fB9e1e457C575157BA3`; [pool V4](https://dexscreener.com/base/0xb49ce96e99b5eb8fe3c7a03687d9c6d83302172dd2737fb88f9ac133baf3c24c).
- iStonks `0xCB2BAff7177C8966A8b059b3Df3e9323dc2Ee267`; [pool V3](https://basescan.org/address/0x9f8353f61574da73218206ad3f70d9455bfed9c4#readContract). Consulté token0/token1: devuelven exactamente AAPLc/iStonks.
- BinanceTown `0x3c1127070996a55D838A1E2743249DC28Cec7777`; [pool](https://dexscreener.com/bsc/0x1a1def8c55238986c7067a57726a058d3497b608). En este frente la moneda se confirmó por DEX, no por lectura independiente del pool. El BinanceTown `0xe210C0583C1071714EDed2d8bEEab05Ab5bB7777` contra USDT es otro activo y no se suma.

La reserva de GOOGLc de FLM representa unos USD 27.609 al precio del pool GOOGLc/USDC; la de AAPLc de iStonks unos USD 22.364. Gran parte de la liquidez total declarada corresponde al propio meme. Son valorizaciones aproximadas, sin simulación de slippage.

Las vías stock/stable detectadas fueron AAPLc/USDC Aerodrome `0xA3b1E3f9747065e2073722Ff4c9027d3eA4994F0` (USD 1,75 M totales; 1.261.409 USDC), GOOGLc/USDC Aerodrome `0xB1987CAD1682841b4b641d50E520777eC5Ab5542` (USD 1,99 M; 1.303.870 USDC) y QQQB/USDT PancakeSwap `0xe531fcb1F5a195de7608B9F4f9518544C2cdB693` (USD 2,12 M; 1.037.358 USDT). No equivalen al dinero accesible sin impacto para un vendedor del meme.

### Una operación FLM comprobada

Regla de selección: mayor valor USD informado entre las 300 operaciones devueltas por GeckoTerminal. La [transacción `0x190a8c…5486`](https://basescan.org/tx/0x190a8cc6fa647b05cc72c53ed3860bce474751f6f1eab36f3d4b222091b15486), a las **05:35:57 UTC**, bloque 51.201.005, figura exitosa. El usuario `0xc25A0F171dA0b4A49978d493bEB8966b7085d2C4` vendió aproximadamente 1.341,6 millones de FLM. Los logs incluyen el pool V4 exacto.

Se observa **PoolManager → router: 5,31992101 GOOGLc**, entrega al pool Aerodrome GOOGLc/USDC, recepción de **1.802,553763 USDC**, conversión a WETH y salida al usuario de **0,707449177058205319 ETH**. El router inicial fue `0xbce80645b0E9B0ab52648b0d23f37db56616eA93`; no se acreditó su operador. No hay rescate de acciones: son swaps secundarios. El volumen agregado o la ganancia del usuario no se deducen de este caso.

## Qué habilita al creador, y qué no demuestra

TwentyPad documenta AAPLc/GOOGLc como quotes admitidos, creación de pools y un router que permite al trader entrar/salir con ETH o USDC. Esto prueba disponibilidad documentada de un mecanismo. Su factory es `0x15a3f3ABb733868d193b511dd5b91f82ebF888A3` y router `0xaa8dac41aec9e253d550e42673795f9251d8bedc`; **no se atribuye FLM ni iStonks a TwentyPad**, cuyos contratos no coinciden con la operación observada. El router se declara sin auditoría. [Quotes](https://docs.twentypad.com/docs/launching/quote-assets), [contratos](https://docs.twentypad.com/docs/developers/contracts), [router](https://docs.twentypad.com/docs/trading/swap-router).

Un creador puede seleccionar un quote admitido dentro de las reglas de su plataforma; no adquiere por eso facultades de emisión bursátil, capacidad de ignorar compliance o garantía de rescate. Poseer el meme tampoco concede automáticamente al usuario propiedad del quote, dividendos o derechos sobre Apple/Alphabet/QQQ. En el corte ya hay pares con actividad: el mecanismo está ocupado. La decisión sobre otro token requiere demanda y distribución propias, que este frente no encontró ni intentó sustituir con un ticker.

## Evidencia y límites de acceso

- `raw/fetch-log.json` y `raw/fetch-followup-log.json`: URLs, tiempos y estados GET. PDFs AAPL/GOOGL, docs Base/TwentyPad y HTML del swap preservados.
- `raw/dex-aaplc.json`, `raw/dex-googlc.json`, `raw/qqqb-dex.json`, `pool-snapshot.json`: datos de mercado sin deduplicación global ni conclusión de organicidad.
- `raw/flm-trades.json`, `raw/flm-swap.html` y `.txt`: selección y evidencia de la venta concreta.
- `raw/browser-proof.json`: transcripción estructurada de PoC y consultas públicas de contrato; no es respuesta RPC cruda.
- GET Coinbase/BscScan produjo 403 en algunos endpoints, Binance 202 sin documento y bstocks.finance error DNS; navegador/web permitieron las verificaciones descritas. No son ausencia de producto ni rechazos de aprobación. Prospecto QQQB, custodia independiente, administradores actuales, profundidad simulada y rescates siguen sin comprobar.
