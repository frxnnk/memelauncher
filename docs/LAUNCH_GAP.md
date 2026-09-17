# De la mosca al token — estado al 10 de septiembre de 2026

**Es técnicamente viable. El modelo ya genera una señal reproducible; el puente de ejecución real todavía no está construido.** La demo no se convierte en un launcher activando una variable. `requestLive` en `server/adapter.ts` siempre falla, y `server/schema.ts` solo admite ensayos locales con ejecución deshabilitada, emisor sin definir y presupuesto cero.

El experimento no necesita que la mosca comprenda tokens. La causalidad que queremos demostrar es: un modelo identificado, con entradas y regla fijadas antes, produce una señal; un ejecutor separado crea el token solamente si esa señal cumple la regla. Esto exige un registro previo y una transacción comprobable. El sitio, el personaje y una dirección existente no prueban por sí solos esa relación.

## Actualización posterior: Long / GOOGL

El usuario eligió GOOGL como par y autorizó continuar la preparación por Long. Ya existe `integrations/long`, separado del motor neuronal: genera calldata sin firma y registra simulaciones públicas. La prueba diagnóstica llegó al contrato y revirtió con `EnforcedPause()`; `paused()` confirmó la pausa en la fábrica revisada de Long a las 20:40 UTC del 10/09. Falta verificar si el frontend nuevo cambió de fábrica. El precio del oráculo también superaba el límite local de una hora. No hubo simulación exitosa, estimación de gas, firma ni emisión.

Esta actualización reemplaza la prioridad Bankr/NVDA del análisis histórico que sigue. Las corridas antiguas conservan sus términos originales. Ver `integrations/long/README.md` para comandos, parámetros y evidencia completa.

## Qué está hecho y qué falta

| Parte | Estado actual | Trabajo o evidencia que la completa |
|---|---|---|
| Modelo y señal | Hecho localmente | Referencia real, control sin estímulo y desconexión de MN9 reproducidos. Mantener identificados el modelo, entorno, umbral provisional y límites de interpretación. |
| Registro de la corrida | Hecho localmente | Estado persistente, hash, exportación y replay. Para una corrida pública falta compromiso observado externamente y el mecanismo de seed previamente fijado. |
| Emisión programática | Documentada por Bankr; no integrada | Implementar cliente del proveedor con validación estricta, simulación oficial y luego un ejecutor separado. No inventar endpoints ni convertir un fixture en evidencia de aceptación. |
| Cuenta y firmante | No verificados | Identificar wallet Bankr elegible y sus permisos. Su key firma desde la wallet propietaria; el runner Python no recibe la key. Cuenta de X y wallet Bankr no son equivalentes. |
| Token concreto | Propuesto | Fijar nombre/ticker, artefacto de imagen, metadata, red, quote, supply, asignaciones, fees, destinatarios y presupuesto en un nuevo manifiesto. BELLFLY es el nombre de trabajo. |
| NVDA | Identidad registrada previamente; compatibilidad pendiente | Que exista el stock token no confirma que Bankr acepte el par para esta cuenta/corrida ni que exista una salida líquida. Validar la cotización exacta en el preview oficial y después los contratos efectivos. |
| Submit una sola vez | Hecho solo en MOCK local | Resolver idempotencia/reconciliación remota. Persistir identidad del intento y nunca volver a enviar por un timeout ambiguo. Probar el escenario antes de live. |
| Confirmación | No implementada para proveedor real | Comprobar recibo en la chain correcta, contrato emitido, supply/asignaciones/fees/beneficiarios, quote y pool ID; distinguir dirección predicha de dirección confirmada. |
| Ejecución pública | No iniciada | Aprobar el manifiesto y presupuesto antes de arrancar. Publicar evidencias de resultados negativos y fallos también. No seleccionar una corrida favorable después. |

## Camino mínimo recomendado

1. **Terminar la identidad y términos propuestos.** Ya hay una dirección visual de memecoin y una mosca reconocible. El lema es “Tiny brain. Big launch.” El relato público es aspiracional/prelaunch; no dice que el token ya existe. Nombre/ticker e imagen de metadata final siguen pendientes de elección.
2. **Construir la integración de preview Bankr.** Mantener `simulateOnly: true` obligatorio en ese módulo, sin ruta live compartida. Guardar respuesta normalizada, solicitud sin secretos y diferencias con el manifiesto. La documentación de un parámetro no sustituye esta prueba de cuenta real.
3. **Ejecutar ese preview con una cuenta elegible y autorización específica.** Si falla NVDA, decidir explícitamente otro quote permitido o la alternativa de red, y generar un manifiesto nuevo. No cambiar el par en silencio.
4. **Construir y probar el ejecutor + reconciliación + comprobador de recibos.** Separar permisos del runner. La reserva SQLite actual solo resuelve concurrencia local. Un timeout del proveedor no puede convertirse en un segundo deploy.
5. **Preparar una corrida pública única.** Fijar reglas/seed/mecanismo de compromiso, términos y presupuesto; confirmar condiciones de datos/proveedor para el uso real. Aprobar previamente, correr, ejecutar solo si corresponde y verificar/publicar el resultado. Sin un segundo botón humano después de conocer la señal presentado como autonomía.

El siguiente paso de ingeniería es **el preview oficial**, no comprar activos ni conectar una wallet a la página pública. No se necesita un contrato de token propio si el proveedor soporta los términos elegidos.

## Lo que dicen hoy las fuentes oficiales

Relectura pública realizada el 10/09/2026. No se accedió a credenciales ni se invocó el endpoint de deploy.

- Bankr documenta despliegue por API en Robinhood, Base y Arbitrum. La clave de usuario despliega desde su wallet propietaria; la ruta partner es Base-only. La simulación omite la transacción y no reserva cuota. Una wallet retail debe tener al menos 24 horas incluso para simular, pero el preview no exige el saldo mínimo. Para live retail documenta al menos 0,002 ETH nativo en la red elegida. **Es un requisito de saldo, no un precio de lanzamiento ni presupuesto suficiente garantizado.** En Robinhood el operador paga gas. [Deploy oficial](https://docs.bankr.bot/token-launching/api-reference/deploy-token-launch/).
- La oferta estándar documentada es 100.000 millones. Para respetar la propuesta de cero asignación al creador se requiere `disableVesting: true`: el default incluye 15% de vesting. Las comisiones del creador son una cuestión separada de esa asignación. Hay que fijar su beneficiario y explicar las comisiones totales antes del lanzamiento. [Overview oficial](https://docs.bankr.bot/token-launching/overview/).

Estos hechos no prueban elegibilidad de nuestra cuenta, aceptación de NVDA, costes efectivos, respuesta exacta del preview ni idempotencia remota. No hay que pedir un depósito para “desbloquear la mosca”: la parte neuronal ya funciona.

## Qué NO hace falta convertir en un proyecto paralelo

- No hace falta que el modelo elija nombre, cadena, presupuesto o estrategia de trading.
- No hace falta replicar todas las figuras de un paper para presentar honestamente este ensayo de ingeniería. Sí hace falta revisar y fijar la política concreta, conservar controles y no afirmar validación científica más amplia que la realizada.
- No hacen falta datos de mercado, un LLM, microservicios, un contrato ERC-20 propio o una DAO para la primera emisión.
- NVDA es una preferencia del proyecto, no una condición biológica de la simulación. Si agrega demasiada fricción, se puede proponer otro par; requiere una decisión explícita y revalidación.
- El hecho de no planear una venta no determina por sí solo todos los términos del dataset o proveedor. Tampoco justifica presuponer que el ensayo sea comercial. Se revisa el uso concreto antes de hacerlo público; el desarrollo local continúa.

## Decisiones del fundador antes de la corrida real

1. Nombre/ticker e imagen final.
2. Ruta exacta; mantener NVDA como requisito o aceptar otro quote previamente verificado si no funciona.
3. Wallet de operación, destinatario de comisiones, economía transparente y techo de gasto.
4. Manifiesto final y autorización de la corrida antes de conocer su resultado.

Hoy no se solicita ninguna de esas autorizaciones para el rediseño o para seguir desarrollando localmente.
