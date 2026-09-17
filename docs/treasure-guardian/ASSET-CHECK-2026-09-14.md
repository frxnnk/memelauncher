# Activo asociado: comprobación actual

14/09/2026. Se hicieron consultas públicas y lecturas RPC, sin wallet, firma, swap o lanzamiento. Esta revisión actualiza la disponibilidad de NVIDIA; no elige el token del juego.

**Actualización 22:30 UTC:** el navegador pudo cargar el catálogo y una ficha de Long que presenta AI/NVDA y un Community Vault. El formulario de creación siguió detenido en Preparing. Hay evidencia nueva de un par existente, pero no una creación simulada o PoolKey confirmado. [Consulta actual y efectos sobre fees](LONG-LAUNCH-CHECK-2026-09-14.md). El apartado de acceso más abajo conserva el resultado anterior de esta misma fecha.

## Resultado

El registro oficial devolvió estos activos activos en Robinhood Chain, chain ID **4663**:

| Subyacente | Token del registro RHJ | Dirección en 4663 | Decimales |
|---|---|---|---|
| NVIDIA | NVIDIA • Robinhood Token / NVDA | `0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC` | 18 |
| Microsoft | Microsoft • Robinhood Token / MSFT | `0xe93237C50D904957Cf27E7B1133b510C669c2e74` | 18 |
| Alphabet Class A | Alphabet Class A • Robinhood Token / GOOGL | `0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3` | 18 |

Fuente primaria consultada: [registro RHJ](https://api.robinhood.com/rhj/assets), con [esquema oficial](https://docs.robinhood.com/chain/stock-token-apis/). [Respuesta preservada](../../vault-lab/output/asset-research/rhj-assets.json), [candidatos, timestamps y hash](../../vault-lab/output/asset-research/candidates.json).

Para NVDA, el RPC público de Robinhood devolvió `eth_chainId = 0x1237`, `decimals() = 18` y bytecode no vacío en esa dirección. Se guardaron las cuatro respuestas, incluida la lectura de head, en [evidencia RPC](../../vault-lab/output/asset-research/nvda-rpc.json). Las consultas usaron `latest` en momentos consecutivos; no se presentan como una auditoría atómica a un mismo bloque. Código presente no demuestra permisos, liquidez, seguridad de implementación o compatibilidad con Long.

## Lo que sigue sin verificar

La [página oficial de Long](https://app.long.xyz/) muestra su anuncio de lanzamientos con stock tokens en Robinhood Chain. El GET directo de esta revisión devolvió **403**, y el lector web solo expuso la portada. No se pudo confirmar el catálogo actual del formulario, su factory, el par aceptado para NVDA ni una operación simulada. Los resultados indexados de meses anteriores describían una versión vieja de Long y se descartaron como prueba actual. No se intentó eludir el bloqueo ni cambiar de cuenta o ubicación.

Por lo tanto: **NVIDIA existe como candidato verificable del emisor; su compatibilidad concreta como quote de nuestro lanzamiento en Long sigue pendiente.** Microsoft y Alphabet tampoco se presentan como pares aceptados por Long.

El stock token, el token propio del juego y los créditos internos son objetos distintos. RHJ describe los primeros como valores de deuda con exposición económica al subyacente, sin derechos sobre la acción; emparejar un token nuevo no le otorga respaldo o afiliación empresarial. La documentación también distingue acceso primario autorizado y restricciones de distribución. No se concluyó elegibilidad del operador o usuarios. [Documento del emisor](https://docs.robinhood.com/chain/stock-tokens/).

Los multiplicadores de NVDA y MSFT en el snapshot difieren de 1. No usar el precio bruto de la acción como valor exacto del token ni convertir el cofre con una cotización sin fuente/hora y tratamiento del multiplicador. La elección inicial de pagar intentos y premio en el mismo token del juego sigue separada del quote del pool.

## Siguiente comprobación concreta

Con acceso al formulario de Long: comprobar que acepta la dirección exacta de NVDA en 4663, inspeccionar factory/initializer/hook y beneficiarios, preparar una simulación de creación sin enviar transacción y contrastar fees/claims con los contratos vigentes. Solo entonces decidir si esa ruta sirve para Vault y preparar la operación exacta para aprobación. No se copian direcciones, supply o fees de OCAT, CATGPT o BELLFLY.
