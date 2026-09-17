# Operación de la primera práctica pública

14/09/2026. Procedimiento preparado; no se desplegó ni se hizo el ensayo externo. La práctica no acepta depósitos o pagos de premios.

## Configuración de Privy a revisar

La app específica **Vault** y su cliente web local ya están creados en modo desarrollo, con email OTP, identity tokens y origen `http://127.0.0.1:4319`. La configuración pública está en `.env`; el servidor la reconoce. [Registro de configuración](PRIVY-SETUP.md). Wallet Ethereum solo por acción explícita; faltan el origen HTTPS real y la revisión de sesión/cookies para producción. No habilitar delegación de transacciones del servidor para esta integración.

Copiar App ID, Client ID y clave **pública** de verificación a `.env`. `PRIVY_VERIFICATION_KEY` acepta saltos de línea escapados como `\n`; el servidor exige una clave pública EC P-256 válida y el SDK verifica las firmas ES256, emisor, audiencia y expiración. No se necesita App Secret para este camino. La identidad firmada debe pertenecer al mismo usuario que el access token.

SDKs fijados: `@privy-io/js-sdk-core@0.75.0`, `@privy-io/node@0.34.0`; esbuild es herramienta de compilación. El cliente carga el bundle solo al iniciar una acción de cuenta. No se usa una dirección suministrada por el navegador como prueba de propiedad. [Receta oficial Core JS](https://docs.privy.io/recipes/core-js), [tokens](https://docs.privy.io/authentication/user-authentication/access-tokens), [identidad](https://docs.privy.io/user-management/users/identity-tokens).

El login real, la entrega de email, la creación de wallet y la CSP contra esa app siguen sin verificar. Brave bloqueó la navegación automatizada a localhost; se pidió completar el login manualmente sin compartir códigos. Las pruebas de interfaz anteriores reemplazan el transporte de Privy; las pruebas de firma usan el SDK real con claves de prueba locales.

## Preparación del host

Una única instancia Node con disco persistente. El código se verificó con Node 22.16.0 y SQLite nativo; antes de desplegar, elegir una versión mantenida compatible y repetir el release check en ese runtime. No usar un filesystem efímero ni varias réplicas sobre copias independientes de estas bases. `.local` contiene sesiones, contabilidad, jobs, uso y recibos.

Desde la carpeta de la app:

```text
npm ci --ignore-scripts
npm run verify:release
npm run preflight
npm start
```

`public-practice` exige en `.env`: IDs/key pública de Privy, `VAULT_PUBLIC_ORIGIN=https://<dominio-confirmado>`, key de OpenRouter dedicada, `VAULT_ACCESS_MODE=public-practice` y límites acordados. Los defaults 25 pedidos/cuenta/día, 250 globales/día y USD 5 son límites de configuración, no permiso de gasto. En local no existe ese control de presupuesto de inferencia.

El arranque público consulta `/api/v1/key` de OpenRouter y requiere límite finito no renovable, saldo positivo y BYOK incluido. El límite no puede superar el presupuesto de la app. No hay POST de inferencia durante el arranque. El contador propio registra costos reportados después de cada respuesta; el límite del proveedor controla el gasto externo. El presupuesto local es acumulado, los pedidos diarios usan UTC y también cuentan rechazos posteriores a reservar capacidad. No hay promesa de un precio exacto por llamada.

Las plantillas en `vault-lab/deploy` usan `/opt/vault`, un usuario de servicio sin privilegios y Caddy delante de loopback. **Son plantillas sin ejecutar**: completar dominio, usuario, rutas, permisos y validar en el host. No incluir `.env`, `.local` ni backups en el deploy público o Git.

El proxy debe conservar el Host público hacia el backend HTTP; el servidor compara Host, Origin y Fetch Metadata. El puerto 4319 queda accesible únicamente al proxy/local. [Comportamiento oficial de reverse_proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy). Con esta plantilla el upstream es HTTP de loopback, sin abrir la app directamente a internet.

## Ensayo antes de publicar

- Comprobar HTTPS, assets, CSP y login real sin depósitos. No anunciar éxito a partir de la mera existencia de IDs en `.env`.
- Sin token de acceso, `/api/attempt` y `/api/usage` deben rechazar. `/api/sandbox/*` debe estar deshabilitado. El login de otra cuenta no puede recuperar una sesión ajena.
- Con una cuenta de prueba y presupuesto aprobado, ejecutar una llamada real, inspeccionar su modelo/ruta/costo/recibo y probar agotamiento de cuota sin solicitudes extra al modelo.
- Ejecutar `npm run drill:concurrency` para verificar la regresión local de ráfagas/desconexión y repetir un ensayo autorizado contra el host HTTPS. El drill no acepta una URL externa y nunca carga datos o claves de `.env`; solo sirve fixtures en un puerto efímero de loopback. [Reporte](../../vault-lab/output/concurrency-drill.json).
- Reiniciar conservando sesiones y uso. Ensayar costo desconocido, recuperación y el restore descrito abajo con datos de prueba aislados.
- Revisar política de privacidad/retención, soporte, condiciones y autoridad operativa antes de una URL pública. El preflight mantiene `launchReady: false` mientras estas evidencias reales faltan.

## Caída, costo incierto y recuperación

El servidor admite una inferencia a la vez. Una reserva `pending` persiste al reiniciar; un costo no reportado queda `unknown`. Ambos bloquean nuevos pedidos. No borrarlos para reabrir el servicio.

Durante una inferencia, los demás intentos reciben `409 ATTEMPT_BUSY` sin reservar consumo nuevo. No hay cola pública ni reintento automático. El ensayo de 86 solicitudes preserva ese comportamiento, pero sus latencias de loopback no permiten estimar usuarios concurrentes de producción. Para ampliar capacidad hay que definir admisión/cola y límites por ronda sin perder orden o multiplicar costo; no arrancar réplicas sobre bases separadas como atajo.

Cerrar el navegador después de enviar no garantiza cancelar la solicitud del proveedor. El servidor termina el intento aceptado, persiste su recibo y contabiliza costo aunque el cliente se haya desconectado. El drill comprobó ese caso sin repetir inferencia. En práctica pública, el usuario puede volver a autenticarse y abrir **Your records** para leer y descargar los recibos indexados de su cuenta. Esa lectura no reanuda la conversación ni envía un nuevo intento.

Cada recibo de práctica pública conserva `usageReservationId`. Si existe exactamente un recibo con costo numérico, el operador puede revisar su referencia y ejecutar localmente:

```text
node --env-file-if-exists=.env scripts/reconcile-usage.mjs <usage-reservation-id>
```

La herramienta usa únicamente el recibo ya guardado y registra la evidencia de conciliación; no llama a modelos, no agrega créditos ni paga premios. Repetir la misma evidencia es idempotente. Si falta el recibo/costo o hay ambigüedad, el proceso sigue detenido: investigar contra el proveedor y preparar una recuperación específica; no asignar costo cero por defecto.

El contador de uso y el JSONL no forman una única transacción. El identificador compartido permite resolver el caso “recibo persistido, liquidación interrumpida”. Si la caída sucede antes de persistir el recibo, no se puede afirmar automáticamente si hubo consumo. El cierre ordenado espera a los pedidos abiertos.

Si falla la escritura de un recibo, el proceso rechaza nuevas inferencias con `RECEIPT_STORAGE_UNAVAILABLE`. Ese rechazo ocurre antes del proveedor; no debe convertirse en costo desconocido ni aporte TEST al cofre. El intento que produjo el fallo de escritura ya puede haber consumido inferencia y mantiene su tratamiento incierto. Revisar disco, permisos y estado de las bases/JSONL; corregir la causa y reiniciar solo después de conservar la evidencia. Reiniciar restablece este bloqueo en memoria, pero no borra las reservas persistentes pendientes/desconocidas. No reiniciar repetidamente para intentar continuar con el almacenamiento averiado.

## Lectura del estado operativo

`GET /api/health` es una lectura pública con `Cache-Control: no-store`, detrás de las mismas comprobaciones de Host/Origin. No requiere una cuenta y no llama a OpenRouter, Privy o wallets. El panel **Transparency** muestra esta lectura al abrirse; no es un monitor continuo ni una atestación independiente.

| Estado | Significado y acción |
|---|---|
| `setup-required` | Falta la API key; completar configuración antes del ensayo autorizado. |
| `requests-enabled` | Los controles globales locales permiten intentar una solicitud. No comprueba disponibilidad del proveedor, cuota individual, dificultad o fondos. |
| `busy` | Hay una inferencia o reserva en curso; no lanzar una solicitud adicional. |
| `reconciliation-required` | Costo desconocido o reserva pendiente de más de 55 segundos con el timeout actual de 45 segundos. Revisar evidencia; no repetir inferencia. |
| `budget-exhausted` / `daily-limit` | Presupuesto acumulado o límite global diario alcanzado. La ventana diaria usa UTC. |
| `storage-failure` / `storage-unavailable` | Falló un guardado de recibo o no se pudo leer el estado almacenado. Reparar y seguir la recuperación anterior. |

Los dos estados de almacenamiento responden HTTP 503. Los restantes responden HTTP 200, incluso con admisión cerrada: el monitor debe leer `state` y `requestGateOpen`, no solo el código HTTP. Ningún resultado declara un lanzamiento con fondos listo; `paymentsEnabled` permanece falso.

`execution` agrega recibos persistidos, respuestas válidas, errores, aperturas y latencia **desde el inicio del proceso**; se reinicia y no reconstruye métricas históricas. `receiptStore: not-observed` significa que todavía no se observó un guardado, no que se ensayó el disco. `usage`, solo en práctica pública, proviene de SQLite persistente: pedidos diarios globales, costo acumulado reportado, presupuesto y reservas pendientes/desconocidas. No incluye prompts, respuestas, account IDs, session IDs, direcciones o credenciales. La disponibilidad externa queda explícitamente `not-probed`.

## Backup y restore

Para esta primera instancia, detener admisión desde el proxy, esperar la solicitud en curso, detener limpiamente Node y confirmar que no queda escritor. Copiar **toda** `.local` (incluidos posibles WAL/SHM y JSONL) más el informe de versión a un destino privado con acceso restringido. Nunca copiar solo el archivo principal de una SQLite activa: WAL puede contener cambios comprometidos. [SQLite WAL](https://www.sqlite.org/wal.html), [backup consistente de SQLite](https://www.sqlite.org/backup.html).

Restaurar en una carpeta aislada con la misma versión y con API key ausente, nunca sobre la instancia activa. Comprobar `PRAGMA integrity_check`, `foreign_key_check`, replay del ledger exportado y correspondencia entre jobs, recibos y uso pendiente. Probar lectura de sesión del dueño y rechazo de otro usuario. Solo después planear una sustitución del directorio activo. El RPO/RTO y el destino de backup siguen por elegir; no se verificó un restore en un host de producción.

Ensayo local automatizado: `npm run drill:restore`. Crea solo datos ficticios en un directorio temporal, cierra todos sus escritores, copia la instantánea y restaura las cuatro bases más JSONL. Verifica integridad, claves foráneas, balances, jobs, aislamiento de sesiones, bloqueo de uso pendiente y recuperación con recibo existente. Un replay no vuelve a inferir ni cobrar. Devuelve [evidencia](../../vault-lab/output/restore-drill.json) y elimina únicamente su carpeta temporal verificada. No acepta rutas de bases reales ni toca `.local`; no es un servicio de backups de producción.

## Datos y observabilidad

El índice de recibos vive en `vault_receipts`, dentro de `sessions.sqlite`; conserva propietario e información del recibo redactada con el mismo filtro del JSONL. `GET /api/receipts` devuelve hasta 20 resúmenes y un cursor de esa cuenta; `GET /api/receipts/<id>` devuelve el registro completo. Ambas rutas exigen autenticación y solo existen en práctica pública. No hay parámetros de propietario ni búsqueda global. La interfaz cancela lecturas pendientes y retira datos privados al cerrar el diálogo o cambiar de cuenta.

No se importan automáticamente logs históricos sin vínculo de propietario. Primero se escribe JSONL y luego el índice SQLite; si falla alguna escritura se bloquea la inferencia y se conserva el tratamiento incierto del intento. Puede existir un recibo en JSONL que no aparezca en el historial: investigar y conciliar, sin repetir la llamada ni atribuirlo a una cuenta desde datos del navegador. El backup debe incluir ambos archivos y las bases de uso/jobs. El drill de restore comprueba la recuperación del historial y el rechazo de otro usuario.

La app guarda prompts, respuestas, herramientas y uso en recibos privados del servidor. Las sesiones incluyen un identificador seudónimo de cuenta. Privy procesa el login; OpenRouter/proveedor procesa el texto de cada intento. No solicitar secretos en prompts ni publicar conversaciones privadas en transparencia por defecto.

Las sesiones vencen por inactividad tras una hora y se purgan al siguiente intento. **Los recibos, tanto JSONL como índice SQLite, no se borran automáticamente**: falta acordar y aplicar retención, solicitud de borrado y tratamiento de backups. Expirar una sesión o cerrar sesión de Privy no elimina los recibos guardados. Logs del proxy deben omitir Authorization, identity tokens, bodies y query strings sensibles. `output` puede incluir evidencia de desarrollo; `.local` nunca es una ruta estática.

Monitorizar `/api/health` con la semántica anterior, errores de autenticación, 429 y espacio de disco del host. No hay un servicio externo de alertas configurado. Los reportes no deben incluir tokens ni prompts. Ante resultado incierto: pausar y conciliar; ante cambio de configuración: abrir una nueva ronda, conservar evidencia anterior. El contrato con fondos y sus procedimientos requieren una revisión separada.

## Servicios de créditos por cuenta: preparación, no habilitación pública

Los aportes `seed`/`sponsor` usan ahora el circuito autenticado y RPC, con destino a reserva y cero créditos para el aportante. La asignación de reserva a ronda abierta requiere un movimiento explícito; no modifica premios ya ganados. El esquema de activo vigente es 6: no reabrir con un motor anterior ni bajar la versión manualmente. [Procedimiento y límites](PRIZE-FUNDING.md). No reconoce automáticamente fees de Long ni publica publicidad de sponsors.
El arranque normal no instancia `createAssetEconomy` ni expone las operaciones de `createAuthenticatedCreditGame`. El HTTP ya admite una composición opcional `creditHistory` de solo lectura: resumen privado y depósitos. Sin ella responde 503 `CREDITS_NOT_CONFIGURED`; el panel Your credits lo explica sin mostrar ceros inventados. Las rutas rechazan escrituras y no consultan RPC. Para habilitar recargas/juego con fondos hacen falta activo y finalidad, app Privy y proveedor reales, UX de transacción, reglas económicas adoptadas y autoridad verificable del premio.

Para una futura instancia, respaldar juntos el ledger, manifiestos, jobs, uso, sesiones y recibos. `ledger_identity` y `model_job_ledger` impiden mezclar accidentalmente jobs de otra base aunque el token coincida. Conservar estos registros al restaurar; no recrear una base vacía para anexar jobs anteriores. Esa identidad de archivo se copia con el backup: **no prueba instancia única, no impide clonar al operador ni sustituye la atestación y control de repetición** de `PRIZE-AUTHORITY.md`.

El ledger de activo usa esquema 5: conserva `attempt_recipients`, exige respetar los hashes guardados antes del receipt y comparte la concesión del monitor con las escrituras de depósito. Una reserva nueva exige destinatario fijo; migrar datos v2 nunca infiere uno de las wallets actuales de Privy. Los intentos anteriores sin destinatario requieren recuperación explícita y no pueden generar una nueva obligación ganadora. No ejecutar una versión anterior de la app sobre estos datos.

Una respuesta completada puede quedar en estado `inferred` con créditos reservados. Si falló guardar el consumo, localizar su recibo ya persistido, reconciliar ese reservation ID/costo en la base de uso y después reconciliar el job autenticado de su propietario. No volver a llamar al modelo ni cambiar la clave del intento. Un bloqueo de depósito también debe resolverse contra la evidencia original antes de liquidar la respuesta guardada. Un estado `unknown` sin resultado confirmado no se convierte en pérdida o victoria por decisión manual.

La atomicidad de depósitos pertenece a una sola SQLite. La ejecución completa sigue teniendo escrituras separadas en recibos, uso, jobs y ledger; se recupera con estados persistentes e idempotencia, **no es una transacción distribuida atómica**. `npm run drill:accounts` verifica fallo de consumo, reinicio y conciliación con JWT ES256 de prueba y cuatro respuestas interceptadas. [Evidencia](../../vault-lab/output/account-game-drill.json).

Los jobs guardan el prompt, referencia de sesión, cuenta, wallet fijada y resultado del modelo. Sus respuestas y el resumen contable son privados del dueño; su retención también debe incluirse en la política pendiente. El panel actual de recibos de práctica no agrega automáticamente la contabilidad de estos jobs. No publicar exports de operador con asociaciones de cuentas y wallets.

## Recuperación y auditoría de depósitos

`createAuthenticatedDeposits` permite consultar órdenes privadas y revalidar el hash ya guardado. Leer/listar no consulta RPC ni pide otra transferencia. Conservar `submittedTransactionHash`, `submittedAt`, `transactionHash`, `logIndex` y `attachedAt`: una confirmación tardía es recuperable si el hash se recibió antes del vencimiento. Una referencia nueva después de vencer, una sustitución, una transacción fallida o logs ambiguos requieren revisión. No reiniciar la recarga ni inventar créditos. [Flujo preparado y límites](WALLET-FUNDING-FLOW.md).

Para un export completo de `createAssetEconomy.export()`, ejecutar desde `vault-lab`: `npm run audit:asset -- <full-asset-export.json>`. El ensayo existente usa wrapper y requiere `node audit/verify-asset-ledger.mjs --report output/account-game-drill.json`. El verificador reconstruye en una SQLite temporal propia y no modifica el archivo fuente. [Resultado](../../vault-lab/output/asset-ledger-verification.json), [qué demuestra](ASSET-AUDIT.md).

Un historial con observaciones sin `ledger_sequence` o vinculaciones sin tiempos registrados no satisface la auditoría estricta. No completar campos mediante suposiciones ni eliminar registros para lograr un resultado verde. Conservar el original y preparar una conciliación específica contra fuentes externas. `internally-consistent` no prueba custodia, autenticidad del modelo ni independencia del operador.

## Worker de depósitos preparado

Existe `createDepositMonitor`, inactivo hasta `runBatch()`/`start()`, y la composición opcional `depositMonitor` de juego por cuenta. No se instancia en el servidor estándar. Configurar política explícita y detener el worker antes de cerrar el ledger. Las tablas de permiso/cursor están dentro de la misma base de activo: ya no se acepta una ruta separada ni se importa su estado anterior. Un barrido incompleto, viejo o con bloqueos impide nuevas reservas/liquidaciones en la composición monitoreada; una respuesta guardada se concilia cuando la evidencia vuelve a ser válida. No repetir la inferencia. Se verificó exclusión de toma del permiso durante las escrituras de depósito con un proceso competidor; finalidad y operación pública de múltiples procesos siguen pendientes. [Operación y límites](DEPOSIT-MONITOR.md), [ensayo aislado](../../vault-lab/output/deposit-monitor-drill.json).
