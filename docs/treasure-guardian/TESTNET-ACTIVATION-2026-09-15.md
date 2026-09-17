# Robinhood testnet: activación de recargas web

Estado de activación histórico. El circuito se completó a las 06:43 UTC y se actualizó el servidor a las 06:48 UTC. Estado operativo vigente: `vault-lab/deploy/LIVE-BETA.md` y `vault-lab/output/live-circuit-20260915.json`. La incidencia y pendientes narrados abajo se conservan como historia de la primera activación.

## Activo en producción

- Web: https://vault-closed-beta.vercel.app/play, frontend `dpl_GGUhXd2ZWNQxfJMr8y8zamLTUnch` (verificado 06:13 UTC; backend sin cambios).
- Backend: `C:\vault-beta\releases\1c1d381b940f`, servicio Windows `vault-beta` en ferced-vps.
- Dos wallets vinculadas a la misma cuenta Privy y verificadas por el servidor: pagadora `0x686c6cd47d0a09b5b77fff3f76e2786425dc2f79`; tesorería `0xbec4fdb33ed39844956d9078fd232aca92d7396d`.
- Token: AMZN del faucet oficial de Robinhood Chain Testnet, chain 46630, contrato `0x5884ad2f920c162cfbbacc88c9c51aa75ec09e02`, 18 decimales. Sin valor monetario; no implica elección del stock de lanzamiento.
- Configuración privada: `C:\vault-beta\shared\robinhood-funding.json`. Datos separados: `C:\vault-beta\shared\data\web-funding-testnet`.
- Recarga máxima 1 token; precio de ensayo 0,1; reparto ilustrativo 70% bounty, 20% operaciones, 10% próxima ronda. No son términos comerciales aprobados.
- Rondas independientes `rh-test-amzn-gemini-v1` y `rh-test-amzn-haiku-v1`.
- `/api/funding/config`: enabled true, realFundsEnabled false, payoutsEnabled false. `/api/funding/account`: 401 sin autenticación.
- La pausa de beta bloquea nuevas órdenes e intentos financiados. Permite recuperar depósitos ya enviados y consultar saldos.

## Evidencia

- `vault-lab/output/robinhood-recipient-preflight.json`: eth_call de transferencia de 0,1 token desde pagadora a tesorería, exitoso, sin broadcast.
- `vault-lab/output/backend-funding-upgrade-2026-09-15.json`: nuevo código, copia verificada de ocho archivos y cinco bases SQLite, sesiones y consumo preservados.
- `vault-lab/output/robinhood-testnet-activation.json`: configuración activada y arranque correcto.
- `vault-lab/output/robinhood-funding-live.json`: verificación HTTP pública y gates.
- El backend desplegado pasó 233 pruebas y build. `vault-lab/output/release-verification.json` ahora corresponde a 236 pruebas y build con la posterior corrección de recuperación de Phantom en el frontend. No inferencia de pago durante esas pruebas.
- Paquete de backend `vault-beta-1c1d381b940f-d85ba3a6.tar.gz`; SHA-256 `d85ba3a6d9c057cdf44a92d0114a31e2246cd16615f7888932d6e12414180884`.
- Backup detenido de datos antes del nuevo código: `C:\vault-beta\shared\backups\data-before-1c1d381b940f-20260915080256`.
- Copia privada de configuración previa a activar testnet: `C:\vault-beta\shared\backups\env-before-testnet-20260915080353`. Contiene secretos; no publicar ni imprimir.

## Por completar

Primera recarga confirmada: la orden `47777acc-dc07-404b-8a40-79125b548bcb` quedó acreditada por 0,1 AMZN. Transferencia `0x2df3f5c1c1b97c0e89011daaa436bb4fa165056dd5bcda3a98f42423eaa2ba31`, bloque 119764303. RPC a las 06:25:52 UTC: pagador 4,9 AMZN, tesorería 0,1 AMZN, nonce confirmado y pendiente 1. UI autenticada: `0.1 available`, `0 reserved`. La orden anterior `2400ad59-77fa-4058-9a3e-0fbb3c2bdfe7` venció sin transferencia tras fallar el cambio de red de Phantom.

Primera prueba con créditos: Gemini devolvió `finishReason: error`, sin herramientas ni uso/costo informado; recibo `888bd9f6-73c0-47f1-a702-ac8775a5041c`, reserva `ec8dc194-a7dc-4d53-9b86-ba24bff3df53`, generación `gen-1789453574-ChOA6kqN6GePkm0ApvuE`. La UI confirmó devolución íntegra de 0,1 y cero contribución al bounty. La siguiente prueba con Haiku fue rechazada ANTES de enviarse al modelo por `USAGE_UNRECONCILED`. Nuevas inferencias están bloqueadas por costo desconocido. La consulta autenticada de esa generación a OpenRouter respondió 404: no se puede inferir un costo cero ni resolver la reserva sin evidencia adicional. No se volvió a enviar Gemini.

El frontend distingue los fallos anteriores a `eth_sendTransaction` de una respuesta perdida después de enviarlo. La recuperación sin hash requiere confirmación explícita de que no se firmó y no quedan solicitudes pendientes; la ausencia de una transferencia en el explorador, por sí sola, no permite reintentar.

Vinculación, transferencia on-chain, acreditación y devolución de créditos ante error están comprobadas. Falta reconciliar el costo de la generación fallida con evidencia del proveedor y ejecutar un intento válido usando el saldo reintegrado. Un keep_locked debe consumir 0,1 y aportar 0,07 al bounty de ese modelo; ese camino aún no se completó en vivo. No hace falta otra recarga para esta prueba.

Los premios se contabilizan como payable; no hay payout automático. Telegram y dinero real continúan deshabilitados. El emisor del token puede modificar su implementación, pausar o bloquear cuentas. El estado de testnet y el registro del operador no son una atestación independiente.

Para desactivar admisiones nuevas usar el comando beta pause sobre la base compartida. El antiguo upgrade-windows-beta.ps1 rechaza funding activo: no usarlo ciegamente en la próxima actualización. Antes de una actualización con funding, drenar inferencias, detener el monitor con el servicio y respaldar también las bases bajo web-funding-testnet; conservar siempre el ledger y las órdenes pendientes.
