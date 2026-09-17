# Aportes verificados a la reserva del premio

14/09/2026. Implementación local de preparación. No recibe dinero real ni habilita firmas, cobros o pagos.

Una recarga y una donación tienen destinos contables distintos. `preparePrizeFunding` autentica la cuenta y su wallet antes de consultar RPC. La orden fija activo, remitente, destino, monto mínimo, ventana y propósito. El propósito no puede cambiar al reutilizar la clave de la orden. La entrada normal `prepare` sigue creando créditos para jugar y no acepta campos de donación.

| Operación confirmada | Destino | Créditos para el aportante |
|---|---|---|
| Recarga de jugador | Saldo disponible de esa cuenta | Unidades exactas recibidas |
| Aporte `seed` o `sponsor` | Reserva `treasury:next` | Cero |
| Asignación de reserva a una ronda abierta | Premio de esa ronda | Cero; es un movimiento interno |

`seed` y `sponsor` son declaraciones de propósito. No prueban relación con una empresa, autorización publicitaria ni procedencia de fees. Se rechazan declaraciones `creator-fees`: faltan el contrato, la integración y las reglas verificadas de Long. Otro activo tampoco puede sumarse a este ledger sin una conversión explícita y registrada.

La asignación es `{kind: 'prize-reserve', source: 'seed' | 'sponsor', policy: 'prize-reserve-v1'}`. Una transferencia confirmada genera `verified-prize-funding` y aumenta custodia y reserva dentro de la misma transacción SQLite que guarda evidencia, evento y orden. Comparte la deduplicación con las recargas: el mismo evento Transfer no puede financiar ambos destinos. En el almacenamiento histórico, `credited` significa que se registró contablemente; para una donación no significa crédito jugable.

El monitor revisa estas órdenes junto con las recargas. Si desaparece una confirmación ya registrada, conserva la obligación y pausa el gasto y la asignación de reserva. No descuenta automáticamente un saldo ni inventa otra transferencia. Al recuperar la evidencia se puede continuar sin volver a contar el aporte.

`seed-next-round` mueve reserva existente a una ronda abierta con un evento propio e idempotente. No crea fondos ni puede aumentar un premio que ya se ganó. **La elección de cuándo y cuánto asignar todavía pertenece al operador de la preparación**: la regla automática, su publicación y el ejecutor independiente son pendientes de lanzamiento. No se presenta este servicio como la solución al problema de confianza del bounty.

El ledger de activo sube a esquema **6**. Conserva órdenes anteriores sin inventarles una asignación; un motor anterior debe rechazar el archivo para evitar tratar nuevas donaciones como recargas. No bajar manualmente la versión de la base.

## Evidencia

Cinco pruebas específicas y una HTTP verifican autenticación previa a RPC, propósito inmutable, duplicación entre donación/recarga, confirmaciones, reinicio, monitor, escritura fallida con rollback, evidencia alterada, bloqueo, asignación y premio posterior. El historial privado muestra `purpose`, monto aportado y cero créditos. La etiqueta del panel se actualizó; la QA de navegador anterior no cubre todavía estos textos nuevos.

Desde `vault-lab`:

```text
npm run drill:funding
node audit/verify-asset-ledger.mjs --report output/prize-funding-drill.json
```

El [ensayo guardado](../../vault-lab/output/prize-funding-drill.json), ejecutado a las 22:43:15 UTC, registra 5.000 unidades base ficticias de sponsor y 1.000 de jugador. Tras reiniciar y recuperar evidencia ausente, asigna 5.000 a la ronda. Una respuesta simulada ganadora aporta 70 y registra 5.070 pagaderas; quedan 900 disponibles, 20 de operación y 10 en reserva. Son los porcentajes ilustrativos del fixture, no tokenomics aprobadas. Las obligaciones suman las 6.000 unidades iniciales. El sponsor conserva cero créditos y no se transfiere el premio.

Siete eventos, dos depósitos y cuatro observaciones reproducidos offline; 18 consultas RPC interceptadas y una respuesta de modelo simulada. Cero llamadas externas, firmas, gasto o fondos reales. El replay comprueba coherencia de los registros entregados por el operador, no su autenticidad externa ni la ausencia de una historia omitida.

La suite completa pasó **191 pruebas y build**. [Release y hashes](../../vault-lab/output/release-verification.json). El [preflight](../../vault-lab/output/launch-preflight.json) coincide con el código, reconoce Privy y mantiene pagos cerrados. Faltan login real, evaluación real de modelos, activo definitivo, transacción de wallet, integración operada, contrato/autoridad del premio y lanzamiento.
