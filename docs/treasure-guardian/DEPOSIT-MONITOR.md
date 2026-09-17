# Revisión periódica de depósitos

14/09/2026. Implementación local preparada, con doce pruebas y un ensayo reproducible. El servidor normal no instancia este worker ni admite depósitos reales.

`createDepositMonitor` recibe el ledger de activo, el lector RPC y una política explícita: tamaño de lote (1–50), intervalo (1–60 segundos) y antigüedad máxima (30 segundos–1 hora). No consulta nada al construirse: requiere `runBatch()` o `start()`. Los valores del ensayo son ficticios y no fijan la finalidad del token elegido.

Cada barrido captura el último identificador de orden existente y recorre solo órdenes con una referencia de transacción registrada. Agregar órdenes no prolonga indefinidamente ese barrido; se revisan en el siguiente. Las órdenes sin un hash quedan fuera. También revisa los aportes creados mediante el [circuito de reserva](PRIZE-FUNDING.md). No descubre depósitos sin orden, movimientos arbitrarios, retiros del treasury ni donaciones externas no registradas.

El worker guarda en la misma SQLite del ledger la identidad, el hash del activo, la política, el cursor y una concesión de trabajo temporal. La concesión evita consultas simultáneas entre workers cooperantes; el cursor sobrevive a un reinicio. Se comprueba el permiso después de recibir RPC y de nuevo dentro de cada `BEGIN IMMEDIATE` de vinculación, acreditación o registro de error. El ensayo verifica una respuesta demorada que perdió su permiso y no puede aplicar su resultado.

La versión inicial guardaba la concesión en otra base; esa frontera se corrigió. Una prueba lanza un proceso Node competidor durante cada guardia transaccional y verifica que SQLite impide tomar la concesión hasta terminar la escritura. Otras tres pruebas simulan perderla justo antes de cada operación: no se aplica el resultado ni se agrega un bloqueo tardío. La serialización de esas escrituras no demuestra resistencia a clonación/rollback o a un operador que modifica datos, ni ejecución única del modelo. La admisión del juego sigue siendo una composición opcional y no se certificó una operación pública con múltiples procesos.

El ledger de activo usa esquema **6**; el esquema 5 introdujo la concesión compartida y el 6 agrega propósitos de aporte que un motor anterior no debe reinterpretar. Conserva los registros de versiones 2–5. El monitor ya no acepta `path`: debe usar `economy.ledger.deposits.monitorStore`, ligado a la conexión contable. No se importa automáticamente una base de monitor antigua ni su afirmación de frescura; al configurar el monitor en un ledger migrado empieza una revisión completa. Conservar los archivos anteriores como evidencia hasta revisar su retención.

Cuenta y worker comparten `inspectDepositFromRpc`: red fija, receipt y bloque canónico, selección de un único evento Transfer compatible y conciliación atómica existente. El worker usa el dueño almacenado de la orden como alcance interno; no representa un nuevo login Privy ni una firma de wallet. No recibe destinatarios o evidencia desde un endpoint público.

## Cuándo se permite gastar

La composición opcional `createAuthenticatedCreditGame({ depositMonitor, ... })` consulta el estado antes de reservar, iniciar o liquidar un resultado válido. Una revisión completa permite continuar solo mientras no existan bloqueos por evidencia y su antigüedad sea aceptable. Un barrido parcial cierra admisión. La edad se cuenta desde el inicio del barrido, para que una revisión lenta no parezca reciente al terminar; un reloj que retrocede tampoco abre el control.

Una transacción pendiente que nunca se acreditó no emite créditos. Si falta la evidencia de un depósito ya acreditado o cae el RPC, se conservan su saldo y reclamo, se registra un bloqueo y se impide gastar hasta recuperar evidencia válida. No se inventa una reversión automática.

Si el modelo ya contestó cuando la revisión caduca, el job conserva la respuesta y los créditos reservados. Después de una revisión válida, `reconcile` liquida ese mismo resultado sin volver a inferir. Las devoluciones por error técnico conservan su tratamiento previo. El servicio de cuenta informa `depositMonitoring` y `spendingPaused`; el panel actual proyecta el bloqueo, pero todavía no muestra el detalle del worker.

El control solo se aplica al inyectar este monitor. Las composiciones de preparación anteriores y TEST mantienen sus límites declarados; ninguna es un lanzamiento financiado. El servidor estándar sigue sin ledger de activo ni worker. No habilitar cobros por agregar este archivo o por obtener `fresh: true`.

## Evidencia y operación pendiente

Ejecutar `npm run drill:monitor` desde `vault-lab`. No acepta URLs, claves o rutas reales. El [reporte](../../vault-lab/output/deposit-monitor-drill.json) registra dos cuentas sintéticas, 30 consultas RPC interceptadas y una respuesta de modelo simulada: barrido en dos lotes, reinicio, respuesta guardada con revisión vencida, recuperación sin nueva inferencia, caída RPC y restauración. El auditor offline reproduce seis eventos, dos depósitos y ocho observaciones; conserva 2000 unidades ficticias.

Doce pruebas cubren política e identidad congeladas, lote acotado, órdenes nuevas, reinicio, duplicados, concesión expirada, RPC caído, evidencia desaparecida, reloj/antigüedad, cierre ordenado y exclusión transaccional con un proceso competidor. No hay llamadas externas, pagos o firma en ese ensayo.

Antes de operar: elegir activo y RPC, criterio real de finalidad, capacidad e intervalo que complete el barrido a tiempo, alertas para barridos incompletos y cierre ordenado del worker antes del ledger. El backup del ledger de activo incluye las tablas del monitor; copiar con la instancia detenida y revisar antigüedad antes de reabrir admisión. El drill de restore histórico de cuatro bases no equivale a un restore de este monitor en un host real. La autenticidad del RPC, el estado vivo de la cadena y la independencia frente al operador siguen sin probarse.
