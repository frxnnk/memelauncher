# Espacio de lanzamiento y mecanismos — 12/09/2026

Corte: aproximadamente 04:07–04:15 UTC / 01:07–01:15 ART. Investigación pública, sin conectar wallets ni operar. El agente raíz verifica precios y pools; este informe verifica catálogos, competencia y mecánica. Baseline leído: `output/research-2026-09-11/evening/LECTURA.md`.

## Lectura

La novedad concreta es **memes emparejados con exposición sintética pre-IPO de OpenAI y Anthropic mediante LongX**. El catálogo existe hoy, presenta vaults identificables y ya tiene bastantes imitadores. La existencia del activo y del mercado está mejor sustentada que un supuesto hueco creativo. No encontré un nombre o asociación nueva con demanda demostrada que permita recomendar lanzar inmediatamente.

La distribución de comisiones entre holders también existe como propuesta y tiene transferencias puntuales verificables en ALL, pero el sitio sigue mezclando contadores y documentos incompatibles. No debe venderse como distribución automática garantizada de todos los lanzamientos.

## LongX: activos exactos y restricciones observadas

Datos leídos directamente en la UI pública, no en una noticia agregadora. Red: **Robinhood Chain**. Producto/plataforma: **LongX de LONG**. Se presenta como posición tokenizada con exposición a mercados de Lighter; no se verificó relación corporativa con OpenAI o Anthropic ni titularidad de acciones reales.

| Dato | OPENAIx1L | ANTHROPICx1L |
| --- | --- | --- |
| Contrato | `0xfe09Fb328bE1c286B4f597eD34764b7472ae72c5` | `0x1937caD42b17D43bB2b347ce16d5288887C46c33` |
| Exposición anunciada | OPENAI 1x Long | ANTHROPIC 1x Long |
| NAV por token | US$1,0392 | US$0,9963 |
| Antigüedad de prueba UI | 2 horas | 2 horas |
| Precio medio del pool mostrado | US$1,2024 | US$1,5972 |
| Prima frente a NAV mostrada | +15,70% | +60,30% |
| TVL del vault | US$600.033,78 | US$450.180,03 |
| Supply | 577.383,60 tokens | 451.819,69 tokens |
| Cap de depósitos | US$600.000; UI100% usado | US$450.000; UI100% usado |
| Cuenta Lighter enlazada | 25700 | 25736 |

Fuentes primarias directas:

- [Vault OPENAIx1L](https://app.long.xyz/longx/0xfe09Fb328bE1c286B4f597eD34764b7472ae72c5)
- [Vault ANTHROPICx1L](https://app.long.xyz/longx/0x1937caD42b17D43bB2b347ce16d5288887C46c33)
- [Catálogo LongX](https://app.long.xyz/longx)
- [Cuenta Lighter25700](https://robinhoodchain.lighter.xyz/explorer/accounts/25700)
- [Cuenta Lighter25736](https://robinhoodchain.lighter.xyz/explorer/accounts/25736)

La UI ofrece ruta instantánea vía pool y ruta de vault; esta última anuncia mint de1–2min y redemption de15–40min. No se probaron tiempos, ejecución ni capacidad efectiva. La etiqueta de beta/experimental también está presente. **La prima de Anthropic es material**: el precio externo del wrapper no coincide con el valor contable de su posición. La capitalización y liquidez en dólares de memes que lo usan como quote pueden variar por esa prima además del propio meme.

La [documentación oficial de Lighter](https://docs.lighter.xyz/trading/real-world-assets-rwas/market-specifications) clasifica OPENAI y ANTHROPIC como mercados pre-IPO, con referencia interna, límite de interés abierto de20M y una convención de mil millones de acciones para expresar el precio. Esto respalda la descripción de exposición contractual. No demuestra que el wrapper sea una acción de la empresa. La documentación fue leída en vivo; no extrapolar a productos spot de otros emisores.

## La competencia ya llegó

El catálogo LongX por FDV mostró CATGPT, ANTHROPIG, FROGE, DEMOTHREE, CLAUDEGATOR, MISSILE, CLAWD, DOOM, OPENAITOKEN, OZZY, ALT, GPT y SHOGGOTH, entre otros. La página individual de Anthropic mostró además CLAWED, CLUG, MISTAKES, MAKENOMISTAKES, BUFOCOIN y otros. Esta es una muestra visible del catálogo; no un censo global ni evidencia de volumen orgánico.

Los nombres más directos para gato/ChatGPT, cerdo/Anthropic, Claude/cocodrilo, Claude/claw y Shoggoth ya están ocupados. El dato útil para lanzar es que **llegar con otro animal o una deformación obvia de Claude ya implica competir con oferta existente**. No inferir potencial porque el nombre tenga pocos resultados.

Los precios visibles de LongX de las monedas indican que usa NAV para valorarlas; DEX puede usar precio del pool del wrapper. Por eso no comparar una MC de LongX y una MC de DEX como si fueran un cambio temporal puro.

## ALL: mejora de evidencia y límites

La [home de ALL](https://www.allonsol.fun/) ahora enumera151lanzamientos. Muchísimos figuran cerca deUS$3K de MC. Entre sus derivados ya aparecen ALLCAT, ALLDOG, ALLINU, ALLPEPE, ALLFLY, ALLFATHER, ALLIN y numerosos homónimos. ALLCAT aparecía en la home alrededor deUS$157K y811payouts, mientras su detalle mostraba aproximadamenteUS$169K y ninguna distribución acumulada. La home también decía que no hubo payouts y que aún no había un round. Esos contadores siguen siendo incompatibles entre superficies.

La [documentación](https://www.allonsol.fun/docs) distingue el reparto de comisiones que atribuye a Pump de la ejecución posterior por una wallet operadora. Reconoce expresamente que el drop no está impuesto por un programa onchain. Lista el split50/10/20/20 como vigente, pero las proporciones del proceso de drop/burn/reserva, los asientos prepagos y el botón de claim están propuestos. También dice que no se pagó un round todavía, dato contradicho por el registro actual. La política del operador y la ejecución efectiva no deben confundirse.

El [registro de rounds](https://www.allonsol.fun/rounds), actualizado04:13UTC, mostraba un round04:04 con7255wallets repartidas en907transacciones, y otros rounds previos. **Se verificó una transacción concreta enlazada desde ese round**:

- [Transferencia verificada en Solscan](https://solscan.io/tx/4FsZMCXeueKBVbqYpuEyMhMXEjcJwKVhgpxqXUwdVqqgK4RyeWkYD2mqiQvYXceu2CEn8b3JeRbdYJ1UqdyDSYJo)
- Estado observado: Success, finalized, 04:03:46UTC del12/09/2026.
- Ocho transferencias `transferChecked`, aproximadamente3,91651 ALL en total, desde `TjJUc9niZ1MAagSmkTkdLpKCk1vnJWL2q7QznzQQALL`.
- Mint: `ASoQZA3Dee2HU34Vwx3b5SAtTaczJtZcyx1T413nDALL`.

Esto demuestra transferencias reales puntuales de ALL. **No verifica las7255wallets, la elegibilidad de cada receptor, el reparto de cada nuevo lanzamiento ni que todo pago futuro ocurra.** No es correcto mantener la afirmación de que no hay ninguna evidencia de pago; tampoco es correcto validar todo el mecanismo con una transacción.

## DKNG y alternativas de plataforma

El cluster ALLINU/DKNG tiene un catalizador identificable: el anuncio del11/9 de DKNG en Solana vía Sunrise, emitido por Backpack Securities. El post se encontró enlazado en [este registro de Reddit](https://www.reddit.com/r/solana/comments/1wdtc7a/dkng_is_live_on_solana_via_sunrise_issued_by/), que remite al [post de Solana](https://x.com/solana/status/2098504287672267068). X no entregó el contenido a la herramienta web, por lo que la atribución del anuncio se mantiene delimitada a esa evidencia.

La dirección `DKNGQFNGQmoBdXSRGKJ8tTu7uPDasw5JDcfMmWniNfow` coincide entre el quote del pool del baseline y la ficha actual de [Phantom](https://phantom.com/tokens/solana/DKNGQFNGQmoBdXSRGKJ8tTu7uPDasw5JDcfMmWniNfow), que lo identifica como DraftKings–Backpack Securities en Solana. Backpack describe su infraestructura de emisión y conversión en su [anuncio oficial](https://learn.backpack.exchange/blog/introducing-backpack-securities). Ese marco general no sustituye una auditoría del token específico ni legitima ALLINU.

[Stonksx](https://www.stonksx.fun/docs) es otro sitio que publicita reservas de acciones tokenizadas (SPYx, QQQx, NVDAx, AAPLx, MSFTx, MSTRx, GOOGLx), pero su propia documentación sigue hablando de publicar programa y auditorías antes del lanzamiento. No lo presento como alternativa operacional verificada ni lo confundo con el STONK seguido por el agente de mercado. [Ember](https://embercurve.fun/) abrió sin contenido textual utilizable en la herramienta web; no actualicé su mecanismo con evidencia nueva en esta revisión.

## Decisión de lanzamiento

1. Prioridad de observación: pre-IPO/AI en LongX. Activo quote y mercado existen, el catalizador está vinculado a una capacidad nueva de emparejar memes con esa exposición. La oferta creativa obvia ya es abundante.
2. ALL tiene más actividad técnica demostrable que en el informe previo, pero no resuelve por sí mismo distribución orgánica ni demanda. Repartir tokens en wallets no prueba una audiencia interesada.
3. No propongo un ticker libre ni una compañía nueva solo porque figure en un catálogo. Faltan difusión independiente del concepto, diferenciación frente a los competidores y verificación de liquidez de salida del par elegido.
4. La próxima búsqueda útil sería una expresión o personaje que ya circule por un hecho concreto de OpenAI/Anthropic, seguido de contraste onchain. Inventar ahora una combinación animal+empresa no está justificado por esta evidencia.

No se auditaron permisos de vaults, posición de Lighter, supply onchain de wrappers, todos los rounds ALL, holders ni bundles. La investigación no hizo compras, despliegues, publicaciones ni pruebas de firma.
