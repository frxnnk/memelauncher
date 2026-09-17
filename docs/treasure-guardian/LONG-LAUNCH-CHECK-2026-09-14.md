# Long: par NVIDIA y Community Vault

Consulta del 14/09/2026, aproximadamente 22:25–22:30 UTC. Lectura del sitio en Brave con la sesión existente; no se conectó una wallet, aceptaron términos, hicieron claims, firmaron transacciones ni creó un token.

## Hallazgo que cambia la evaluación

El [catálogo de Long](https://app.long.xyz/tokens) sí cargó y mostraba tokens asociados a NVDA, MSFT y GOOGL. Esto mejora la evidencia anterior, limitada a la portada y al registro del emisor. No demuestra que el formulario actual permita crear cualquier par nuevo.

La ficha de [Artificial Inu / AI](https://app.long.xyz/tokens/0x2e8c31162b855a2ffa90f6f8634643ad6f111e18) presenta esta configuración:

| Campo publicado en la interfaz | Observación |
|---|---|
| Red | Robinhood Chain; enlace de trading incluye chain ID 4663 |
| Token propio | `0x2e8c31162b855a2ffa90f6f8634643ad6f111e18` |
| Quote declarado | NVDA, dirección abreviada `0xd0601c...9eec` |
| Pool enlazado en Defined | `0xcbdfea90430a30ee4469c9902e120a77e7c7e4711d5643671c1d1957f2f1ce27` |
| Receptor de fees declarado | AI Community Vault: `0xd14D2eEb9648f53fA153A218eeEd908789C28630` |
| Modalidad indicada | Community mode |
| Supply mostrado | 1.000.000.000 AI; no es una política elegida para Vault |

El contrato NVDA identificado previamente en el registro RHJ coincide en los extremos visibles. El botón de copiar no entregó una dirección completa legible en esta sesión; por ello **no se declara comprobada la igualdad completa desde la ficha ni el PoolKey por RPC**. La dirección del emisor, su bytecode y sus decimales conservan la evidencia separada de [ASSET-CHECK](ASSET-CHECK-2026-09-14.md).

La ficha describe un ciclo de fees que cualquiera puede iniciar: recoge fees, quema la parte AI y envía el resto a tesorería comunitaria y creador. El botón estaba deshabilitado mientras indicaba conexión pendiente; no se ejecutó ni simuló. No se mostraron porcentajes o permisos completos. Los holdings del vault incluían NVDA y otros stock tokens, pero esta revisión no contrastó sus saldos con RPC.

Los contadores de valor/fees variaron durante la lectura. No se preservan como ingresos realizados, estimación de retorno ni presupuesto disponible para nuestro juego. Los [términos actuales de Long, sección 8](https://app.long.xyz/terms) mantienen la distinción entre montos estimados y un claim efectivamente ejecutado.

## Consecuencia para nuestro treasury

**Community Vault de Long no equivale al bounty del juego.** Según la ficha, puede quemar el token propio y acumular stock tokens. Nuestro diseño necesita conservar el activo del premio, registrar obligaciones por usuario/ronda y pagar únicamente con la autoridad verificada de una apertura. Esas funciones no están demostradas en aquel contrato.

Propuesta provisional: mantener el bounty separado del mecanismo de fees. Reconocer como ingresos únicamente transferencias confirmadas al receptor autorizado; publicar activo, cantidad, transacción y destino. Si el mecanismo quema la parte del token del juego o entrega otro activo, no contarlo como recarga automática del bounty. Conversión o asignación requieren reglas y transacciones específicas. No elegir Community mode solo por el nombre.

Para fijar esta ruta faltan: parámetros de creación y modo disponible, factory/initializer/hook exactos, PoolKey, destinatarios/shares, autoridad para cambiarlos, función que cobra, activos que entrega y capacidad real del receptor. El ejemplo CATGPT auditado el 12/9 sigue siendo histórico y no fija las reglas del Community Vault observado hoy.

## Formulario y siguiente acción

`/create` permaneció en **Preparing...** después de una recarga. La consola mostró un conflicto de extensiones al definir `ethereum` y errores de analytics; eso no prueba la causa de la carga detenida. Se conservaron las protecciones y extensiones del usuario. No hubo un formulario revisable, cotización de creación o transacción preparada.

Siguiente paso externo concreto: obtener un formulario de creación operativo, leer el selector de quote y las opciones de fees, y preparar una simulación con el activo/ticker elegido antes de cualquier firma. Hoy se puede afirmar que Long **presenta un par existente con NVDA**; todavía no que Vault esté listo para lanzarse con él.

## Implicación para la identidad

El catálogo también mostraba **CLIPPY asociado a MSFT**. Es una señal de colisión comercial dentro de la misma plataforma, no una evaluación de marcas registradas. Mantener un personaje propio y el nombre provisional Vault; la idea de una mascota expresiva no requiere adoptar CLIPPY como ticker. No se verificó disponibilidad de VAULT ni se reservó ningún nombre.
