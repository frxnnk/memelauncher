# Vault: custodia verificable y economía por rondas

Fecha: 2026-09-15. Propuesta para discusión, sin cambios de contratos, fondos ni configuración de la beta. Decisión confirmada por el usuario: si una ronda vence sin ganador, la devolución corresponde a quienes pagaron intentos, no a holders del token. Los porcentajes, plazo exacto y mecanismo de ejecución todavía no están aprobados.

Feedback posterior: el usuario respalda la dirección general y pide mecanismos de continuidad, retiro temporal de modelos vencidos, precios por modelo evaluables y ejecución de IA comprobable. El [diseño complementario](ROUND-SURVIVAL-DESIGN-2026-09-15.md) concreta la propuesta, manteniendo parámetros y contratos pendientes.

## Recomendación

Escrow de juego con reglas acotadas e inmutables por ronda; multisig para administración limitada y fondos operativos. El agente produce evidencia de una decisión, pero no recibe una herramienta para transferir fondos arbitrariamente. La custodia del premio no debe depender de la aprobación discrecional del fundador.

| Alternativa | Ventaja | Límite |
|---|---|---|
| Multisig 2/2 fundador + agente | Bloquea una firma aislada si las claves son realmente independientes | El fundador puede vetar un premio; caída del agente bloquea salidas; controlar su host o reglas puede equivaler a controlar ambas firmas |
| Multisig con terceros independientes | Distribuye la confianza entre personas | Quórum puede coludir o censurar; no demuestra ejecución del modelo |
| Escrow por ronda + ejecutor verificable + administración limitada | Ganador, monto, reserva y devolución sujetos a reglas públicas | Más ingeniería y auditoría; la ejecución externa del modelo conserva supuestos de confianza |

La tercera es el objetivo recomendado. No afirmar que Safe está disponible en la red elegida sin comprobar despliegues, versión y módulos. Safe admite módulos capaces de ejecutar fuera del flujo normal de firmas: mostrar firmantes y umbral no describe todos los permisos. Fuente: [Safe Modules](https://docs.safe.global/advanced/smart-account-modules).

## Permisos propuestos

- Jugador: retirar crédito disponible; comprometer un intento; reclamar un premio o devolución ya determinados. La wallet beneficiaria se fija antes del intento.
- Ejecutor del modelo: publicar un resultado asociado a ronda, configuración, wallet, hash del prompt/historial, identificador y nonce consumible una sola vez. Sin destinos ni montos arbitrarios.
- Contrato: comprobar elegibilidad, evidencia y estado; reservar premio una sola vez; permitir claim por cualquier relayer con destino fijo; ejecutar expiración y devoluciones sin permiso del fundador.
- Multisig: administrar operación y parámetros de rondas futuras con aviso/demora. Sin facultad para reemplazar el resultado, retirar obligaciones o modificar una ronda financiada.
- Emergencia: pausa acotada de nuevas entradas; no pausa indefinida de reembolsos. Ruta de cierre y vencimiento propia que no necesite al agente funcionando.
- Ronda activa: contrato sin upgrade discrecional, sin escape administrativo de sus activos, ni aprobación ilimitada a terceros. Un timelock sólo retrasa privilegios; no elimina un permiso peligroso. [OpenZeppelin Access Control](https://docs.openzeppelin.com/contracts/5.x/access-control).

## Qué significa cada prueba

| Afirmación | Evidencia necesaria | Qué no demuestra |
|---|---|---|
| Fondos presentes | Red, contrato, activo exacto y balance a bloque determinado | Que alcance para todas las obligaciones, que no sea prestado temporalmente, ni valor en USD |
| Obligaciones cubiertas | Créditos disponibles + intentos pendientes + bounty abierto + premios/devoluciones reservados + reservas, reconciliados contra activos | Solvencia si las obligaciones se pueden omitir del registro |
| Retiros restringidos | Bytecode verificado, permisos, upgrades, signers, módulos, allowance, reglas de salida y auditoría | Ausencia absoluta de bugs o riesgo del token/red |
| Mismas reglas | Manifiesto previo con modelo/proveedor, prompt, herramientas, contexto, muestreo, versión, precio y criterio de victoria | Que esas reglas se hayan ejecutado realmente |
| Ejecución verificable | Evidencia de ejecución y firma ligada al request y configuración aprobados, con nonce y registro de orden | Justicia económica, imposibilidad de censura o que el modelo sea invulnerable |

Los hashes y recibos firmados por nuestro servidor prueban consistencia respecto de lo publicado, no honestidad independiente. El registro debe impedir omisiones, duplicación, rollbacks y repetir inferencias hasta escoger una respuesta conveniente.

Una opción a evaluar es ejecución y claves en TEE con attestation verificable; la verificación debe cubrir runtime, política de claves y, para afirmar prueba del modelo, inferencia. Un proxy en TEE que llama a una API ordinaria sólo atestigua al proxy. Persisten confianza en hardware, proveedor, disponibilidad y continuidad de estado. [Phala Confidential AI verification](https://docs.phala.com/phala-cloud/confidential-ai/verify/overview), [Phala agent keys and runtime](https://docs.phala.com/phala-cloud/getting-started/explore-templates/deploy-erc-8004-agent).

Con APIs convencionales fijar endpoint y desactivar fallbacks evita cambios de proveedor no deseados, pero no demuestra pesos/versiones ni una respuesta reproducible. OpenRouter documenta `provider.only`, endpoints específicos, `allow_fallbacks` y `require_parameters`: [Provider routing](https://openrouter.ai/docs/guides/routing/provider-selection). La beta actual debe seguir identificándose como ejecución del operador.

## Separación de fondos

Por cada activo, nunca sumar unidades de tokens diferentes ni tratar cotización estimada como respaldo.

1. Crédito sin usar: 100% de lo recibido, retirables según finalización de red; no forma parte del bounty. Gas externo separado.
2. Intento pendiente: precio reservado y no gastable; resultado ambiguo no implica pérdida. Error confirmado devuelve precio conforme a las reglas. Hace falta un vencimiento acotado para pendientes sin resolución.
3. Intento completado: precio se divide entre bounty de ronda, operación y reserva de continuidad.
4. Bounty de ronda: todo el monto anunciado como premio puede ganarse. La reserva de continuidad se muestra por separado.
5. Premios y reembolsos exigibles: montos ya reservados; no financian otra ronda.
6. Sponsors y creator fees: subregistros por procedencia y reglas propias. Sólo contar activos ya recibidos; no presupuestar fees futuros. No incluir donaciones en devolución a jugadores salvo que el sponsor lo autorice explícitamente.

Invariante: saldo en custodia >= suma de obligaciones y asignaciones excluyentes. Al ganar, B se reclasifica a premio exigible, no se cuentan ambos. Al vencer sin ganador, el fondo pertinente se reclasifica a reembolsos exigibles y continuidad. Operación deja de contar como saldo del escrow cuando efectivamente se retira. Donaciones accidentales se muestran separadas hasta asignarse por una regla explícita.

## Expiración sin ganador

Base acordada: destinatarios son los que pagaron intentos válidos de la ronda. Ponderación por unidades efectivamente aportadas al bounty de esa ronda, no por cantidad de mensajes, saldo actual del token o cantidad de wallets. El derecho de devolución queda asociado a la wallet beneficiaria fijada al pagar y no cambia al vender tokens.

Sea c_i la contribución elegible de la wallet i, C la suma, y r el porcentaje reembolsable del fondo elegible remanente F. Entonces devolución_i = floor((r * F) * c_i / C), con cálculo entero en unidades base y regla pública para el remanente de redondeo. En el caso simple sin entradas/salidas adicionales F=C, devolver r de la contribución individual; separar aportes de sponsors y fees. Si C=0, no hay reclamantes de jugadores.

- Fecha de cierre definida al abrir la ronda. Si se usa 180 días, llamarlo 180 días; seis meses calendario no siempre equivalen.
- Al cierre dejan de aceptarse intentos. Se necesita una ventana fija de resolución de los ya admitidos y un límite final para resultados y claims de victoria; ninguna prórroga discrecional.
- Debe definirse orden de admisión y qué prueba gana ante resultados simultáneos. No usar el orden de recepción en nuestro servidor como única evidencia.
- Error de infraestructura y expiración sin ganador son situaciones distintas: el sistema no debe beneficiarse por dejar de responder.
- Tras finalización sin ganador, los reembolsos se pueden reclamar directamente sin firma del fundador ni del agente, sin enviar en un bucle a miles de wallets.
- Los derechos no reclamados no se reciclan silenciosamente. Definir conservación, gas y eventual cierre antes de aceptar fondos.
- No deducir fees por segunda vez si ya se descontaron del precio del intento. Mostrar el porcentaje real respecto de lo pagado.

## Ejemplo aritmético, no tokenomics aprobadas

Se usa 70/20/10 sólo para enlazar con la prueba existente. Debe validarse contra costos reales antes de adoptarlo.

De 10.000 unidades pagadas en intentos completados: 7.000 bounty, 2.000 operación, 1.000 continuidad. No hay sponsors ni créditos sin usar en este ejemplo.

| Resultado | Ganador | Reembolsos a jugadores | Continuidad final | Operación |
|---|---:|---:|---:|---:|
| Hay ganador | 7.000 | 0 | 1.000 | 2.000 |
| Vence; r=75% del bounty elegible | 0 | 5.250 | 2.750 | 2.000 |

Ambas filas suman 10.000. En la segunda, se devuelve 52,5% de lo pagado, no 75%. Una wallet que pagó 100 recibe 52,5 bajo estos supuestos. La devolución es condicional a que no haya ganador; no es capital garantizado ni rentabilidad por holdear. La reserva conservada no garantiza continuidad infinita si se agotan ingresos o cae el valor del activo.

## Límites contra vaciamiento y trampas

- Máximo expuesto por ronda y una sola adjudicación; pools independientes por modelo. Un modelo roto no accede a otros pools ni a créditos no usados.
- La reserva retenida no alimenta automáticamente rondas ilimitadas con la misma vulnerabilidad. Apertura de la siguiente ronda requiere reglas/versión nuevas o revalidación pública con capital acotado; reglas de la ronda actual se respetan.
- Payout limitado por contrato a beneficiario comprometido, ronda y monto. Persuadir al agente puede ganar legítimamente el premio; no puede otorgar permisos de administración.
- Compromiso del prompt con nonce/salt y wallet antes de revelar, para limitar copia y front-running. Publicar prompt en mempool antes de fijar beneficiario permitiría robar la idea. Un commitment no resuelve por sí solo orden, censura ni disponibilidad de datos.
- Si contamos contribuciones exactas, dividir el mismo gasto entre varias wallets no multiplica reembolsos. Evitar mínimos reembolsables y premios por número de wallets.
- La reserva de operación debe cubrir costo de API, gas subsidiado, infraestructura y fallos con hipótesis conservadoras; no financiarlo con créditos de otros jugadores.
- Una curva de precio creciente puede ayudar a ingresos pero no detiene un jailbreak conocido. Un ataque de un solo intento puede ganar aunque sea caro. Versionado y límites de exposición son esenciales.
- No se puede demostrar que una wallet no sea de un amigo del fundador. Reducir privilegios, registrar todos los intentos elegibles y vincular cada premio a evidencia limita trampas; no elimina ventaja por pruebas offline sobre un modelo público.
- Expiración genera incentivo a esperar hasta el final: hay menos tiempo de exposición y puede existir devolución. Simular llegadas tardías, volumen bajo, ganadores tempranos y caída de precio antes de fijar porcentajes.

## Precio y token propio

Empezar con precio fijo por ronda/modelo simplifica la verificación. Evaluar luego escalones o curva acotada que use exclusivamente bounty disponible de esa ronda, con cotización válida por tiempo/nonce y límite aceptado por el jugador. Evitar subir el costo a mitad de una orden.

Separar denominación del pago, del premio y del costo operativo. Si se paga en token propio pero el proveedor cobra USD, medir liquidez y riesgo de conversión. Reembolsar unidades del token no asegura devolver los mismos USD. No elegir emisión, vesting, liquidez, derechos sobre fees, oracle ni split del lanzamiento Long sin verificar el token/par y sus contratos reales.

La propuesta no necesita rewards para holders ni rendimiento prometido para funcionar. Sponsors reciben exposición contratada; no controlan ganadores. Los creator fees pueden subsidiar reserva o premio sólo tras recibirlos y registrar su asignación.

## Decisiones y validación siguientes

Confirmado: devolución a quienes pagaron. Pendientes: plazo, r, split de intentos, máximos por ronda, reserva mínima, destino de sponsors al vencer, condición exacta de victoria y grado de evidencia de inferencia. Ninguno queda fijado por este documento.

Antes de mainnet: especificación de estados/permisos; simulación de solvencia con baja actividad, expiración, fallos y victorias sucesivas; prototipo testnet de escrow con claims; verificación de todas las rutas de retiro/upgrade; evaluación independiente de contratos y ejecutor; revisión del lanzamiento con premios pagos y de los términos aplicables. No presentar un badge de seguridad absoluta ni de fair play matemáticamente probado mientras existan resultados del operador sin verificación externa.
