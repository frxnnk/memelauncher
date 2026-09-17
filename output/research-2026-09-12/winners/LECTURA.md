# Continuidad de pools anteriores — 12 septiembre 2026

Corte principal: 04:11:34–04:11:43 UTC (01:11 ART). Comparado contra el último snapshot disponible del 11 septiembre 23:36–23:42 UTC, aproximadamente 4.5 horas antes. Fuente: API pública DEX Screener; mismas redes, contratos y pools. Valores USD del pool consultado, no agregado de todos sus pools. Los cambios MC son entre observaciones, no retorno realizable. Capturas completas en snapshot.json; identidades y comparación en comparison.json.

## Lectura

- INU/AAPL es el más fuerte por continuidad relativa de este grupo: MC +44.48% a 3.285M y liquidez +22.15% a 534K. Sin embargo, volumen 1h 42.8K (-26% contra la ventana anterior) y cambio precio 1h -0.94%; no confirma aceleración actual ni demanda por nuevos clones Apple.
- STONK mantiene la mayor escala (MC232.1M, liquidez4.76M, volumen1h1.93M), aunque retrocedió 21.57% MC desde el corte previo. Liderazgo de escala no equivale a estar subiendo ahora.
- ALL conserva prácticamente toda la liquidez del corte previo (-1.61%), MC3.10M (-21.10%) y volumen1h337K, con +5.8% precio1h. Sobrevive al primer ciclo; no se confirmó aceleración ni funcionamiento de las promesas de reparto.
- FLYBRAIN retiene mejor el MC que varios runners (-5.99%, 11.35M) y liquidez429K (-4.75%), pero volumen1h cayó73% frente a la hora registrada anteriormente. Última hora -6.78%.
- EMBER rebota24.56% MC frente a la noche pero liquidez cae6.12%, volumen1h cae82% y precio1h -16.2%. No llamarlo nueva consolidación por el rebote aislado.
- ALLINU/DKNG sufrió la caída más marcada entre candidatos todavía negociados: MC -73.03%, liquidez -45.77%, volumen1h -88%. El cruce meme/acción sigue existiendo, pero este candidato no sostuvo la noche.
- MONEY -35.98%, ZFORGE -33.69%, MM -42.07%, Stunk -18.14%, baton -12.72% MC. ZFORGE aún tiene1.28M volumen1h pero precio1h -29.35%; el volumen elevado puede acompañar ventas.
- GASOLINU +15.29%, DRN +10.41% y donkey kong/DKNG +59.40% MC desde la noche, pero sus volúmenes1h bajaron36%,94% y72%, respectivamente. Subida acumulada no demuestra que la atención actual esté creciendo.
- Los911 anteriores siguen degradándose: Solana9.69K MC/-35.49% y RH11.39K/-19.75%, con volumen1h821 y61 USD respectivamente. STONKER ya estaba colapsado en la última verificación; ahora MC3.6K y cero actividad1h.

## Never Forget: pool vacío confirmado

El candidato nuevo del corte anterior, contrato 4ppYhHu5cSXDxejiydxqD2eABgcroVNNfc4KxaZjHBhb, pasó de liquidez81.1K a USD0 y reporta cero compras/ventas y volumen en1h. La API todavía muestra MC159K y +1169%24h; con pool vacío son referencias residuales, no prueba de valor liquidable ni continuidad.

Reconfirmado a04:12:39 UTC mediante tres GET: pair exacto, token-pairs/v1 por contrato y search por contrato. Los dos métodos de descubrimiento devolvieron únicamente ese mismo pool. No encontré evidencia visible de migración en DEX Screener; no se adjudicó causa ni se verificó el historial onchain de retiros. Evidencia completa en never-forget-check.json.

[Pool Never Forget](https://dexscreener.com/solana/8mlavvmysgubhtfrtcr6286khsm5b6594suuqqurxqh4)

## Tabla completa

M = millones, K = miles; MC y liquidez y volúmenes en USD. Delta MC/liquidez se calcula contra la última captura del mismo pool. El dato precio1h es cambio móvil reportado por DEX.

| Red / token / quote | MC | Delta MC | Liquidez | Delta liquidez | Vol1h | Vol6h | Precio1h |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| [robinhood / GASOLINU / USO](https://dexscreener.com/robinhood/0x0e83588ff3914c9801584d55d4dabf9d28880728d73ccff7394ded9aae02afa8) | 1.59M | 15.29% | 386.9K | 8.02% | 11.8K | 86.3K | -3.75% |
| [robinhood / MONEY / SPY](https://dexscreener.com/robinhood/0x13c339deb9ea2f31a6616e89aa097940667d77fa5de2de063f7bcf04b75dd8e5) | 612.2K | -35.98% | 64.5K | -19.99% | 14.4K | 248.2K | -9.13% |
| [robinhood / 911 / BA](https://dexscreener.com/robinhood/0x30f31e2ae9a6dfb0caf0713758074c5fe05a3bc0706b271fe41df09cf196d930) | 11.4K | -19.75% | 9.4K | -14.12% | 60.84 | 1.6K | -1.86% |
| [robinhood / DRN / ETH](https://dexscreener.com/robinhood/0x4c655931260a48e243be887fc35694eb15e9af12c495c557252f8c5910480c83) | 1.28M | 10.41% | 105.1K | 5.09% | 3.7K | 161.7K | -1.49% |
| [robinhood / FLYBRAIN / USDG](https://dexscreener.com/robinhood/0x6191331ead43b8876ea312020ca58e539c51ef48021b3b93fac2718893c0b771) | 11.35M | -5.99% | 429.0K | -4.75% | 295.3K | 2.94M | -6.78% |
| [robinhood / ZFORGE / WETH](https://dexscreener.com/robinhood/0x6ac6b3a1e78c32ab48152ec079c12014d2a72e8c) | 6.27M | -33.69% | 442.8K | -15.13% | 1.28M | 9.58M | -29.35% |
| [robinhood / STONKER / ETH](https://dexscreener.com/robinhood/0x7034929fbd768a7122c62a2d29bcb1cee887b1c580bb019f4551436be342069e) | 3.6K | -6.54% | 5.6K | -3.31% | 0.00 | 150.1K | sin actividad |
| [robinhood / INU / AAPL](https://dexscreener.com/robinhood/0x7e271c400427ecb727f5fbb27dec69254bce7c4219e95e3535d0ed128f79648a) | 3.29M | 44.48% | 534.2K | 22.15% | 42.8K | 681.2K | -0.94% |
| [solana / ALLINU / DKNG](https://dexscreener.com/solana/5752ia7jc3zu1c8ycytasyi5d4nvhapskvregbs7pwwl) | 1.25M | -73.03% | 105.5K | -45.77% | 131.9K | 3.94M | -8.11% |
| [solana / DKNG / DKNG](https://dexscreener.com/solana/6zcsdnte8c3kxwuosxsnbt4wwsn9zta73umkijp2p6au) | 890.3K | 59.40% | 84.4K | 29.89% | 85.6K | 1.70M | 9.54% |
| [solana / 9/11 / SOL](https://dexscreener.com/solana/8mlavvmysgubhtfrtcr6286khsm5b6594suuqqurxqh4) | 159.2K | -4.19% | 0.00 | -100.00% | 0.00 | 1.10M | sin actividad |
| [solana / Stunk / SOL](https://dexscreener.com/solana/8tfvhwk6swwcjo7dnkrp89wwqrtdj6o9hbodhfxt2dy6) | 1.88M | -18.14% | 123.7K | -8.80% | 205.8K | 945.0K | -23.14% |
| [solana / MM / STONK](https://dexscreener.com/solana/abxlp7nmnipn7ijirjkrvoq8vs6snzkubrmfirvygvty) | 689.3K | -42.07% | 119.1K | -31.55% | 26.1K | 258.8K | -15.20% |
| [solana / baton / PUMP](https://dexscreener.com/solana/cb7zrgplhji3th7htxykeqbxvnjppetvckxuwakbuhxu) | 5.48M | -12.72% | 305.8K | -6.22% | 137.7K | 1.44M | -6.89% |
| [solana / 911 / SOL](https://dexscreener.com/solana/dfrju8f4yvltfmquha9l27h1aagfkupmb2mftn9h5ztb) | 9.7K | -35.49% | 7.4K | -23.98% | 821.12 | 5.6K | -8.44% |
| [solana / EMBER / SOL](https://dexscreener.com/solana/gbrdaq3rjcvwerolduwmnuq8n5xaakj2rk2djdg64cly) | 13.12M | 24.56% | 747.6K | -6.12% | 252.0K | 4.92M | -16.20% |
| [solana / ALL / SOL](https://dexscreener.com/solana/uzak8txfjavqs9vhtdayawfbiybzwq4bzxdifjtqenj) | 3.10M | -21.10% | 198.0K | -1.61% | 337.5K | 4.21M | 5.80% |
| [solana / STONK / SOL](https://dexscreener.com/solana/zxtpi4btawx3mgdapoezkmd1hxx8cdecfrqxmwvsclx) | 232.08M | -21.57% | 4.76M | -7.11% | 1.93M | 15.90M | -6.77% |

## Límites

No se auditaron holders, bundles, organicidad, wash trading, permisos, bloqueos o retiros de liquidez. Volumen no es entrada neta. Las narrativas y promesas de sitios no fueron revalidadas en esta tarea; el alcance es continuidad de los contratos ya identificados. DEX puede conservar precios residuales en pools sin actividad. No hubo operaciones ni conexiones de wallet.
