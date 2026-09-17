# Revolve: compra y quema comprobada, control custodial

12/09/2026. Fuentes del sitio entre 06:38 y 06:40 UTC; dos recibos de cadena a las 06:41:33 y 06:43:46. Lectura pública, sin wallet, firmas, publicación ni operaciones enviadas. Se revisaron exactamente dos transacciones completas.

**Revolve tiene ejecución real: una compra de REVCAT seguida de una quema de exactamente lo comprado dentro de la misma transacción finalizada.** También se verificó un pago desde su creator wallet a la tesorería publicada. Esto eleva el caso por encima de una promesa sin recibos; no valida todo el reparto de fees, la permanencia del servicio ni un efecto duradero sobre el precio.

## Identidad

| Rol | Dirección Solana | Evidencia |
| --- | --- | --- |
| Main REVOLVE | `J8X5ygWHY5uHFch7m3MisSC7eDAWpAkgi1pyqfT5pump` | API de links oficial y Explore |
| Pool main | `zf7uTK56DM7en5KXNvtPD9AT66BamJb6DfZuqBhVgBr` | DEX anterior y Solscan |
| REVCAT / Revolve Cat | `4pAM2FFrXN7wGVjhADY3fsDYE7jGcE1ARsfhYH6z5aCd` | Explore oficial, Solscan y recibo RPC |
| Pool REVCAT/WSOL | `64mFCezNJALzHVzLB9oWQ8kV6HPAXZdY8SE59emAp9ke` | Solscan y cuentas de la compra |
| Creator/signer REVCAT | `HEjnRRCNEqcEom6rSRj518GJBMyFEwv9ixpCdM8CxfSV` | Campo Creator del explorer; firma de ambos recibos |
| Tesorería oficial y Creator mostrado del main | `EoppPB2YkVWnMHP3VoMi6CpqeRdoZYtSjfRK6ne9BYZg` | API oficial de links y Solscan |

El mint `z4t52KLU8HBHLRxZQXxdCndj6uH9oteqTJrpBTNFzrE`, citado durante la búsqueda social, corresponde a **REVOLVER** en Explore. No es el REVCAT auditado. [API de links](https://revolvepad.com/api/public-links), [Explore público](https://revolvepad.com/api/launches?limit=24&offset=0&status=&q=).

## Dos recibos: qué ocurrió realmente

### 1. REVCAT: comprar y quemar en una sola transacción

[Recibo del 12/09, 06:41:33 UTC](https://solscan.io/tx/4KfVCoRKscTsVFMYxHPEZZZr2scCUdHT1GN3m6RbVMWV5pnzJexhjxJsErQ7ZgDsYx3vWZ1C324b1oGiJmmJfeSi), slot **446.363.812**. Solscan muestra SUCCESS/finalized. Una llamada al RPC público de Solana con `getTransaction`, compromiso `finalized`, devolvió `meta.err=null` y la misma firma/slot.

| Campo conciliado | Resultado |
| --- | ---: |
| Compra en Pump.fun AMM, instrucción principal | #5 |
| BurnChecked, instrucción principal | #7 |
| REVCAT transferidos del pool al token account del creator | **77.643,587103 REVCAT** |
| REVCAT quemados por Token-2022 | **77.643,587103 REVCAT** |
| Unidad raw / decimales | `77643587103` / 6 |
| Saldo REVCAT del token account del creator, antes → después | **0 → 0** |
| WSOL efectivamente gastados, incluyendo transferencias de fees del AMM | **0,047870942 SOL** |
| Fee de red | **0,000005 SOL** |
| Disminución neta del saldo SOL del signer | **0,047875942 SOL** |

Las cuatro salidas WSOL de la compra suman exactamente 47.870.942 lamports: 47.397.908 al vault del pool y 11.826, 449.382 y 11.826 a las otras token accounts de la ruta. No se etiquetan esos últimos movimientos como el 20% de Revolve. El wrap inicial de 49.999.999 lamports es un fondeo temporal, no el gasto final: la cuenta WSOL se cierra en la misma transacción y su sobrante vuelve al signer. La conciliación neta incluye ese cierre.

El `transferChecked` interno de #5 entrega a la misma cuenta que después usa `burnChecked` #7, con cantidad idéntica. El programa ejecutado para la quema es `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`. La [documentación de Solana](https://solana.com/docs/tokens/basics/burn-tokens) especifica que Burn/BurnChecked disminuye el saldo y el supply del mint; la [atomicidad de las transacciones](https://solana.com/docs/core/transactions) aplica a sus instrucciones. Este caso prueba una compra y quema efectiva, no sólo una transferencia a una dirección informal de burn.

**Límite de procedencia:** no se reconstruyó el historial de fondeo del signer. El recibo no demuestra por sí solo que todos los SOL gastados provengan exclusivamente de creator fees ni que el disparador de caída haya sido satisfecho correctamente.

### 2. REVCAT creator → tesorería publicada

[Recibo del 12/09, 06:43:46 UTC](https://solscan.io/tx/3SCdnBRgYjwU39HUg5sa5qLVpPBm5hfaucQLcWTNeGKnryu5u8hC4MpRYKx1QkvhELTk3GKdoXetVGCpMe9PMAJf), slot **446.364.225**, RPC finalizado y `meta.err=null`.

El signer `HEjn…CxfSV` transfiere **0,050088555 SOL** por System Program a `Eopp…e9BYZg`, la tesorería que publica la API. El fee de red es 0,000005 SOL; la pérdida neta del signer es 0,050093555 SOL. El aumento de la tesorería coincide exactamente con el importe de la transferencia.

Esto verifica un destino financiero real. **No verifica que ese pago sea exactamente el 20% de un claim**, ni su clasificación interna, porque no se examinó el claim de origen y el recibo de transferencia no contiene ese reparto. Tampoco demuestra ingresos netos o beneficio del operador.

## Política publicada y control operativo

La [guía del sitio](https://revolvepad.com/) y su [bundle público](https://revolvepad.com/assets/index-C7bHUuST.js) declaran:

- Lanzamientos estándar: **70% compra/quema, 10% payout al launcher y 20% plataforma**, sobre creator fees ya cobradas. El main tiene una excepción: **80% / 0% / 20%**.
- Setup fijo **0,1 SOL**, más fee de red. No se acredita al fondo de buyback. Los costes de ejecución reducen las respectivas asignaciones.
- Disparador: caída ≥50% frente al máximo de una ventana móvil de dos minutos; compras con techo de 0,05 SOL. Sin liberación meramente por tiempo.
- Revolve conserva cifrada la clave del creator y opera el keeper; el launcher no recibe esa clave. Los watchers dependen de datos recientes y del servicio. Revival requiere revisión del operador.
- Si MC<US$10.000 y pasa una hora sin actividad relevante, la política permite retirar el watcher, pagar payouts pendientes y transferir fondos elegibles de buyback y plataforma a tesorería. Revival no devuelve lo transferido.

Estos porcentajes **no son porcentajes de cada trade**. Si una operación produce `F` SOL de creator fees efectivamente cobradas, la asignación estándar de plataforma publicada es `0,20 × F`; no `0,20 × volumen negociado`. El porcentaje de creator fees respecto al trade no se midió aquí.

La custodia está reconocida expresamente por el operador. El recibo de quema está firmado por una cuenta creator ordinaria y llama Pump.fun AMM y Token-2022; no demuestra que un contrato inmutable de Revolve controle el disparador, las asignaciones o el retiro a treasury. Se obtuvo el frontend público y las respuestas API, **no el código del backend/keeper ni una auditoría de sus controles de acceso**. No se encontró un enlace al repositorio de ese backend en las superficies revisadas; no es una afirmación sobre toda Internet.

Hay una **inconsistencia documental concreta**: el changelog 1.0.1 del 12/09 anuncia cooldown de 15 a 2 segundos después de confirmación; la sección de ejecución de la guía todavía dice mínimo 15 segundos. No se midió el intervalo efectivo con esta muestra. Dos segundos tampoco significa capacidad garantizada de una compra cada dos segundos, porque preparación y confirmación se añaden según el propio changelog.

La posibilidad publicada de transferir buyback pendiente a treasury durante el retiro cambia el significado económico de «fondos reservados para comprar». No debe describirse esa reserva como destinada irrevocablemente a quema. La muestra no contiene un retiro ni prueba un abuso de esa política.

## Estado del servicio y límites del main

A las **06:40:33 UTC**, Explore devolvía 11 lanzamientos públicos, todos con watcher activo. Main y REVCAT figuraban `graduated`:

| Token | `buybackPoolLamports`, convertido a SOL | `buybackInFlightLamports` |
| --- | ---: | ---: |
| Main REVOLVE | **38,118838324 SOL** | 0 |
| REVCAT | **10,033912246 SOL** | 0 |

Son saldos contables **reportados por el backend**, no balances onchain independientes ni importe total quemado. Que `inFlight=0` en una captura no implica que nunca ejecute: la compra de REVCAT verificada ocurrió un minuto después. No se auditó una compra/quema del main; tampoco se afirma que no exista.

`healthz` reportaba `running=true`, `executionEnabled=true`, main watcher attached, 11 watchers y cero alarms. Es telemetría propia. Los campos `revision=audit-remediation-20260912` y `archiveVerified=true` no constituyen evidencia de una auditoría externa. [Estado público](https://revolvepad.com/healthz).

## Qué cambia la decisión

El espacio de launchpad que recicla creator fees en compras y quema ya tiene una implementación operativa observable. Una propuesta idéntica no puede presentarse como un mecanismo aún inexistente. Su narrativa mezcla uso del producto, reducción de supply y soporte de precio; sólo se verificó aquí la ejecución puntual de las dos primeras operaciones técnicas, no soporte durable de precio o demanda orgánica.

La evidencia decisiva que todavía falta es una conciliación pública claim → asignación → compras/quemas → pagos, junto con una política vigente consistente y controles sobre claves y retiros. Eso permitiría medir el servicio que el launcher realmente compra, en lugar de inferirlo por el precio de REVOLVE. Es una brecha de evidencia identificada, no una oportunidad comercial ya validada.

## Archivos y cobertura

- `home.html`, `home-meta.json`, `app.js`, `app-meta.json`: respuestas GET del sitio, URLs y UTC. `frontend-text.txt` es extracción auxiliar de literales; no reemplaza el bundle completo.
- `links.json`, `health.json`, `launches.json`: tres GET a endpoints efectivamente usados por el frontend público. No se consultó la sección autenticada ni se pidió challenge/login.
- `revcat-burn-rpc.json`, `revcat-treasury-rpc.json`: dos recibos completos, requests/responses y UTC. Fueron HTTP POST con método RPC **getTransaction**, que [sólo consulta un recibo](https://solana.com/docs/rpc/http/gettransaction); no `sendTransaction` ni simulación o firma.
- `verify-receipts.mjs`, `receipt-check.json`: cálculo offline de cantidades, decimales, mismo signer, orden de instrucciones y cambios de balance; **errors=[]**. Incluye SHA-256 del bundle guardado.
- Explorer inspeccionado en pestañas propias. El GET de HTML a Solscan dio 403; no se insistió ni se sorteó el bloqueo. Los recibos raw se obtuvieron por el [RPC público documentado por Solana](https://solana.com/docs/references/clusters), una superficie independiente de lectura.

No se reconstruyó el ledger completo, no se sumó volumen como entrada neta, no se atribuyeron cuentas a personas y no se extrapoló una muestra de dos transacciones a funcionamiento permanente.
