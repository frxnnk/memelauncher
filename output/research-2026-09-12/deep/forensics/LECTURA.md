# Verificación pública de holders, contratos y comisiones

Corte: 12/09/2026, 04:36–04:49 UTC (01:36–01:49 ART). GET públicos de Blockscout y lecturas de las interfaces públicas de LongX y Blockscout. No se conectó una wallet, firmó, simuló una compra/venta ni ejecutó una transacción.

## Qué cambia la lectura

1. **Los holders más grandes de CATGPT y ANTHROPIG LongX son infraestructura de pools, no whales identificados.** PoolManager tiene 62.57% y 65.99% del supply, respectivamente. Excluirlo cambia radicalmente cualquier lectura superficial del top holder.
2. **La contrapartida LongX está concentrada y su prima se redujo.** PoolManager e integrator reúnen aproximadamente 91.5% del supply de cada wrapper. El integrator está identificado por eventos de lanzamiento y código verificado; no se le atribuye identidad corporativa ni humana.
3. **Hay pagos reales de comisiones de CATGPT.** Se verificó una transacción `collectFees` sobre el pool exacto y dos transferencias al receptor indicado por la UI. Esto confirma un pago concreto; no valida todo el total USD de la UI ni rentabilidad del creador.
4. **El homónimo ANTHROPIG/WETH es técnicamente distinto.** Contrato, launcher, decimales y distribución difieren. Sus LP aparecen casi íntegramente en la dirección de quema, pero el código del memecoin no está verificado en el explorador consultado.
5. **Un flag de bloqueo puede interpretarse mal.** Ambos memes LongX muestran `isPoolLocked=true`, pero la dirección bloqueada es `0xdeaDDeADDEaDdeaDdEAddEADDEAdDeadDEADDEaD`, distinta del PoolManager donde operan. El código sólo rechaza transferencias hacia esa dirección configurada. No es evidencia de que el pool de trading esté bloqueado.

## Origen de las fuentes

La [documentación oficial de Robinhood](https://docs.robinhood.com/chain/connecting/) identifica mainnet chain ID 4663 y `robinhoodchain.blockscout.com` como explorador. [Blockscout documenta](https://docs.blockscout.com/devs/apis/rest) que sus APIs REST alimentan la UI y que los listados tienen páginas de 50 elementos.

Los JSON preservan URL, hora UTC y respuesta completa. Los primeros 50 holders bastan para observar los diez mayores de estos listados, pero no constituyen un grafo de control común ni una auditoría de la distribución inicial. Los conteos son direcciones del indexador, no personas independientes.

## Distribución actual

Todos los porcentajes usan supply total de 1,000,000,000 tokens. En “top diez restantes” se excluye únicamente el PoolManager conocido o el pool V2 exacto, según corresponda. Se conservan otras direcciones aunque tengan código o delegación EIP-7702; no se les atribuye una identidad por heurística.

| Token exacto | Holders | Decimales | Pool conocido / supply | Mayor dirección restante | Top diez restantes / supply |
| --- | ---: | ---: | ---: | ---: | ---: |
| CATGPT `0xd6FD…1E18` | 2,719 | 18 | PoolManager: 62.566% | 2.000% | 12.752% |
| ANTHROPIG LongX `0x351A…1e18` | 2,084 | 18 | PoolManager: 65.986% | 1.355% | 9.675% |
| ANTHROPIG/WETH `0x04d6…BDC6` | 2,053 | 9 | Uniswap V2: 1.808% | 0.385% | 2.913% |

La cuenta mayor restante de CATGPT es `0xa37cD19f9A6FDcc323BA42FA498807B4212222f3`; la de ANTHROPIG LongX es `0xC47ca82b9fEd94676B1195a49FD1A68192b7CEE0`; la del homónimo WETH es `0x8cB1Bf96F3a52F5DD86B59268Df522510C3b2486`. No se verificó quién controla esas cuentas. Varias aparecen como EIP-7702: eso no prueba que sean bots, pools ni una misma entidad.

Fuentes exactas: [CATGPT holders](https://robinhoodchain.blockscout.com/api/v2/tokens/0xd6FDE6a3Fc6Ab2d83b2BE58383944CA1baDe1E18/holders), [ANTHROPIG LongX holders](https://robinhoodchain.blockscout.com/api/v2/tokens/0x351Ab2C51e223B28D219fE28cc3956410CC11e18/holders), [ANTHROPIG/WETH holders](https://robinhoodchain.blockscout.com/api/v2/tokens/0x04d6AAa3147B9f5b5dB255d3151561c07019BDC6/holders). Datos normalizados: `holder-summary.json` y `top-holders.json`.

## Roles y contratos

| Rol comprobado | Dirección | Evidencia y alcance |
| --- | --- | --- |
| CATGPT | `0xd6FDE6a3Fc6Ab2d83b2BE58383944CA1baDe1E18` | Clon EIP-1167 de DopplerERC20V1. |
| ANTHROPIG LongX | `0x351Ab2C51e223B28D219fE28cc3956410CC11e18` | Mismo tipo de clon e implementación. |
| ANTHROPIG/WETH | `0x04d6AAa3147B9f5b5dB255d3151561c07019BDC6` | Otro contrato; no verificado en Blockscout; no proxy detectado. |
| Implementación de los dos memes LongX | `0x3Be8B97Fd0e713B5aBE0649Fa830223B6B4BC599` | Fuente y ABI verificados: DopplerERC20V1. |
| Factory de esos clones | `0x1B37D3a72082029c44B35B604Ea473617580b69a` | DopplerERC20V1Factory; el campo creator de un clon apunta aquí, no a un creador humano. |
| LongLaunchFactory | `0x1Eef016F22A943abC7DD11422EDeE9D235942104` | Destino de ambas llamadas launch; proxy EIP-1967. |
| Launcher CATGPT | `0x3a8e5Ba5Aa9C2464C75621C2bFFB9CF912DB995d` | Sender de creación a las 23:40:32 UTC del 11/09. |
| Launcher ANTHROPIG LongX | `0x346895802e1AeCB0E4951b3Ee96aA37c2CB368Eb` | Sender de creación a las 23:55:47 UTC del 11/09. |
| Deployer ANTHROPIG/WETH | `0xF68A551bBb3090d292861d1032dBf08aADe4AD5D` | Creación directa a las 00:38:33 UTC del 12/09. |
| PoolManager | `0x8366a39CC670B4001A1121B8F6A443A643e40951` | Contrato verificado etiquetado; reúne activos de múltiples pools V4. |
| Integrator de los lanzamientos LongX | `0x92d435C96E63c43E12d6D0AB28f6b0B04072F765` | Campo integrator en LaunchMetadata de ambos; confirmado contra fuente LongLaunchFactory. Sin identidad humana atribuida. |
| Owner actual de ambos memes LongX | `0xeb7C034704eF8Dcd2D32324c1545f62fB4aD0862` | Airlock; lectura pública owner del proxy y evento de creación. No es owner renunciado a cero. |
| Receptor de fees CATGPT observado | `0x79B069112DF103f28bE2012a52eCEF0F4a5106F2` | Recibe transferencias de collectFees. Distinto del launcher original; no se investigó el cambio o la relación entre ambas cuentas. |

[Creación CATGPT](https://robinhoodchain.blockscout.com/tx/0xfba33e76f03a147a2d2eec8278df347164c17da60e09a006044217a15d86a2a8), [creación ANTHROPIG LongX](https://robinhoodchain.blockscout.com/tx/0x24b4b097cb9e417921ca6e96dd90cd875bfa6bf33465abc898b223be600dc9dc), [creación homónimo WETH](https://robinhoodchain.blockscout.com/tx/0x1b85bcf4f240dc647d9f21558bddd9b1fac811d5b192df38569b2d6819997e84).

### Duración registrada de reserva del ticker

Los eventos `LaunchCreated` registran 48 horas en ambos casos: CATGPT `1789342832 − 1789170032 = 172800` segundos; ANTHROPIG LongX `1789343747 − 1789170947 = 172800`. La UI leída por el frente operativo anuncia 24 horas. Los eventos demuestran la reserva de esos dos lanzamientos, no la configuración futura ni ausencia de cambios posteriores. Evidencia: `fee-and-creation-logs.json`, logs de ambas transacciones de creación enlazadas arriba.

## Permisos visibles y LP

Lecturas públicas de ambos proxies: owner Airlock, `isBalanceLimitActive=false`, `isPoolLocked=true`, pool configurado en `0xdeaDDeADDEaDdeaDdEAddEADDEAdDeadDEADDEaD`. Ver [CATGPT read proxy](https://robinhoodchain.blockscout.com/address/0xd6FDE6a3Fc6Ab2d83b2BE58383944CA1baDe1E18?tab=read_write_proxy) y [ANTHROPIG read proxy](https://robinhoodchain.blockscout.com/address/0x351Ab2C51e223B28D219fE28cc3956410CC11e18?tab=read_write_proxy).

En la [implementación verificada](https://robinhoodchain.blockscout.com/address/0x3Be8B97Fd0e713B5aBE0649Fa830223B6B4BC599?tab=contract), `_mint` aparece en `initialize`, protegido por `initializer`; la ABI consultada no expone una función pública independiente `mint`. Hay funciones owner para `lockPool`, `unlockPool` y `updateTokenURI`. No se auditó todo el sistema Airlock, migradores, factory, autoridad sobre posiciones V4 ni rutas de upgrade de los quotes; no se afirma que todos los permisos estén eliminados.

El LP del homónimo WETH es `0xD3246b31d9254A726DC81F3b3000e42147868856`, etiquetado Uniswap V2. El indexador reportó supply 1e18 unidades LP y un único holder `0x000000000000000000000000000000000000dEaD` con 999999999999999000 unidades, prácticamente 100%; restan 1000 unidades mínimas. Es evidencia específica de LP enviado a la dirección de quema. No valida el código no verificado del memecoin ni elimina otros riesgos. [LP holders](https://robinhoodchain.blockscout.com/api/v2/tokens/0xD3246b31d9254A726DC81F3b3000e42147868856/holders); raw en `anthropig-v2-lp.json`.

## Contrapartida LongX: supply, concentración y NAV

| Dato | OPENAIx1L | ANTHROPICx1L |
| --- | ---: | ---: |
| Supply confirmado en explorer | 577,383.6079 | 451,819.6918 |
| Holders del wrapper | 335 | 316 |
| PoolManager / supply | 79.259% | 67.453% |
| Integrator / supply | 12.234% | 24.015% |
| NAV por share mostrado LongX | USD1.0392 | USD0.9963 |
| Antigüedad de prueba UI | 3 horas | 2 horas |
| Precio pool mostrado UI, 04:39–04:40 | USD1.1167 | USD1.1934 |
| Prima UI frente a NAV | 7.45% | 19.78% |
| Prima en corte anterior, 04:07–04:15 | 15.70% | 60.30% |
| TVL UI | USD600,033.78 | USD450,180.03 |
| Cap de depósito UI | USD600K, 100% usado | USD450K, 100% usado |

Los supplies coinciden con el orden y precisión mostrados por la plataforma. NAV y TVL son afirmaciones de la plataforma con prueba de horas de antigüedad; no se auditó el respaldo ni la ejecución de redenciones. PoolManager representa custodia conjunta de múltiples pools; sus unidades no equivalen a una única wallet con disponibilidad inmediata para vender todo.

En los pools exactos de CATGPT y ANTHROPIG LongX, el corte DEX de 04:39 reportó 160,957 OPENAIx1L (27.877% del supply del wrapper) y 82,374 ANTHROPICx1L (18.232%). Su valoración aritmética a NAV sería USD167,267 y USD82,069 respectivamente. No es una cotización de salida. Datos en `quote-pool-supply.json`.

[Vault OPENAIx1L](https://app.long.xyz/longx/0xfe09Fb328bE1c286B4f597eD34764b7472ae72c5), [vault ANTHROPICx1L](https://app.long.xyz/longx/0x1937caD42b17D43bB2b347ce16d5288887C46c33), [supply OPENAI](https://robinhoodchain.blockscout.com/api/v2/tokens/0xfe09Fb328bE1c286B4f597eD34764b7472ae72c5), [supply ANTHROPIC](https://robinhoodchain.blockscout.com/api/v2/tokens/0x1937caD42b17D43bB2b347ce16d5288887C46c33).

La descomposición del agente principal (`../price-decomposition.json`) muestra, entre 04:12 y 04:39: CATGPT -28.68% USD y -23.18% frente a su quote; ANTHROPIG LongX -50.46% USD y -31.43% frente a su quote. La compresión de prima del wrapper es consistente con una parte del cambio en USD; el meme también perdió valor contra el propio wrapper. Esta separación aritmética no demuestra causalidad de compras o ventas concretas.

## Prueba puntual de comisiones

[Transacción 0x20926…2ae0](https://robinhoodchain.blockscout.com/tx/0x20926bd69c982d2c0ae71ba761b09b98121c280aa81bf9706ce2fd518c892ae0), 12/09 04:29:41 UTC, estado ok: `collectFees(bytes32 poolId)` usa el pool CATGPT exacto `0x086f510359ad57e4f8588b71ffa21fe29bbed044e4d13aa2f72ecaefeda95a36`.

Desde DopplerHookInitializer `0x4e3468951D49f2EEa976eD0D6e75fFCb44a9a544` hacia `0x79B069112DF103f28bE2012a52eCEF0F4a5106F2` se registraron:

- 286.781428965212428205 OPENAIx1L.
- 31,868.324066993950389299 CATGPT.

La primera página contiene otras `collectFees` del mismo pool. No se sumaron pagos históricos ni se validó el total USD23,946.81 presentado por otra lectura de la UI. No hubo auditoría de costes del creador, compras propias o atribución de origen del volumen. Evidencia compacta en `catgpt-fee-proof.json` y respuesta completa en `fee-and-creation-logs.json`.

## Qué evidencia cambiaría una decisión de lanzamiento

- Un nombre distinto necesita difusión externa identificable y repetida; ni miles de direcciones ni un factory funcional demuestran demanda por un nuevo meme.
- La capacidad efectiva de conseguir y redimir el wrapper importa: caps completos, primas cambiantes y quote concentrado pueden distorsionar métricas en USD. Una cotización verificable de la ruta y autoridad sobre LP/posiciones sería más informativa que la cifra agregada de liquidez.
- Ya existen pagos de fees concretos; el próximo criterio económico sería fees netos sostenidos frente al coste real de sostener atención, no extrapolar el pago de un winner a cualquier nuevo lanzamiento.
- Antes de usar “liquidez segura” o “contrato sin control”, falta verificar autoridad de posiciones V4, migración, permisos completos de Airlock y del wrapper. Para el homónimo WETH falta fuente verificada del token. Son campos desconocidos, no acusaciones de rug o fraude.

No se infirieron bundles, wash trading, compra orgánica, control común de wallets ni intención del deployer a partir de heurísticas.
