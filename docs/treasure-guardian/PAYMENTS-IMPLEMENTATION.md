# Depósitos y premio: implementación y límite actual

14/09/2026. El juego no acepta dinero. No hay activo de producción elegido ni contrato desplegado.

## Qué está implementado

`server/economy/deposit-orders.mjs` guarda órdenes de preparación. Recibe una identidad ya verificada por el servidor y un head obtenido por el lector RPC configurado. La operación periódica del indexer sigue pendiente. Nunca toma un `playerId` enviado por el navegador como autenticación.

Cada orden liga cuenta, wallet verificada, monto mínimo en unidades enteras, hash del activo/destino/decimales/política de confirmaciones, bloque mínimo, vencimiento y clave de idempotencia. Una transferencia vinculada no se reemplaza. Cambiar de activo impide reinterpretar órdenes anteriores.

La validación comprueba red, éxito de transacción, bloque canónico, número de confirmaciones y exactamente un log ERC-20 del token, remitente y destinatario esperados. Rechaza transferencias anteriores a la orden; una misma combinación red/token/tx/log no puede satisfacer dos órdenes. Reiniciar no pierde la deduplicación. La forma independiente de órdenes sigue devolviendo `credited: false`; la integración contable de preparación descrita abajo puede registrar créditos locales contra evidencia RPC.

El campo `standardTransferVerified` es una precondición técnica declarada para este validador, **no prueba de que el token elegido sea estándar ni autorización de cobro**. No cubre tokens rebasing, fee-on-transfer, hooks arbitrarios, permisos de una factory ni finalidad L1. La evidencia suministrada depende del RPC; aún no hay un recolector operando sobre un activo real aprobado.

Actualización: `deposit-rpc.mjs` ya implementa el lector, pendiente de configurar contra la red/activo elegidos. Expone únicamente consultas de head y evidencia de una transacción almacenada. Comprueba la propiedad de la orden antes de consultar, fija el endpoint HTTPS en servidor, rechaza redirects, verifica IDs/envelopes JSON-RPC y limita tiempo/bytes. Pruebas locales cubren red incorrecta, recibo pendiente, bloque reorganizado, JSON inválido, respuestas enormes y timeout. No hay método para firmar, transmitir transacciones o elegir el RPC desde el navegador. Las consultas usan `eth_chainId`, `eth_blockNumber`, `eth_getTransactionReceipt` y `eth_getBlockByNumber`. [API oficial de Ethereum](https://ethereum.org/developers/docs/apis/json-rpc/).

## Circuito a conectar después de elegir el activo

1. El backend autentica al usuario con Privy y verifica su wallet. Una recarga selecciona monto y una cotización versionada; el navegador no fija la tasa de créditos.
2. El indexer lee chain ID/head del RPC configurado y el backend crea la orden. Se muestra destino, activo, unidades, vencimiento y regla de confirmación antes de pedir una transacción.
3. El usuario autoriza la transferencia. El backend recibe solo su referencia; vuelve a obtener receipt y bloque desde su propio RPC. Nunca acredita desde un JSON de receipt enviado por el cliente.
4. Una transacción de base de datos consume una única evidencia de depósito y crea el crédito del propietario. **La unión atómica está implementada en un ledger separado de preparación**, conectado al servicio de juego autenticado y probado con fallos/reinicio. Faltan las rutas y UI de cobro, y un indexer operado sobre el activo elegido; las órdenes no se enchufan al ledger TEST.
5. Se revalida la finalidad conforme a la cadena elegida. Reorg, transferencias tardías, activos incorrectos y diferencias de recepción se registran para recuperación; no se inventa un crédito ni se destruye el reclamo.

Requerido antes de habilitar: token/destino exactos, contrato y permisos inspeccionados, política de finalidad adecuada a la cadena, precios, prueba completa en testnet, tratamiento de transferencias tardías y conciliación contra balances reales. El transporte acotado, su unión contable y el servicio de juego autenticado están implementados; falta exponer las operaciones de recarga/juego con activo en HTTP/UI y operar el indexer aprobado. La lectura de saldos y depósitos ya tiene rutas autenticadas y panel, con estado no configurado en el arranque normal. No hay endpoints HTTP para crear, enviar o reconciliar depósitos.

## Unión atómica y evidencia de preparación

`createLedger({ path, asset })` crea una base separada con denominación, destino y política de confirmación inmutables. No transforma TEST en tokens. El esquema actual de activo es versión 4, con destinatarios fijos por intento y referencias de transferencia irremplazables antes del receipt; rechaza motores anteriores. Una base de preparación v2 conserva sus datos al agregar la tabla de destinatarios: un intento antiguo sin wallet fijada no puede generar un premio pagadero. Las bases TEST permanecen en versión 1. Las órdenes solo se operan a través de `ledger.deposits`, evitando que un módulo independiente consuma evidencia sin contabilizarla.

`createAuthenticatedDeposits` ya une Privy, órdenes, request ERC-20 sin firma, guardado del hash y lectura RPC. Tiene recuperación tras reinicio e historial privado paginado. Selecciona un único evento desde evidencia del servidor; no toma comprobantes del navegador. La proyección de lectura está conectada a HTTP/UI; faltan las operaciones de recarga y la app/activo reales. [Flujo y pruebas](WALLET-FUNDING-FLOW.md).

Al reconciliar una orden, el motor guarda en una sola transacción SQLite: evidencia original de RPC, clave global del depósito, obligación de custodia, saldo disponible de la cuenta autenticada, evento contable y estado acreditado. Un fallo antes del commit revierte todo; repetir una respuesta o reiniciar después del commit devuelve la acreditación anterior. Cuenta la cantidad recibida exacta, incluido un excedente sobre el mínimo, en enteros de hasta 256 bits. Una unidad base recibida equivale a una unidad contable: **no es una cotización en dólares, una tarifa aprobada ni una promesa de valor del token**.

El motor reutiliza las mismas reglas de reservas y reparto existentes. Un error técnico devuelve la reserva, una respuesta válida asigna la tarifa y una apertura genera una obligación de premio para el ganador. En este modo se rechazan los atajos de simulación `topup`, contribuciones manuales, reembolsos externos y `payout`. Un saldo pagadero no se informa como una transferencia ejecutada. El servicio de juego ya usa estos saldos por cuenta; no está conectado a rutas públicas, al cobro visible del chat ni a una wallet real. `realFundsEnabled` sigue siendo `false`.

Si una evidencia ya acreditada desaparece, pierde confirmaciones, cambia de bloque/monto o falla su consulta, se conserva la obligación y se registra un bloqueo persistente. No se admiten nuevas reservas, inicios o repartos mientras quede un depósito en conciliación; cancelar reservas y devolver un error técnico sigue permitido. Volver a verificar exactamente la evidencia original libera el bloqueo. Una transferencia reminada en otro bloque requiere un procedimiento de recuperación aún pendiente; no se reescribe automáticamente. **La detección depende de volver a consultar**: no hay un monitor/indexer periódico activo ni prueba de finalidad L1.

La exportación de operador incluye órdenes, evidencia original, eventos y observaciones de conciliación. Contiene asociaciones privadas entre cuentas y wallets; no se publica como telemetría. Es evidencia declarada por el operador, no una prueba independiente del RPC, de la propiedad Privy, del saldo real de custodia o de la ejecución del modelo. `verify-asset-ledger.mjs` reconstruye el export completo con manifiestos, valida evidencia RPC suministrada y reproduce los bloqueos en sus posiciones contables. Requiere observaciones ancladas v2 y tiempos de vinculación registrados; no inventa datos ausentes en el historial. El verificador `verify-ledger.mjs` sigue limitado a TEST. [Comandos, evidencia y límites del auditor de activo](ASSET-AUDIT.md).

`npm run drill:deposits` produce [un ensayo reproducible](../../vault-lab/output/deposit-drill.json) usando dos cuentas, un RPC sintético, resultados de modelo ficticios y una base temporal propia. Revisa depósitos pendientes/confirmados, replay, aislamiento de dueño, error/reparto, premio pagadero, pérdida de confirmación y restauración del archivo cerrado. La tarifa de 100 unidades base y el reparto 70/20/10 en este ensayo son fixtures, no tokenomics elegidos. Cero llamadas de red, inferencias o firmas reales.

## Juego autenticado con créditos de preparación

`createAssetEconomy` recibe activo y tarifa/reparto explícitos del servidor. Congela esa denominación y sus condiciones junto a los 2–3 guardianes, prompt, herramientas y perfiles. Las configuraciones TEST anteriores conservan su forma original. No se adopta automáticamente la tarifa ficticia del ensayo como precio del token.

`createAuthenticatedCreditGame` verifica los headers con Privy antes de pasar al motor de intentos. No acepta un account ID del navegador. La clave de idempotencia se deriva de cuenta y clave del intento: dos jugadores pueden reutilizar el mismo texto de clave sin compartir resultado, reserva o historial. Consultar saldo, resultado o conciliación vuelve a autenticar y filtra por dueño. Jobs y sesiones se ligan también a una identidad persistente del ledger para impedir importar resultados desde otra base aunque use el mismo token o round ID.

Al admitir un intento, el usuario elige una wallet presente en su identidad verificada. La reserva la guarda en la misma transacción que los créditos; no se puede cambiar con otra llamada o actualizando después las wallets de Privy. Una apertura conserva ese destinatario en la obligación de premio. El modelo sigue sin elegir dirección, monto o transacción. Se reconstruye su decisión con el validador de herramientas y se comprueban prompt, configuración, modelo, scope, mensaje y manifiesto del recibo antes de contabilizar. Una diferencia técnica devuelve créditos y conserva el recibo del error; no es una votación del operador sobre el argumento del jugador.

La práctica y este servicio reutilizan el mismo contador persistente de inferencia. Agotar un límite antes del pedido devuelve los créditos reservados. Si el proveedor ya contestó y falla guardar el costo, se conserva el resultado en el job y se exige conciliar **ese** recibo y propietario antes de liquidarlo. Leer el resultado no reintenta el modelo. Un bloqueo de depósito durante inferencia conserva la respuesta para liquidación posterior; una respuesta desconocida sigue reservada. Los límites de la key del proveedor continúan siendo el control externo de gasto.

`npm run drill:accounts` genera [la evidencia del circuito](../../vault-lab/output/account-game-drill.json): dos identidades JWT ES256 ficticias verificadas por el SDK oficial de Privy, depósitos sintéticos, tres guardianes, cuatro respuestas de proveedor interceptadas, fallo de consumo, reinicio y premio pagadero a la wallet original. Registra 2000 unidades ficticias de custodia y todas sus asignaciones. **No verifica una app Privy real, resistencia de modelos, cobro desde el navegador, fondos, payout ni autoridad independiente**. Los resultados privados de este servicio todavía no tienen una ruta HTTP o una lista paginada enlazada al panel del navegador.

## Un intento y su aporte

La simulación cobra 100 TEST por resultado válido: 70 al cofre, 20 a operación, 10 a la siguiente ronda. También aporta el intento ganador. Un error técnico devuelve créditos; resultado incierto conserva la reserva para conciliación. Esto ya está probado en el ledger y la integración de chat.

Antes de adoptar un reparto real, medir costo por modelo y contexto y definir la conversión a gasto de API/gas. Créditos sin usar, premio comprometido y reserva operativa deben tener cuentas separadas. El volumen del token y fees futuras no son ingresos recibidos. Sponsors y creator fees solo aumentan el cofre tras confirmar su recepción; los compromisos comerciales se muestran aparte.

## Condición de victoria y autoridad

La selección de cualquiera de los guardianes admitidos apunta al mismo cofre. El servidor acepta exactamente una llamada válida `release_prize`; texto, capturas o un “yes” no son instrucciones de pago. Prompt y configuración se congelan antes de abrir una ronda; los ataques son parte del juego y no existe un veto editorial posterior a una apertura válida.

El ejecutor futuro toma destinatario, monto, round ID, attempt ID y orden de admisión de datos aceptados previamente. El LLM solo emite una acción; no elige direcciones, montos, permisos, transferencias ni comandos. La clave de liquidación debe ser única por ronda; si una transacción queda incierta se consulta esa misma referencia antes de reintentar.

Sigue pendiente el punto esencial de confianza: quién puede emitir una autorización de pago y con qué evidencia. Un escrow que paga cualquier firma del fundador protege reglas de monto/idempotencia, pero no demuestra la autenticidad de una decisión del modelo. Un multisig sin verificación independiente tampoco la demuestra. La elección entre operador declarado, verificadores o ejecución atestiguada debe concretarse antes del contrato; no se presentó ninguno como solución ya implementada. [Opciones y garantías](LAUNCH-DECISIONS.md).

Investigación posterior: [prueba concreta de autoridad](PRIZE-AUTHORITY.md), con fuentes inmutables y criterios para ligar firma, destinatario, orden, historial y configuración. Exige ensayar clonación/rollback y repetición de llamadas API; pago único no equivale a inferencia única. La propuesta no incorpora un ejecutor financiado a esta versión.

## Revisión periódica opcional

Se agregó el worker de revisión de órdenes ya registradas, con cursor persistente y límite de antigüedad para el juego por cuenta. Está probado con datos sintéticos y no se ejecuta en el servidor estándar. No observa movimientos arbitrarios del treasury ni reemplaza la definición de finalidad/custodia o el ejecutor de premios. [Monitor, integración y límites](DEPOSIT-MONITOR.md).
