# Contraste Base / BSC — 12 septiembre 2026

Ranking capturado **06:11:40 UTC / 03:11:40 ART**; mercados **06:14:17–18 UTC**; fuentes sociales leídas ~06:15–06:34 UTC. Es una muestra puntual, no un censo de tokens nuevos.

**Resultado:** seis pools jóvenes con actividad y liquidez visible. BinanceTown/USDT concentra el mayor volumen1h entre esos seis; FLM tiene un anuncio técnico nuevo dentro de la escena anterior de conectomas; BUDDY es un relanzamiento declarado. iStonks y KNOT remiten a infraestructura de tokens emparejados con otros activos. No apareció una narrativa cultural claramente nueva y desocupada.

## Método

- Primeros **25 pares** de `dexscreener.com/base` y **25** de `/bsc`, en el orden visible, todos los DEXes, sin filtros adicionales. Regla visible **Trending 6H**; intervalo de tabla **Last 24 hours**. No confundir ranking6h con volumen6h ni usar la columna de volumen24h como volumen1h.
- `ranking-input.csv` conserva red/posición/pool/edad UI. `ranking-first.json` contiene respuestas API, URLs y timestamps; `ranking-first-summary.json` conserva métricas y direcciones de los mismos 50 IDs.
- 50 pools corresponden a **49 tokens**: Basecat tiene dos pools. Los dos BinanceTown son contratos distintos.
- Base: 25 pares / 24 tokens; **2 con edad conocida ≤24h**, 4 sin fecha. BSC: 25 pares / 25 tokens; **4 ≤24h**, 1 sin fecha. No clasificar los cinco sin fecha como nuevos o viejos por defecto.
- Edad calculada con `pairCreatedAt` y timestamp UTC; es **edad del pool**, no primera emisión del token ni nacimiento del meme. Se corrigió un error preliminar de conversión horaria con milisegundos Unix antes de informar los resultados; los resúmenes guardados ya están corregidos.
- No se verificaron profundidad ejecutable, concentración, permisos, wash trading o venta. Liquidez/volumen son valores reportados por la API.
- Sólo Bitcat, BSC #4 y de unos tres días, reportaba boosts activos (50). Los seis jóvenes tenían boosts nulo; **nulo no demuestra ausencia de promoción**.

## Los seis pools ≤24h

Valores USD y cambios reportados por DEX Screener a 06:14 UTC.

| Red / rank | Token / quote | Creación UTC | Edad h | MC | Liquidez | Volumen1h | Compras/ventas1h | Cambio1h |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Base #5 | FLM / GOOGLc | 09-11 22:03:15 | 8.184 | 120,610 | 79,265 | 33,929 | 103/252 | +25.9% |
| Base #8 | ISTONKS / AAPLc | 09-11 17:33:05 | 12.687 | 171,024 | 48,743 | 7,494 | 28/20 | −26.94% |
| BSC #2 | BinanceTown / USDT | 09-11 12:52:10 | 17.369 | 624,308 | 222,646 | 950,557 | 288/239 | +5.89% |
| BSC #6 | BUDDY / BTCB | 09-11 23:47:47 | 6.442 | 179,080 | 43,169 | 28,123 | 152/157 | −34.18% |
| BSC #11 | BinanceTown / QQQB | 09-11 09:24:05 | 20.837 | 285,543 | 63,192 | 42,034 | 240/154 | +30.6% |
| BSC #12 | KNOT / WBNB | 09-12 00:08:54 | 6.090 | 1,690,610 | 177,438 | 3,988 | 3/19 | −2.08% |

Sin fecha informada: Base #1 LAPTOP, #13 Solana, #15 Virtual Protocol, #23 Apple Inc.; BSC #8 LAB. Los nombres no establecen identidad, antigüedad ni respaldo.

## FLM: anuncio nuevo, concepto anterior, vínculo token sin demostrar

[Alex Wormuth @nftechie_](https://x.com/nftechie_/status/2098532090874560815) anunció **Fly Language Model / GPF — Generative Pre-trained Fly** el **11 septiembre 22:00:13 UTC**. Lecturas nativas: ~06:15, 38,078 vistas/577 likes/95 reposts; ~06:27, 38,412 vistas/582 likes/95 reposts. Es crecimiento del original, no prueba de nuevos autores.

El [repositorio primario](https://github.com/nftechie/flm) tiene un [commit inicial](https://github.com/nftechie/flm/commit/d60610ff6af1efafaa8032c5302c3b02e9dd227f) fechado **11 septiembre 21:47:50 UTC** por autor y committer; otro añade arte a las 21:51:25. API guardada en `flm-commits.json`. El pool Base se creó **3m02s después del anuncio**; esto no prueba que lo haya creado el autor.

El README describe un modelo congelado más un adaptador sobre el grafo del conectoma. Aclara que la capacidad lingüística viene del modelo preentrenado, que los estados son abstracciones numéricas y que el control comparativo rindió ligeramente mejor. No demuestra que una mosca biológica entienda lenguaje. No se observó allí CA ni aval de token.

**Antecedentes que impiden llamarlo primer FLM:** [Franci Penov](https://x.com/francip/status/2097913611725475897) publicó **FFLM — Fruit Fly Language Model** el **10 septiembre 05:02:37 UTC**, modelo Liquid AI condicionado por cerebro de mosca; 83 vistas/1 like, fecha y contenido verificados entrando al post. [Chuks](https://x.com/ChuksSzn/status/2098390618774921321) ya escribió “LLM to FLM” el **11 septiembre 12:38:04 UTC**, 130 vistas/3 likes. Son antecedentes, no adopción posterior atribuible a Alex.

Búsquedas exactas con/sin respuestas encontraron un [chiste de descarga](https://x.com/MoonPieJoe/status/2098534493636247740) del **11 septiembre 22:09:46 UTC**, 208 vistas/1 like. Otras publicaciones eran CA, anuncios automáticos o tesis de inversión. [Chainriffs](https://x.com/Chainriffs/status/2098643613005623553), **12 septiembre 05:23:22 UTC**, 780 vistas/8 likes, habla explícitamente del setup de $FLM: no cuenta como cultura independiente. No se hallaron tres reutilizaciones nuevas de autores independientes con alcance relevante fuera de promoción.

Es una implementación distinta del agente navegador de [FLYBRAIN](https://flybrain.online/), dentro de la misma ola de conectomas. No afirmar mismo software, primer concepto ni territorio virgen.

**Metadatos discordantes:** el sitio `btxfox.com` de la ficha DEX redirigió a otro dominio de launchpad y otro contrato; el tool web bloqueó ese destino. No se siguió ni verificó. No autentica al autor o al token. La fuente técnica está comprobada; el vínculo primario con el CA Base no.

## BinanceTown: mayor flujo joven, escena de marca ya ocupada

[Binance oficial](https://x.com/binance/status/2097959283681845587), **10 septiembre 08:04:06 UTC**, pregunta por la primera parada en Binance Town y muestra una ciudad temática con bStocks, TradFi Gate, Wallet y DeFi Terraces. UI a ~06:15: **279.8K vistas redondeadas**, 451 likes, 104 reposts, 234 respuestas, 668 votos. Catalizador de casi dos días, no nacido en esta ronda.

La ficha de #2 enlaza ese post, pero **el post no contiene CA ni aval de token**. Fuente de escena no equivale a autenticación de emisor. #2 es referente de flujo de esta muestra joven, no winner global, orgánico o seguro.

El CA distinto de #11 sí coincide con la bio de [@BinanceTown__](https://x.com/BinanceTown__). Su [post fijado](https://x.com/BinanceTown__/status/2098381720424771922), **11 septiembre 12:02:42 UTC**, propone ciudad onchain inspirada en dibujo Binance: 4,539 vistas/20 likes/8 reposts. Su [demo](https://x.com/BinanceTown__/status/2098588567853527432), **12 septiembre 01:44:39 UTC**, tenía 877 vistas/10 likes. Son publicaciones del promotor.

En búsqueda exacta reciente predominó [Thomas Nguyen](https://x.com/easyforshopping/status/2098613227122983144), **03:22:38 UTC**, describiendo variantes metaverse/four.meme y stonkbroker/flap; 1,020 vistas. Varios posts del mismo autor no equivalen a varios autores. [WNM](https://x.com/wnmszn/status/2098628613688225825), **04:23:46 UTC**, tenía 46 vistas. No demuestran expansión social masiva después de 04:51. No se obtuvo autenticación del CA dominante #2 desde una cuenta propia: su metadata enlaza el post de marca.

**Espacio:** ya hay dos contratos activos entre top25 BSC y propuestas distintas. No existe vacío probado para otro BinanceTown. No sumar MC entre ambos ni trasladar afiliación de Binance a ninguno.

## BUDDY: relanzamiento explícito

[@BuddyonBNB](https://x.com/BuddyonBNB) enlaza comunidad con el CA exacto de #6. Su [anuncio fijado](https://x.com/BuddyonBNB/status/2098564416698757301) es del **12 septiembre 00:08:41 UTC**; declara relanzamiento BNB, nuevo CTO y misma historia. 4,505 vistas/32 likes/12 reposts. Ojo: el artículo citado dentro del post tiene fecha 11 septiembre 23:20:38; no confundir con la fecha del anuncio.

Relata perro rescatado en 2013 e inscripción Bitcoin de mayo2014 y promociona BTCB rewards. **Afirmaciones del promotor:** no se verificaron aquí transacción histórica, primacía de “first crypto dog”, participación del dueño ni ejecución de recompensas.

Su post de **04:49:51 UTC** tenía 380 vistas/13 likes/4 reposts; el de **03:07:40 UTC** sobre PFP tenía 506 vistas/18 likes/3 reposts. Es continuidad de la cuenta token. Respuestas visibles mayormente cripto, publicidad o consultas sobre BNB/Solana; no nueva ola cultural independiente demostrada. El −34.18%1h observado tampoco sustenta llamar consolidación a la mera presencia de volumen.

## Otros dos jóvenes y quotes

[iStonks](https://x.com/iStonksbase/status/2098559124938355100), **11 septiembre 23:47:39 UTC**, promociona iMessage → dispositivo Apple → par AAPLc; 1,424 vistas/24 likes/10 reposts. El post no valida por sí mismo el funcionamiento desde iMessage. Es una expresión de plataforma/quote, sin atención cultural independiente encontrada en esta revisión.

[KNOT](https://x.com/knotdotfun/status/2098565049308811272), **12 septiembre 00:11:11 UTC**, publica CA exacto y se presenta como plataforma de tokens/analytics; 1,037 vistas/10 likes/4 reposts. [Anuncio de lock](https://x.com/knotdotfun/status/2098572776378597708) a00:41:54 enlaza pool exacto, pero no fue auditado. No confundir KNOT con KNOTS. MC1.69M no reemplaza actividad: 22 operaciones/~4K volumen1h en el corte.

El agente **launch_space** verificó en paralelo GOOGLc/AAPLc exactos mediante [catálogo oficial Base](https://docs.base.org/build-on-base/integrate-defi/list-tokenized-stocks) y prospectos de Coinbase Onchain SPV Ltd. También reportó QQQB exacto en [Binance Proof of Collateral](https://www.binance.com/en/proof-of-collateral/bstocks) y emisor BTech Holdings Limited en su [FAQ](https://www.binance.com/en/support/faq/detail/f0c03cd6509a4085b4cce1636f16be38). Esta es verificación del compañero, no lectura propia de esos documentos; el dossier es `round-04/stock-quotes/LECTURA.md`. **Colateral del quote no respalda al meme ni otorga al holder del meme derecho sobre la acción.**

## Identidades exactas

| Red / par | Token | Pool | Quote |
|---|---|---|---|
| Base FLM/GOOGLc | `0x39988BF0638Edb8c65cE0fB9e1e457C575157BA3` | `0xb49ce96e99b5eb8fe3c7a03687d9c6d83302172dd2737fb88f9ac133baf3c24c` | `0xb2000000000000000000002D0BA3164cc74f58B7` |
| Base ISTONKS/AAPLc | `0xCB2BAff7177C8966A8b059b3Df3e9323dc2Ee267` | `0x9f8353f61574da73218206ad3f70d9455bfed9c4` | `0xb200000000000000000000C2e324d24d7eEcd1fb` |
| BSC BinanceTown/USDT | `0xe210C0583C1071714EDed2d8bEEab05Ab5bB7777` | `0xcec13213c390d51121f82ba2ecafb8e11e0af7a3` | `0x55d398326f99059fF775485246999027B3197955` |
| BSC BinanceTown/QQQB | `0x3c1127070996a55D838A1E2743249DC28Cec7777` | `0x1a1def8c55238986c7067a57726a058d3497b608` | `0x205812CdBed920aFf76C6580abD681a46D11efc7` |
| BSC BUDDY/BTCB | `0x4E0026B2A27F60CD7eD8BB71F9489501B1F87777` | `0xf0ca0a1dcd9fc30ad5570e1882a483f8e4cafbb6` | `0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c` |
| BSC KNOT/WBNB | `0x795a3a4e90F837ae137ed2C92509f5F59c474547` | `0xf4a627351fc6bcef0e7c2a02b7b8524fbe265e26` | `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c` |

Orden útil: BinanceTown/USDT para contrastar flujo; FLM para rama técnica nueva con antecedentes; BUDDY como revival. La muestra no demuestra hueco desocupado ni justifica un lanzamiento. Separar atención del concepto, atribución al CA y calidad de mercado.
