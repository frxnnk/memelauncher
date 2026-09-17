# Solana: 25 pares Trending 6H, 12 septiembre 2026

**Corte del ranking 06:33:57.805 UTC / 03:33:57.805 ART; API de esos mismos pares 06:35:36.740 UTC.** Fuentes primarias leídas entre 06:36 y 06:43 UTC. Las cifras de mercado permanecen fechadas a las 06:35; no son un refresco posterior.

**Resultado:** la novedad temporal clara es el pool de **revolve**, creado a las 05:35:19 UTC, posterior al corte de las 04:51 de las rondas previas. Su narrativa es infraestructura de recompras con fees, no un meme cultural nuevo. **LAMA** ofrece salida crypto→tarjeta, pero su funcionamiento e identidad corporativa quedan sin demostrar. **Open Set** ya estaba en la cohorte de root: esta revisión aclara su promesa de sorteos de cartas con fees, no lo cuenta como descubrimiento nuevo. No apareció una escena cultural nueva y desocupada fuera de las familias anteriores.

## Regla y denominador

- Primeros 25 pares de `https://dexscreener.com/solana`, sin filtrar antes por edad; todos los DEXes, ranking visible **Trending 6H**. La tabla tenía intervalo **Last 24 hours**, por lo que sus volúmenes no se confundieron con h1/h6. Se consultó una sola tanda API para los 25 IDs fijados.
- `ranking-input.csv` conserva posición/pool/símbolo/quote/edad UI. `ranking-first.json` guarda selección temporal, URL, respuesta API y timestamp. `ranking-first-summary.json` y CSV guardan métricas/direcciones. 25/25 IDs respondieron y se emparejaron.
- **25 pools / 22 tokens:** EMBER aparece en #6/#23/#25; STONK en #15/#19. Los duplicados permanecen en el denominador.
- **7 pools ≤12h**, todos con actividad1h y liquidez reportada; ninguno sin fecha. Edad es del pool, no primera emisión del token ni nacimiento del concepto.
- ALL(#3) y STONK(#15/#19) permanecieron en muestra sin volver a investigar narrativa; no aparecieron STEEL ni ACME. ALLINU(#14) tiene nombre parecido pero CA distinto: no se asumió mismo token/equipo que ALL.
- CATAI(#1) y Stunk(#2) mostraban12h redondeadas; la API daba12.748h/12.383h, por lo que **quedan fuera del umbral≤12h**.
- Boosts activos en CATAI800, Stunk730, SATu500, MM100, PAIRZ100, LOOP100. Los7jóvenes tenían boosts nulo, lo cual no demuestra ausencia de promoción.
- Liquidez y volumen son valores de API. No se auditaron concentración, wash trading, permisos ni profundidad ejecutable. Alta rotación frente a liquidez no prueba atención independiente.

## Siete pools jóvenes

Valores USD, cambios y operaciones reportados a las 06:35:36 UTC. Fechas de creación son2026, UTC.

| Rank | Token/quote | Pool creado | Edad h | MC | Liquidez | Volumen1h | Compras/ventas1h | Cambio1h | Clasificación |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| #3 | ALL/SOL |09-11 19:38:17|10.955|2,253,538|170,403|230,694|1,159/885|−3.61%|Ya investigado por root; no repetir.|
| #8 | ㅤ/ZEC |09-11 23:33:02|7.043|155,688|36,971|71,308|623/321|−51.88%|Nombre/símbolo Hangul filler U+3164, visualmente vacío; no origen primario propio hallado.|
| #10 | DKNG/DKNG |09-11 20:06:21|10.488|683,865|74,371|61,926|328/185|−31.65%|Donkey Kong contra ticker DraftKings; catalizador Ansem explícito, familia stock-pair.|
| #12 | OS/CARDS |09-11 22:53:25|7.703|658,200|116,423|76,318|334/211|−3.61%|Open Set, ya en cohorte root; fees→sorteo cartas.|
| #14 | ALLINU/DKNG |09-11 20:02:18|10.555|1,000,434|94,940|72,749|390/253|−18.10%|Sin sitio/social propio reportado; no declarar narrativa nueva.|
| #16 | LAMA/SOL |09-12 02:59:05|3.609|336,919|51,302|143,971|1,020/821|+26.79%|Promesa de crypto→fiat financiada con trading fees.|
| #22 | revolve/SOL |09-12 05:35:19|1.005|213,178|39,428|507,935|5,888/4,816|+451%|Pool posterior a las 04:51; plataforma de recompras y burns.|

## 1. revolve: novedad de pool y producto, ejecución pendiente de auditar

[@revolvepad](https://x.com/revolvepad) publica el CA exacto de la muestra en bio y [anuncio](https://x.com/revolvepad/status/2098644698990879215), **12-sep05:27:41 UTC**, ocho minutos antes del pool. A06:36:31 se observaron **5,804vistas,69likes,21reposts,13respuestas**. La propuesta anunciada es acumular creator fees hasta una caída y usarlos para comprar/quemar, con reparto estándar70%buyback/burn,10%launcher,20%plataforma. Es afirmación del emisor, no función probada por leer el post.

Hay continuidad de desarrollo anunciada por la misma cuenta: a[05:57:15](https://x.com/revolvepad/status/2098652136959807889) aún esperaba una caída para la primera ejecución del main token; a[06:18:12](https://x.com/revolvepad/status/2098657408520524046) seguía acumulando fees; a[06:27:59](https://x.com/revolvepad/status/2098659874209194279) reconocía un problema de velocidad del watcher que debía verse en REVCAT; a[06:30:50](https://x.com/revolvepad/status/2098660589489000698) afirmaba compras/burns pero seguía ajustando velocidad. Ninguno de esos posts sustituye una tx.

La búsqueda exacta `"revolvepad" -from:revolvepad`, latest a las 06:37:37, recuperó14posts visibles. Todos orbitaban al proyecto: consultas, predicciones de MC, discusión sobre mascota/launches o problemas. [Plent](https://x.com/jesustookmyv/status/2098661916478689437),06:36:06, preguntaba cómo se define una caída;6vistas. [Hermes](https://x.com/coinsolmaxi/status/2098661741370515813),06:35:25, preguntaba si REVCAT era mascota;32vistas. [ROZCASH](https://x.com/rozcash/status/2098661248825209281),06:33:27, afirmaba que su prueba no funcionó;7vistas. Son autores distintos y atención actual, pero no adopción cultural independiente ni prueba de fraude/funcionamiento.

**Auditoría en paralelo:** winner_refresh revisa hasta 2 casos en `round-04/revolve-audit/`. Informó un split main80/0/20 distinto del70/10/20 estándar y saldos internos, todavía no prueba de burn en ese mensaje. No confundir el CA `z4t52…` mencionado por un tercero con REVCAT: el compañero identificó ese mint como REVOLVER y autentica REVCAT separadamente. Ver su cierre antes de describir ejecución.

## 2. LAMA: promesa fintech con identidad y servicio sin autenticar

[@LamaPays](https://x.com/LamaPays), su [primer post fijado](https://x.com/LamaPays/status/2098529820791460174) del **11-sep21:51:12 UTC** y [lamanan.com](https://lamanan.com/) usan el CA exacto `2fWzx…5pump`. La atención del original era **10,831vistas,110likes,28reposts** a las 06:36:31. El anuncio antecede al pool más de cinco horas: no equiparar fecha del pool con origen del producto.

El sitio afirma que trading fees financian los costes de convertir cripto a dinero en tarjeta. A06:38:15 renderizaba una promesa de dos segundos y0%plataforma, pero otra sección indicaba procesamiento habitual dentro de24h. Los contadores mostraban0transferencias y$0pagados; esto puede ser contador sin datos, no demuestra por sí solo cero clientes. En X, [04:37:45](https://x.com/LamaPays/status/2098632129433284904) se anunciaba sobrecarga por muchas transacciones. No hay prueba de liquidaciones en esta revisión.

La landing afirma estar licenciada pero el texto leído no identificó entidad ni número de licencia. Su link con etiqueta LAMA Pay on LinkedIn apunta a `linkedin.com/company/quantolock`, una discordancia de destino; no se deduce quién opera el servicio. No se autenticaron alianzas Visa/Mastercard/Apple, TestFlight ni procesador de pagos. No se conectó wallet ni se ingresó dato alguno.

Búsqueda exacta de menciones externas sin respuestas a las 06:40:23: seis resultados, cuatro publicaciones de holders/precio y dos avisos DEX. [Razielane](https://x.com/Razielane999/status/2098655655389466757),06:11:14,179vistas/1like, promociona su entrada; [Crypto Pirate](https://x.com/agustinabela360/status/2098647484197384305),05:38:45,32vistas. No son testimonios verificables de uso del servicio.

**Antecedente del dominio, con límite de atribución:** [ficha Bybit fechada24-jun2026](https://www.bybit.com/es-MX/price/lamanan/), [ficha CoinGecko histórica](https://www.coingecko.com/zh/%E6%95%B0%E5%AD%97%E8%B4%A7%E5%B8%81/lamanan) y [ficha con contrato completo](https://blockspot.io/nl/coin/lamanan/) asociaban lamanan.com a otro LAMANAN, mint `Fj6p7eodS67517JTEJeYNN54bvk9fRK1Q7oC4pAupump`. Son fuentes secundarias antiguas, no mercados actuales. El handle asociado antiguamente, [@lamanan_ex](https://x.com/lamanan_ex), hoy se presenta como CRAFT y publica otro CA en [julio2026](https://x.com/lamanan_ex/status/2082482659385635212). No se demostró continuidad del equipo, venta de dominio, relación entre mints ni relanzamiento autorizado. Esta evidencia impide inferir una empresa nueva o reputación histórica a partir del dominio.

## 3. Open Set: carta como premio, no hallazgo nuevo

Ya estaba en el seguimiento de root antes de esta ronda. El [artículo primario](https://x.com/opensetfun/status/2098550056282386780), **11-sep23:11:37 UTC**, contiene el CA exacto y propone convertir fees1.5% a USDC para comprar packs Collector Crypt y sortear pNFT de cartas graduadas entre holders. La elegibilidad inicial0.10% pasó a0.05%/500,000OS según [actualización](https://x.com/opensetfun/status/2098638914441404601) de **12-sep05:04:42 UTC**. Estas son reglas publicadas, no cumplimiento auditado aquí. Artículo a las 06:38:15:17,823vistas/49likes/19reposts.

Hay nuevo contenido posterior a las 04:51: [One Piece hour](https://x.com/opensetfun/status/2098641845337088347), **05:16:21 UTC**, anuncia la franja literal hoy11:00–12:00CET;774vistas/21likes/7reposts. No se convirtió aUTC porque el emisor no aclaró CET frente al horario de verano. Es evento del promotor, no noticia mundial nueva de One Piece.

[Arron](https://x.com/Arron_finance/status/2098658144683700554),06:21:07,1,220vistas/3likes, relaciona OS con cartas/CARDS/ripmart; una opinión no demuestra alianza. [Crypto Chrema](https://x.com/cryptochrema/status/2098627139587223797),04:17:55,336vistas/6likes, afirma un premio MegaCharizard; no lo tratamos como entrega probada. launch_space audita hasta 2 recibos en paralelo. Predomina atención al token y su mecanismo, no una escena meme que viaje fuera de crypto.

## DKNG y los dos casos sin origen suficiente

[Ansem](https://x.com/blknoiz06/status/2098503274282303971) pidió Donkey Kong emparejado con DKNG y una asignación0.1% el **11-sep20:05:43 UTC**. A06:40:52 tenía **208,508vistas,891likes,163reposts,344respuestas**. El pool observado nace38segundos después. La [cuenta del token](https://x.com/donkeykongondk) tiene CA exacto y [cita el pedido](https://x.com/donkeykongondk/status/2098568596985135499). Hay catalizador fuerte de CT, pero explícitamente pertenece a stock-pairs; no a un estreno Nintendo. No se verifica entrega/aceptación de asignación, aval DraftKings ni respaldo del quote por etiquetar cuentas.

El símbolo visualmente vacío #8 sólo enlaza stonkfun.xyz y carece de social propio en la API; ALLINU #14 carece de ambos. No se inventó identidad, privacidad demostrada ni parentesco por nombre. No llenar esos vacíos con una narrativa hipotética.

## Identidades exactas de los siete jóvenes

| Rank | Token | Pool | Quote |
|---|---|---|---|
|3|`ASoQZA3Dee2HU34Vwx3b5SAtTaczJtZcyx1T413nDALL`|`uzAK8txfJAvqS9VHtDaYAWfBiYbzwq4BzxdiFJTQEnJ`|`So11111111111111111111111111111111111111112`|
|8|`Gt9brNVXP7gdGtUqZLcJAhbZTjLEcKrA53F18fRSEeAp`|`H2KJ699rzrbiH8D8E1gQ6J86wLZTTVkrpB9RhXaWnZ54`|`A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS`|
|10|`CdAoD87kYKHbtRFawiSqQJMX1pbKisoG7Ha1oJ47kB26`|`6zCSdnTE8c3KXWuosxSnBt4wWsN9zTA73umKijP2p6au`|`DKNGQFNGQmoBdXSRGKJ8tTu7uPDasw5JDcfMmWniNfow`|
|12|`8LstZpZuR9Dy7JCZC3YwPEWtbYhuDVFAYV37r6ZAcuHz`|`5dYsxy1hJ8DxejsfHJR9wyRsuLHw6wCLKk7idc1kszUn`|`CARDSccUMFKoPRZxt5vt3ksUbxEFEcnZ3H2pd3dKxYjp`|
|14|`4MMQY9bwkxxTtsK3W227Q5ABT6yFY8Pmn9Ze7wmAXKY8`|`5752ia7jC3ZU1c8ycytaSyi5D4nVhApSKvreGbs7pwWL`|`DKNGQFNGQmoBdXSRGKJ8tTu7uPDasw5JDcfMmWniNfow`|
|16|`2fWzx35rQMAATQGhJzVTvzeXHcenCQLqCog9Jkg5pump`|`CXKwgui737V9EDZKLtU5AeHQnWX4kNTnn3gGQT9Tf6wK`|`So11111111111111111111111111111111111111112`|
|22|`J8X5ygWHY5uHFch7m3MisSC7eDAWpAkgi1pyqfT5pump`|`zf7uTK56DM7en5KXNvtPD9AT66BamJb6DfZuqBhVgBr`|`So11111111111111111111111111111111111111112`|

La muestra amplía productos que convierten fees en recompras, servicio de pagos o premios. No valida un winner cultural ni un hueco para lanzar otro token. Para la decisión actual, revolve aporta novedad temporal verificable del pool; sus recompras y los premios OS dependen del cierre de las auditorías paralelas.

