# Circuito implementado — Vault local

14/9/2026. Todo el producto está en inglés. Este documento describe código ejecutable local, sin inferencias pagas ni fondos activados.

Actualización: [roster congelado, Privy, sesiones y cuotas persistentes](LAUNCH-HANDOFF.md), [órdenes de preparación](PAYMENTS-IMPLEMENTATION.md) y [operación](OPERATIONS.md). La tabla siguiente conserva el detalle del circuito local; el modo público preparado tiene identidad separada y el sandbox deshabilitado.

## Qué funciona y qué representa

| Componente | Implementado | Límite actual |
|---|---|---|
| Chat y custodio | Selector, prompt/configuración públicos, historial, recibos, respuestas paginadas, voz local opcional, meme exportable | API key ausente; no se midió la personalidad de un modelo real |
| Perfiles | Cuatro candidatos con rutas solicitadas, parámetros y reasoning explícitos | Soporte anunciado por GET; no atestación ni revisión inmutable de pesos |
| Evaluación | Matriz reproducible y modo seco; presupuesto dedicado antes de habilitar POST | Sin resultados reales; los mocks no miden dificultad |
| Créditos/tesoro | SQLite, enteros hasta 256 bits, reservas, errores, premio, cola, cierre y payout simulado | TEST no tiene valor; saldo compartido `local-demo`, sin usuarios autenticados |
| Mensaje con TEST | Reserva antes de API, decisión del servicio real, liquidación idempotente y recuperación de recibo | Requiere key; aún no ejecutado con proveedor real |
| Wallet | EIP-6963/EIP-1193, conexión explícita, cambios de cuenta/red y desconexión | No firma/autentica, no vincula la cuenta al saldo TEST y no transfiere |
| Depósito | Órdenes persistentes ligadas a identidad/wallet verificadas y validación de chain/receipt/log/confirmaciones | No hay indexer conectado, acreditación real, token ni destino configurados |
| Economía | Calculadora interactiva y export de supuestos | Proyección hipotética; no mercado, pronóstico ni contabilidad de fondos |
| Auditoría | Export completo y reconstrucción offline de todas las cuentas desde eventos | Verifica consistencia interna de lo suministrado, no integridad frente a una fuente externa |

## Contabilidad

Cada operación ejecuta una transacción SQLite `BEGIN IMMEDIATE`: valida, mueve unidades, comprueba conservación, guarda evento y confirma. Mismo identificador/mismo pedido devuelve el evento previo; un pedido diferente con ese identificador se rechaza. Los importes son strings de enteros y las operaciones usan BigInt, sin redondeo de coma flotante. La calculadora económica es distinta: usa aritmética aproximada de planificación.

Invariante: `custodia = créditos disponibles + créditos reservados + premios + pagos pendientes + operación + reserva siguiente`. Además, el total reservado por jugador coincide con intentos pendientes. Recargas son obligaciones frente al jugador, no ingreso ni premio simultáneo.

Ronda ilustrativa: precio 100 TEST, 70% premio/20% operación/10% siguiente, inmutables después de abrirla. En cantidades con resto se redondean premio y operación por intento; el resto exacto va a siguiente. Un ganador contribuye antes de cerrar. Se reserva todo el premio para su identidad aceptada; los intentos posteriores reservados se devuelven. `payout` es una simulación, no envío de tokens.

Fuentes de premio: seed, sponsor recibido, creator fees recibidos y reasignación de la reserva siguiente. Reasignar reserva no es otro ingreso externo. No hay una función para gastar obligaciones de jugadores en operación. No se usa el estimado de Long como saldo.

## Intentos de modelo vinculados a TEST

El servidor conserva un trabajo con ID y hash de mensaje/modelo/sesión/ronda, separado del ledger. El navegador retiene el ID pendiente en sessionStorage; no guarda claves. Desactivar TEST permite práctica normal y no elimina un trabajo pendiente anterior.

1. Comprobar entrada y presencia de API key. Reservar y comenzar solamente el primer intento de la cola.
2. Consultar el servicio del guardián. Su validador determina `locked`, `released` o error; no hay un juez adicional en tesorería.
3. Persistir la respuesta como `inferred` antes de liquidar el ledger. Completar el trabajo como `done` después de liquidar.
4. Reintentar la misma clave recupera el resultado, sin nueva inferencia ni consumo. El endpoint de reconciliación recibe solamente la clave; no acepta ganador, decisión o monto elegidos por el cliente.

| Interrupción | Comportamiento |
|---|---|
| Error conocido antes de inferencia | No cobrar; si ya había reserva, devolverla |
| Error de proveedor con recibo de error guardado | Devolver 100 TEST; costo de proveedor puede existir |
| Respuesta confirmada pero perdida por el navegador | Recuperar recibo/contabilidad guardados; no consultar de nuevo |
| Respuesta guardada como `inferred`, liquidación interrumpida | Reconciliar la liquidación idempotente; no repetir inferencia |
| Proceso cae en `accepted` o `processing`, o error sin recibo confirmado | Mantener pendiente; no hay recuperación automática que invente un resultado |
| Ronda ganada con intentos aún reservados | Devolver reservas no procesadas, mantener premio pendiente del ganador |

Las dos bases SQLite y el archivo JSONL **no son una transacción distribuida**. El orden de escrituras permite recuperar los estados descritos, pero una interrupción antes de persistir la respuesta puede dejar incertidumbre. No se resuelve fabricando un recibo o repitiendo API. Los trabajos desconocidos requieren inspección offline; el prototipo no implementa una prueba externa para resolverlos.

Los controles de simulación bloquean IDs `model-*`. Esto impide elegir un resultado desde la UI normal; el dueño del servidor todavía controla código y bases. No es una garantía contra el operador.

## Datos y ejecución

Desde `vault-lab`, `npm start`. Node 22.16 probado, `node:sqlite` experimental en ese runtime, sin paquetes adicionales. Solo escucha en 127.0.0.1, puerto 4319. El servicio rechaza otros hosts/orígenes y limita JSON; esos controles no sustituyen autenticación para despliegue público.

- `.local/economy-sandbox.sqlite`: saldos, rondas, intentos y eventos TEST. Conserva datos al reiniciar.
- `.local/model-jobs.sqlite`: solicitudes y resultados de intentos con TEST, incluidos sus prompts.
- `.local/attempts.jsonl`: recibos de inferencia, cuando haya inferencias. Incluyen entradas y salidas; no guardar secretos en los mensajes.
- `.local/evaluations/<id>/`: manifiesto, catálogo, recibos, resultados y resumen de cada evaluación explícita.
- Las sesiones de conversación del servicio siguen en memoria; expiran y se pierden al reiniciar. Recuperar un recibo no restaura su sesión; la UI pide iniciar otra conversación.
- `.env` y `.local` están ignorados por Git. No imprimir ni exportar keys. El servidor no toma credenciales de otros proyectos.

Para respaldar la demo, detener primero su proceso y copiar las bases junto con cualquier archivo WAL/SHM restante y los JSONL, conservando permisos. No copiar solamente el archivo principal de una base WAL mientras escribe. No hay operación de borrado/migración de datos reales en esta entrega; una versión de schema desconocida se rechaza.

## Endpoints locales

GET `/api/status`, `/api/rules`, `/api/models`: estado, reglas y catálogo. POST `/api/attempt`: práctica normal. GET `/api/sandbox/treasury` y `/api/sandbox/export`: estado reciente/export completo. POST `/api/sandbox/action`: controles manuales explícitos de simulación. POST `/api/sandbox/model-attempt`: simulación de créditos con decisión del guardián. GET a esa ruta con `?key=`: lectura del resultado, sin inferir. POST `/api/sandbox/reconcile-model`: terminar/releer un trabajo existente sin nueva inferencia.

`/economics.html` es una herramienta de planificación aparte; cambiar supuestos no cambia precio, reglas o saldos del juego.

## Verificar un export

Descargar `Export ledger` desde Wallet and treasury. Ejecutar:

```powershell
node audit/verify-ledger.mjs 'C:\ruta\vault-simulated-ledger.json'
```

No usa red. Comprueba secuencia/IDs, hashes de pedidos, resultados de cada operación y estado final reconstruido. Devuelve SHA-256 del archivo exacto y su alcance. Límite del laboratorio: 64 MiB y 10.000 eventos. Un export internamente consistente que el operador haya reescrito por completo también puede pasar; no se afirma otra cosa.
