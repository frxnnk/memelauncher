# OpenSet: dos premios entregados y sorteo reproducible, con límites

Investigación 12 septiembre 2026, 06:41–06:52 UTC. Solo GET y navegador público. **La entrega sí quedó demostrada en dos casos:** recibo OpenSet, estado del proveedor CollectorCrypt y Solscan coinciden en pago, carta, destinatario y transacciones. El sorteo se reproduce con los datos publicados. No se acreditó que la lista de candidatos se comprometiera públicamente antes de conocerse la semilla.

Identidad: Solana, OS `8LstZpZuR9Dy7JCZC3YwPEWtbYhuDVFAYV37r6ZAcuHz`; pool `5dYsxy1hJ8DxejsfHJR9wyRsuLHw6wCLKk7idc1kszUn`; quote CARDS `CARDSccUMFKoPRZxt5vt3ksUbxEFEcnZ3H2pd3dKxYjp`. El recibo identifica venue stonk.fun/cpmm. [Sitio primario](https://www.open-set.xyz/), [pool](https://dexscreener.com/solana/5dYsxy1hJ8DxejsfHJR9wyRsuLHw6wCLKk7idc1kszUn).

## Regla de selección de la muestra

Congelé **los dos últimos recibos completos visibles al abrir el sitio**, drops 198 y 197. No elegí cartas caras ni testimonios favorables. La pantalla ya avanzaba al siguiente drop; el número ordinal no es un recuento auditado de entregas exitosas ni de ganadores distintos. Se preservaron HTML, JSON de recibo, listas completas y respuestas del proveedor.

## Qué recibió cada ganador

| Drop | Compra | Carta recibida | Valor asegurado publicado | Destinatario | Candidatos / peso total |
|---|---:|---|---:|---|---:|
| 197 | 100 USDC | Greninja-Gold Star PSA 9, 2021 #144 | USD 75 | `63h8mddhgPGcRsQqwbCsazVVhxhbgjK4er6ZudXZ8fCi` | 291 / 28.310 |
| 198 | 100 USDC | Darkrai Vstar PSA 8, 2023 #GG50 | USD 82 | `7fTREYp5bxYYemWMvdnSrdG2FeqppNUi8QUpSZsNe514` | 289 / 28.110 |

Fuentes del operador: [recibo 197](https://www.open-set.xyz/receipt/drop-197), [recibo 198](https://www.open-set.xyz/receipt/drop-198). Los USD 75/82 son valoración asegurada publicada, no venta realizada ni efectivo cobrado. Dos cartas inferiores al precio de sus packs no estiman el rendimiento de toda la máquina.

**Pagos:** ambos salen de `A4P9za54mrR2jYRBE2CsU66JbdxMxHyn9zPPLjsFFmRY` hacia `GachaNgyXTU3zFogQ8Z5jR2BLXs8215X2AtEH18VxJq3`, etiquetada Collector Crypt Gacha. Cada operación transfiere 100 USDC, mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`, y figura SUCCESS/Finalized. Drop197 a las 06:38:14; drop198 a las 06:40:07 UTC. [Pago 197](https://solscan.io/tx/31qEXXRweXGMuhTLTncpzFPr8SARqbiDqLD4ppnVtrM4aA9PKH8QRP4URJfrWSS7a866qBRbnGK4oowjFAiBGV6a), [pago 198](https://solscan.io/tx/4czGcqddgCdeV5VouwmF4E54w7wyuzfW5Qpx5QFVRPu7y42qgNvEc3a5HU2pUNWErbmotiF7X9TeyY2N5mKxBZQP).

**Entregas:** Solscan muestra una instrucción Metaplex **Transfer**, no acuñación nueva, aunque OpenSet denomina `mint` al campo del recibo. En 197 se transfirió un NFT `5hPFCSUdLMjQQyjFSk2zupk4HzsKe5wAWomJM8s6VH4v` desde `miDtj3vgdxVykHzRyFwyG8MXpvK8eQqamSLVdBr7WPt` al ganador a las 06:38:36. En 198 se transfirió un NFT `CjLusFnVvFWS7Ct1zoWu9ZifzxnEc8jM4C2z41EzgRek` desde `Low6UekJP3QrFVMfNRTL8CPK2SiGFhvp57sgF2pkmVu` al ganador a las 06:40:28 UTC. Ambas exitosas. [Entrega 197](https://solscan.io/tx/3YohrMA6yHx3Zne2umMN2MMWK9ZM99wzXrUZtJV7YkA1YXoCv6f4ZL154PReEBv9K1CUMsby1BwyPKhKNNKC5vYx), [entrega 198](https://solscan.io/tx/4JSvHWbbFgGeZ9YAnxsKMw2szWkSyN2ifcbt5cvKZgwnk6aR9qfBDMibDndrmnMYk4nPTxFsvSA8hUPunQ1wPTQM).

La API pública de **CollectorCrypt**, consultada con los memos publicados, confirma `pack.status=confirmed` y `send.status=confirmed`, las mismas firmas, NFT y wallets; también aporta `vrf_proof`. No se verificó esa prueba criptográfica del proveedor. `buyback=[]` significa lista vacía en esa respuesta; `refunded=null` no se convirtió en falso. [Estado proveedor 197](https://gacha.collectorcrypt.com/api/pack/status?memo=cc-257beb2a-f869-49d4-aa1f-4aca6d522e6d), [estado proveedor 198](https://gacha.collectorcrypt.com/api/pack/status?memo=cc-2b8d72fa-f58c-4124-9eff-db91e3bf0dc4).

## Elegibilidad y denominadores

La regla actual del sitio exige **0,05% del supply**, aproximadamente 500.000 OS, al snapshot; reemplaza la antigua 0,10% citada en el artículo de lanzamiento. Los pesos son 80, 100, 115, 135 y 160 para los umbrales 0,05%, 0,10%, 0,35%, 1% y 2%. El máximo equivale a **2 veces el mínimo**, no 1,6 veces el mínimo actual. Hay exclusiones mencionadas, pero no localicé su lista completa. [Reglas actuales](https://www.open-set.xyz/how-it-works), [anuncio de cambio](https://x.com/opensetfun/status/2098638914441404601).

Las listas descargadas contienen 291 y 289 direcciones únicas dentro de cada sorteo. La probabilidad condicional por peso es aproximadamente 0,283–0,565% en 197 y 0,285–0,569% en 198. Los ganadores tenían pesos 80 y 135 respectivamente; el segundo equivalía a 0,4803%. Son cálculos sobre esas listas, suponiendo el sorteo anunciado; no garantías para futuros drops.

Solscan mostraba **1.522 holders** a aproximadamente 06:48 UTC y supply 999.998.505,954781117 OS, 9 decimales. No corresponde dividir automáticamente los candidatos históricos por esta foto posterior. Tampoco son 1.522 personas ni participantes elegibles. Los dos receptores son distintos; no se investigó si comparten dueño, si habían ganado antes o si entraron por primera vez. [Token](https://solscan.io/token/8LstZpZuR9Dy7JCZC3YwPEWtbYhuDVFAYV37r6ZAcuHz).

## Reproducción del sorteo y límite decisivo

El script local `replay.py`, sin dependencias añadidas, reconstruye el hash keccak de filas `address,balance,weight` ordenadas, la semilla, el módulo por peso y el ganador. Se contrastó keccak con dos vectores conocidos. Coinciden **hash, peso total, semilla, índice y wallet** en ambos casos. Entradas preservadas: [candidatos 197](https://www.open-set.xyz/api/public/receipt/drop-197/candidates), [candidatos 198](https://www.open-set.xyz/api/public/receipt/drop-198/candidates); resultados locales en `replay-results.json`.

La entropía publicada coincide con los bloques independientes: 197 usa slot 446.363.103, hash `4qQa9KGbe8wi6o9uYNgtDEbkEqe22xwGomgurdykRVty`, a las 06:37:48; 198 usa slot 446.363.461, hash `E9acqhg55NSZLa9HhMFGDwsZALNhvKicZmnyBfwQjYc3`, a las 06:39:40. Son 150 slots después de cada snapshot declarado. [Bloque 197](https://solscan.io/block/446363103), [bloque 198](https://solscan.io/block/446363461).

**Reproducibilidad posterior no prueba compromiso previo.** No encontré en los recibos una transacción que ancle el hash/lista antes de la entropía, ni reconstruí todos los balances históricos. El pago 198 incluye un memo de orden `cc-…:open`, posterior a la entropía. Esto no demuestra manipulación: deja sin probar la afirmación absoluta de que nadie puede dirigir el sorteo. El sitio cita `scripts/verify-receipt.mjs`, pero no enlaza el repositorio en las páginas inspeccionadas; la búsqueda pública no lo localizó.

## Operación, custodia y continuidad

La documentación describe fees CARDS hacia la wallet del proyecto, conversión a USDC, compra y entrega por CollectorCrypt. En la muestra quedaron verificados **compra y entrega**, no el origen completo del USDC, la conversión CARDS, ni el porcentaje efectivo 1,5% anunciado. El pago usa la wallet del operador; el proveedor firma la transferencia del NFT. No se demostró un contrato autónomo de sorteo que haga cumplir todo el ciclo, y tampoco que cada intervención sea manual.

La custodia física y el rescate dependen de CollectorCrypt según las reglas del producto. Aquí se probó posesión onchain al entregarse, no existencia física inspeccionada, envío, autenticación del slab o seguro ejecutable. El comprador del token OS recibe elegibilidad condicional; cada drop entrega una carta a una sola wallet.

Hay continuidad editorial anunciada: One Piece hour. La configuración pública servida con la página fija **09:00–10:00 UTC del 12 septiembre**, todavía futura al corte, con escalera 50/50/50/250/50/50/50/250/1000 USD. No se contabilizó como ejecución. El recibo197 también muestra que el objetivo de USD50 terminó comprando USD100 por falta de stock: la rotación objetivo no garantiza el precio de compra. [Sitio](https://www.open-set.xyz/), [recibo197](https://www.open-set.xyz/receipt/drop-197).

**Lectura para la narrativa:** OpenSet presenta un ciclo de premios tangible, superior a un contador sin recibos. La muestra ya demuestra ejecución de un competidor existente. No demuestra demanda orgánica, solvencia de todas las rondas, imparcialidad completa ni espacio libre para clonarlo. El componente creativo que queda por evaluar es continuidad social de coleccionismo/One Piece, no inventar otro nombre para el mismo mecanismo.

## Archivos y límites

`raw/` preserva HTML del sitio, Telegram público, recibos JSON, candidatos, DEX, respuesta CollectorCrypt y logs de descarga; `raw/browser-proof.json` transcribe las lecturas de Solscan. Los GET Solscan devolvieron403, mientras el navegador permitió leerlos. No se usó ese error como ausencia de transacción. No se expandió la muestra más allá de dos premios ni se conectó una wallet.
