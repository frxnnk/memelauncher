# Revisión de la hipótesis 911 / torres gemelas

Corte **12/09/2026 06:39:10–11 UTC / 03:39 ART**. Consultas públicas DEX Screener. La hipótesis original volvió a contrastarse expresamente, además de seguir 911/BA en la cohorte histórica.

**La búsqueda muestra mucha ocupación nominal y muy poca negociación actual.** En las coincidencias retenidas, el pool con más volumen horario reportaba US$462,94. No apareció un winner de flujo que compita con los líderes observados en otras familias. Esto no demuestra que nunca lo hubiera ni que hayamos localizado todos los tokens existentes.

## Búsqueda y denominador

Se hicieron cuatro consultas: `9/11`, `Twin Towers`, `911` y `Never Forget`. Cada una devolvió30resultados,120filas en total y113pools distintos. La consulta con barra `9/11` devolvió muchos resultados irrelevantes —ANTHROPIG, STONK y otros—, de modo que no se atribuyó su volumen a esta narrativa.

Se retuvieron **85pools /78tokens con coincidencias en nombre o símbolo**: 9/11,911,TwinTowers,NeverForget,September11 oWorldTrade. Es una criba nominal, no autenticación cultural de cada proyecto. Se deduplicó por red+pool; la cifra de tokens usa red+CA. El límite de30resultados por consulta y la semántica del buscador impiden presentarlo como censo.

| Medida en las85coincidencias nominales | Resultado |
| --- | ---: |
| Pools con volumen1h positivo | 7 |
| Pools con al menos una compra1h | 3 |
| Pools con volumen1h cero | 78 |
| Liquidez informada explícitamente como0 | 21 |
| Liquidez no informada, null | 24 |
| Máximo volumen1h por pool | US$462,94 |

No se equipara null con cero. No se suman capitalizaciones de pools repetidos ni se llama estabilidad al precio residual de pools inactivos.

## Los siete con negociación horaria

| Pool exacto | MC USD | Liquidez USD | Volumen1h USD | Compras /ventas1h |
| --- | ---: | ---: | ---: | ---: |
| [911 / SOL](https://dexscreener.com/solana/dfrju8f4yvltfmquha9l27h1aagfkupmb2mftn9h5ztb) | 8.371 | 6.692,52 | 462,94 | 5 /15 |
| [Never Forget / SOL](https://dexscreener.com/solana/bpiojru3qpyauu5mw3vcqxps5kv6asz5oi5kvtmuznxl) | 8.119 | 9.195,15 | 91,47 | 2 /14 |
| [Twin Towers / SOL](https://dexscreener.com/solana/ejepv9htxnmrpcnkjs72raatgkb4gx9tryn981jw8du) | 3.150,02 | No informada | 62,00 | 0 /3 |
| [Never Forget 9/11 / SOL](https://dexscreener.com/solana/4mmrsho25agxhkb8ytwgly1tsd98q6hjl2t6untzbhgu) | 2.996 | 3.067,73 | 49,07 | 0 /5 |
| [911 / BA, Robinhood](https://dexscreener.com/robinhood/0x30f31e2ae9a6dfb0caf0713758074c5fe05a3bc0706b271fe41df09cf196d930) | 10.498 | 8.831,83 | 28,62 | 0 /2 |
| [TWINTOWERS / SOL](https://dexscreener.com/solana/6ygydm6digqvkdzq9btk3qdgnttpbkokblsj6lg6rnuk) | 2.272 | 2.378,83 | 6,25 | 2 /2 |
| [NEVER / SOL](https://dexscreener.com/solana/2q1jabcqaebonwleaeeycpcxaypanmrpvswznt56rcqe) | 3.082,41 | No informada | 1,46 | 0 /2 |

El NeverForget de la segunda fila es un pool de2025según `pairCreatedAt`: no es un lanzamiento de este aniversario. El primero existe desde10/9/2026; no se interpreta su edad de pool como fecha de origen de la narrativa.

También hay [Twin Towers / ETH en Robinhood](https://dexscreener.com/robinhood/0x6ac673f0eb1f1f68d0bbbc6b82cb47cb4c7d27b947c8d43883571c313b68e026) con MCUS$57.935 y liquidezUS$35.612,89, pero volumen1h cero. Algunas coincidencias Solana mostraban capitalizaciones de millones con liquidez cero: no se usaron para declarar un winner ni una salida disponible.

## Implicación

La hipótesis de calendario tiene muchos intentos previos y poca actividad en este corte. **No priorizaría otro token de torres gemelas con esta evidencia.** La ausencia de un líder activo en las búsquedas no transforma la saturación inactiva en demanda pendiente de capturar. Haría falta un catalizador nuevo con expresión y compradores observables, no solo el aniversario o un emparejamiento con BA.

Esta subinvestigación no mide alcance social, holders, seguridad, organicidad ni profundidad de los85pools. Sirve para actualizar la ocupación y el flujo observado de la hipótesis inicial sin contaminarla con resultados irrelevantes del buscador.

Evidencia íntegra: [cuatro búsquedas y horas](anniversary-searches.json), [85coincidencias deduplicadas](anniversary-matched.json). Los JSON conservan CA y pool exactos para distinguir homónimos. El resto del mercado tiene cortes propios en [MERCADO-0635.md](MERCADO-0635.md).
