# Verificación offline del ledger de activo

Implementado y probado el 14/09/2026. El verificador reconstruye la contabilidad usando los registros suministrados por el operador. No consulta la cadena, Privy o modelos, no firma transacciones y no habilita cobros.

Desde `vault-lab`, sobre un export completo de `createAssetEconomy.export()`:

```text
npm run audit:asset -- <full-asset-export.json>
```

El ensayo reproducible incluye su export dentro de un informe. Ese formato requiere una opción explícita:

```text
node audit/verify-asset-ledger.mjs --report output/account-game-drill.json
```

[Resultado guardado](../../vault-lab/output/asset-ledger-verification.json): 15 eventos, 2 depósitos, 2 observaciones, una ronda y 2000 unidades base sintéticas reconstruidas. El SHA-256 identifica el archivo completo leído. `status: internally-consistent` significa que esos registros concuerdan entre sí; no significa que el dinero exista o que el operador sea independiente.

## Qué comprueba

- Crea una SQLite temporal aislada y ejecuta los movimientos con el motor contable real. Compara eventos, claves, hashes, resultados, saldos, reservas, rondas, obligaciones ganadoras y destinatarios.
- Revalida los recibos RPC suministrados contra cadena, token, dirección receptora, remitente, importe y confirmaciones declaradas. Los resúmenes de depósito no sustituyen la evidencia original.
- Revisa los manifiestos congelados de todas las rondas: activo, tarifa, reparto y 2–3 perfiles de guardianes. No admite un export parcial sin esos manifiestos.
- Reproduce los bloqueos declarados por incertidumbre en su posición contable. Rechaza un gasto registrado mientras el ledger estaba bloqueado.
- Rechaza registros duplicados, faltantes o alterados. Solo acepta archivos regulares de hasta 64 MiB y cantidades acotadas de registros; no modifica el export ni abre bases de producción.

Las observaciones nuevas guardan `ledger_sequence` dentro de la misma transacción SQLite. Las órdenes nuevas guardan `attachedAt` al vincular la transacción. Esto permite reconstruir el orden declarado de los hechos; no autentica el reloj ni prueba cuándo ocurrió un hecho externo.

## Historial anterior

El formato requerido es `deposit-records-v2`. Si una base contiene observaciones antiguas sin posición, la migración conserva `NULL` y su export se identifica como v1. Tampoco inventa `attachedAt` para órdenes anteriores. El verificador estricto rechaza esos historiales incompletos.

No completar los campos a partir de timestamps aproximados ni borrar filas para obtener un resultado verde. Conservar los archivos originales y preparar una reconciliación explícita contra evidencia externa. El verificador TEST sigue en `audit/verify-ledger.mjs`; no intercambiar ambos formatos.

## Qué sigue sin demostrar

No comprueba la cadena actual, autenticidad del RPC o finalidad real; propiedad Privy de la cuenta/wallet; ejecución del modelo, prompt realmente admitido o ausencia de repeticiones ocultas; ni que el operador haya exportado todos los hechos. Una reescritura íntegra y coherente del historial puede pasar. Las comprobaciones detectan inconsistencias en lo entregado, no garantizan ausencia de fraude.

El export contiene vínculos privados de cuentas y wallets. Mantenerlo en almacenamiento privado; no publicarlo como telemetría. Para confianza sobre premios reales sigue pendiente implementar y verificar la autoridad descrita en [PRIZE-AUTHORITY.md](PRIZE-AUTHORITY.md).
