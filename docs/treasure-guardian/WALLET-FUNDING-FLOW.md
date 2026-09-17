# Recarga desde wallet: preparación recuperable

Implementado localmente el 14/09/2026. `createAuthenticatedDeposits` une autenticación, órdenes, lector RPC y contabilidad. Sus operaciones de recarga no están expuestas por HTTP ni conectadas a una wallet real; la lectura privada ya tiene rutas y panel descritos abajo. `paymentsEnabled`, `signingEnabled` y `realFundsEnabled` siguen en `false`.

## Flujo implementado en servicios

1. `prepare(headers, { key, wallet, amountBaseUnits })` verifica Privy y pertenencia de la wallet antes de consultar RPC. Obtiene cadena/head del lector configurado en servidor y congela una orden. Repetir la clave con los mismos datos devuelve la orden existente sin otra consulta; cambiar monto o wallet genera conflicto.
2. La preparación incluye un request ERC-20 sin firma: cadena, remitente, contrato del token, `value: 0` y llamada `transfer` con destino e importe exactos. El monto usa enteros de 256 bits, sin redondeo flotante. No incluye permisos de gasto, nonce, gas estimado, firma ni transmisión. Este formato sigue [ERC-20](https://eips.ethereum.org/EIPS/eip-20) y la [especificación ABI](https://docs.soliditylang.org/en/latest/abi-spec.html). El gas nativo es un costo adicional que todavía debe estimarse en el flujo real.
3. Una vez que la futura wallet devuelva el hash, `submit(headers, orderId, { transactionHash })` lo guarda sin consultar RPC. Ningún otro hash puede reemplazarlo. No acepta receipts, logs, montos, destinatarios ni selección de RPC enviados por el cliente.
4. `check(headers, orderId)` recupera la transacción guardada desde el RPC del servidor. Si todavía no hay receipt, devuelve pendiente. Cuando existe, selecciona un único evento que corresponda al token, remitente y destino; una coincidencia ambigua se rechaza. El validador comprueba el resto de la evidencia y la conciliación atómica acredita una sola vez.
5. `get` y `list` permiten recuperar las órdenes de esa cuenta después de recargar o reiniciar. La lista devuelve 20 por página y un cursor del mismo dueño; no tiene filtro arbitrario de propietario. Cambiar de wallet no cambia las órdenes anteriores ni genera una nueva transferencia sugerida para una wallet que ya no está verificada.

Una orden nueva vence a los 15 minutos. Un hash guardado dentro del plazo puede obtener comprobante/confirmaciones después; un hash nuevo recibido fuera del plazo requiere revisión. Los reenvíos idénticos de una referencia ya guardada no reinician el plazo ni envían fondos. Si se cierra la página **antes de guardar el hash en el servidor**, esa recuperación automática no está garantizada: la futura UI debe preservar la referencia y consultar actividad de wallet antes de sugerir cualquier envío adicional.

Las consultas simultáneas de la misma orden comparten una lectura en curso. Hay como máximo cuatro órdenes en verificación por servicio; la quinta recibe un error de ocupación. Esto no sustituye límites HTTP por cuenta/IP ni una política de polling. La consulta de una orden ajena se rechaza antes del RPC. Si falla la evidencia de un depósito acreditado, el ledger conserva el saldo y bloquea gasto hasta conciliar.

## Evidencia y migración

El [ensayo de cuentas](../../vault-lab/output/account-game-drill.json) prepara dos transferencias ficticias, guarda cada hash, reinicia, recupera un estado pendiente y confirma usando 16 consultas RPC interceptadas. Después recorre tres guardianes, cuatro respuestas simuladas y el reparto de créditos. No ejecuta firmas, inferencias pagas ni llamadas externas.

Ocho pruebas nuevas cubren exactitud del request, inputs ajenos, retries, confirmaciones, recuperación, historial privado, expiración, saturación, recibos inválidos, bloqueos y replay. El [auditor offline](ASSET-AUDIT.md) también valida la consistencia declarada del hash y sus tiempos de envío/vinculación; no prueba que el usuario haya firmado ni que la transacción exista en una cadena real.

El esquema de activo pasa a **4**: una versión anterior no debe ignorar el hash ya enviado e intentar reemplazarlo. La migración conserva órdenes anteriores sin inventar sus tiempos. Las bases TEST siguen en versión 1.

## Integración que falta

Elegir y verificar activo/destino/finalidad y reglas económicas; crear la app Privy; conectar las operaciones de recarga a HTTP/UI; ensayar revisión, gas, firma explícita, rechazo del usuario, hash incierto y recuperación real. También faltan límites de consulta por cuenta, indexación periódica, conciliación de custodia y autoridad verificable de payout. La firma de una transferencia no demuestra que el operador del bounty sea independiente. Los servicios preparados no autorizan ni habilitan un lanzamiento con fondos.

## Lectura privada en HTTP y navegador

Las [contribuciones a reserva](PRIZE-FUNDING.md) reutilizan este circuito con propósito inmutable, distinto de una recarga. El historial incluye `purpose: prize-reserve`, asignación y monto aportado; `amountCreditedBaseUnits` queda en cero. La revisión HTTP nueva cubre esta separación y su privacidad. La QA de navegador citada abajo es anterior a los textos específicos de donaciones.
`createCreditHistory({ game, deposits })` proyecta únicamente registros de la cuenta autenticada. Se puede suministrar al servidor como `creditHistory`; el arranque normal aún no crea un ledger de activo y devuelve `CREDITS_NOT_CONFIGURED` (503), sin inventar saldos cero.

| Ruta GET | Respuesta |
|---|---|
| `/api/credits` | Disponible, reservado, premio pagadero sin transferir, unidad y bloqueo de gasto. No contiene prompts, sesiones ni registros de otras cuentas. |
| `/api/credits/deposits?before=<cursor>` | Hasta 20 órdenes privadas y cursor. No acepta un selector de propietario. |
| `/api/credits/deposits/<id>` | Detalle privado del depósito: monto, activo, remitente/destino y referencia guardada. No entrega calldata ni el export del operador. |

Estas rutas rechazan escrituras y parámetros desconocidos. Usan `Cache-Control: no-store` y las comprobaciones existentes de Host/Origin. Leer no consulta RPC, verifica transacciones, crea órdenes, acredita, llama al modelo o firma. Los montos son contabilidad registrada de preparación, no un balance consultado en cadena.

En Treasury, **Your credits** abre saldo y depósitos, permite paginar y descargar el JSON de una orden. Conserva la precisión decimal, distingue pagadero de pagado y elimina datos anteriores si una lectura falla, se cierra el diálogo o cambia la cuenta. El usuario no recibe un botón de envío desde un registro pendiente.

[QA del panel](../../vault-lab/output/playwright/account-credits-qa.txt): estado real sin configurar; resto de estados con autenticación/API interceptadas; paginación, descarga coincidente, recarga, bloqueo, error, cambio de cuenta y cancelación de respuesta tardía en tres viewports. Cero POST al servidor, inferencias, RPC de depósitos o acciones de wallet. [Captura móvil con datos ficticios](../../vault-lab/output/playwright/account-credits-fixture-mobile.png). Cuatro pruebas HTTP ejercitan identidad real del verificador Privy con tokens de fixture, aislamiento y capacidades cerradas. Esto todavía no prueba el flujo contra una app real o una cadena real.
