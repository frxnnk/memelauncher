# De la práctica a una beta con créditos y bounty

Revisión del 15/09/2026. Propuesta técnica, no activación de fondos ni elección de token/red. Ninguna transferencia, firma, alta de bot o compra ocurrió en esta revisión.

## Lo verificado en el proyecto

| Pieza | Estado y trabajo pendiente |
|---|---|
| Web, Privy, modelos y recibos | Funcionan en la beta cerrada. La inferencia requiere invitación. |
| Contabilidad | Servicios y ensayos locales; no confundir unidades TEST con tokens depositados. |
| Depósitos | `createAuthenticatedDeposits` prepara órdenes autenticadas, transfers ERC-20 y verificación RPC. La preparación/envío no está conectada por HTTP/UI a una wallet; fondos y firma siguen deshabilitados. |
| Telegram | Adaptador de chat persistente con modelos, reglas, recibos y deduplicación. El arranque rechaza beta cerrada hasta implementar admisión. No hay bot activo ni identidad/saldo compartidos con Privy. |
| Premio | No hay recorrido monetario real validado de depósito a pago del ganador. El modelo no tiene claves ni autoridad directa de transferencia. |
| Token y fees | No elegidos para Vault. La existencia de un Community Vault de un launchpad no prueba que su contrato pueda pagar nuestro juego. |

## Qué permite la sugerencia de Phantom

La captura propone abrir Phantom y firmar antes del intento. El enlace es un mecanismo para interactuar con una wallet: no acredita un depósito por sí mismo y una firma de mensaje tampoco transfiere tokens. El callback no sustituye la verificación de la transacción en la red.

Los [deep links documentados por Phantom](https://docs.phantom.com/phantom-deeplinks/deeplinks-ios-and-android) son para Solana. El módulo monetario preparado aquí es ERC-20/EVM: si se elige Solana se necesita su adaptador, validador y escrow. Esto no afirma que toda la app Phantom sea exclusiva de Solana. El método antiguo [SignAndSendTransaction](https://docs.phantom.com/phantom-deeplinks/provider-methods/signandsendtransaction) figura como deprecated; hay que elegir una integración vigente, no copiar una receta vieja.

Para la UX propongo una recarga y varios intentos sin otra firma. Una sesión autorizada permite descontar un precio publicado del crédito interno, no permite gastar arbitrariamente la wallet. Firmar cada intento es una alternativa distinta, con gas y pasos adicionales.

## Restricción de Telegram que afecta la decisión

Los [pagos de bienes y servicios digitales dentro de bots y Mini Apps](https://core.telegram.org/bots/payments-stars#faq) deben realizarse en Stars. La FAQ rechaza cripto como sustituto y aclara que tener una web externa de ventas no elimina la obligación. Los mensajes pagos de IA parecen encajar en esa categoría; no se debe presentar un link externo de recarga como una exención confirmada.

Además, las [reglas blockchain de Mini Apps](https://core.telegram.org/bots/blockchain-guidelines) exigen TON y TON Connect para los usos allí descritos. Los bots normales sin Mini App están exentos de esa regla blockchain específica; siguen sujetos a la regla de pagos digitales.

Ruta propuesta: beta monetaria primero en la web. Telegram inicialmente gratuito/de práctica y para consultar información del juego. Si se quiere vender intentos dentro de Telegram, diseñar el canal Stars y validar el tratamiento de créditos, devoluciones y premios antes de prometer que acepta el mismo token. Un bounty patrocinado con participación gratuita es otra modalidad a evaluar; no se afirma su autorización automática por Telegram o por la jurisdicción.

## Recorrido monetario que hay que completar

1. **Congelar el activo y la red.** Token exacto, decimales, gas, confirmaciones, receptor y activo del premio. Si se cobra token volátil y se paga API en USD, definir cotización, vencimiento y quién absorbe el costo. Se puede ensayar con un activo existente sin lanzar aún el token propio.
2. **Preparar y confirmar la recarga.** Cuenta/wallet verificadas, orden, importe/destino legibles, firma de transferencia, hash persistido y validación RPC del servidor. Manejar rechazo, hash incierto, cambio de red, duplicados y reinicio sin pedir otro pago innecesario.
3. **Separar saldos.** Crédito sin gastar, reservas de intentos pendientes, bounty disponible y operaciones no son la misma cosa. Recargar 100 no aumenta simultáneamente el premio en 100 y el crédito disponible en 100.
4. **Consumir y repartir.** Reservar el precio al enviar; ante una respuesta válida, consumir una vez y distribuir según la ronda. Un error o resultado incierto queda como tal y se concilia; no se anima una derrota ficticia. El intento ganador también sigue el reparto publicado antes del payout. El 70/20/10 de los ensayos es un ejemplo, no una política adoptada.
5. **Congelar rondas y decisión.** Modelo, prompt, herramientas, configuración, precio y reparto quedan versionados durante una ronda con dinero. La arena libre puede tener selector; un bounty común entre modelos distintos queda expuesto al más fácil. Preferir ronda por modelo o un guardián canónico para el primer bounty.
6. **Completar el pago.** Escrow/contrato con permisos publicados, autenticación del resultado, protección contra replay, orden para dos intentos simultáneos y cierre/pago único. El dinero reservado como crédito de otros jugadores nunca se usa para pagar el bounty.
7. **Unificar Telegram y web.** Crear bot propio, admisión por invitación, enlace de identidad Privy-Telegram mediante challenge de un solo uso y caducidad, y un único servicio de consumo. No identificar cuentas por username ni confiar en un ID de usuario enviado por el cliente. Resolver la modalidad de cobro antes de conectar el saldo pagado al bot.
8. **Probar antes de recaudar.** Recorridos de depósitos, cancelación, reinicios, consumo doble, envío duplicado, API caída, reembolso y payout en testnet. Revisión del contrato, operación/alertas/backups y reglas de participación por jurisdicción para entrada paga con premio. Después, piloto con límites explícitos de depósito y bounty.

## Confianza: contrato no equivale a prueba de ejecución

Un contrato puede custodiar el fondo y limitar quién cobra, pero si acepta una firma de nuestro backend como prueba de victoria, ese backend conserva autoridad para declarar un ganador. Un multisig reduce el control individual del dinero; no demuestra qué respondió el LLM. Antes de prometer que ni el creador ni sus amigos pueden manipular el resultado, hace falta ejecución/atestación verificable con un modelo de confianza documentado. Una beta de confianza limitada debe decirlo expresamente y acotar el fondo.

## Cómo entra capital adicional

Sponsors y capital inicial entran como aportes confirmados al premio, separados de los créditos comprados. Fees de creador solo se suman cuando se reciben realmente: hay que comprobar receptor, permisos, activo que paga el launchpad y transacción de cobro. Si llegan en otro token, registrar ese activo; no fingir una conversión. La vista pública debe mostrar saldo verificable, aportes, distribución de intentos y pagos con sus referencias.

## Orden recomendado

Primero elegir red/activo y modalidad Telegram. Luego cerrar depósitos y contabilidad web en testnet, integrar identidad/admisión del bot de práctica y validar el escrow/payout. Por último abrir una beta monetaria pequeña con las limitaciones de confianza declaradas. La beta actual permanece de práctica hasta completar esos pasos.

## Corrección de la carita

Se reprodujeron dos fallos: el listener solo recibía movimiento dentro de la bóveda y el pitch invertía el eje vertical de pantalla. El renderer ahora toma el cursor de la página, limita la dirección, procesa movimientos a su cadencia de render, elimina la deriva mientras apunta e ignora el dedo en touch. El despertar evita crear otro loop de animación. Cuatro regresiones cubren arriba/abajo, seguimiento fuera del avatar, touch y despertar; suite completa: 216 pruebas. Comprobación de navegador: por encima, centros de ojos con y negativa; por debajo, y positiva, sin clic en la bóveda.
