# Vault First Funded Release Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. The available local skill is `executing-plans`.

**Goal:** Lanzar un piloto web con un guardián, premio real acotado, créditos retirables, reglas de expiración y autoridad verificable que no dependa de una decisión editorial del operador.

**Política en revisión posterior, 15/09:** el usuario habilitó evaluar créditos de juego sin retiro ordinario. El [registro de decisiones y validación](2026-09-15-vault-paid-beta-decisions.md) concentra los nuevos defaults, responsables y excepciones de cierre/error. Cuando se acepte la política, adaptar conjuntamente contratos, términos y UX para nuevas compras; no retirar derechos a balances previos ni confundir créditos restaurados con devolución de bounty al vencer. Este plan conserva la especificación anterior de retiros como referencia hasta esa elección comercial.

**Architecture:** Reutilizar frontend, Privy, motor de juego y servicios Node existentes. Un escrow por ronda será la fuente de verdad de saldos, admisiones y claims; SQLite será una proyección recuperable, no autoridad de retiro. Un ejecutor con evidencia verificada ligará resultados al manifiesto y a intentos autorizados; la factibilidad de impedir reinferencia oculta se resuelve antes de comprometer el lanzamiento pago.

**Tech Stack:** Node ESM, SQLite, viem y frontend actual; Solidity con herramientas fijadas para pruebas de escrow; runtime/verificador TEE por elegir tras el ensayo existente. Sin migración de framework, base de datos ni Docker de producción como requisito del plan.

**Actualización de pagos y red, 15/09:** Robinhood es un requisito obligatorio del usuario. El [mapa completo del sistema](../treasure-guardian/ROBINHOOD-SYSTEM-MAP-2026-09-15.md) es la referencia actual para pagos, conversión, custodia, ejecución y devoluciones. Propone admisión por intento en Robinhood, pago x402 desde una caja operativa acotada en Base y reposición automática por lotes con ingresos operativos consumidos. El usuario no cambia a Base. Relay respondió 200 para cotizaciones sin firma USDG Robinhood → USDC Base; BlockRun/NanoGPT respondieron 402 sin key. Todavía faltan ejecución financiera, inferencia y autoridad verificable. La beta y sus saldos no cambian.

---

## Primera versión recomendada

Propuesta, no configuración aplicada. Piloto cerrado con 20–50 invitados adultos en jurisdicciones admitidas, sujeto a revisión de elegibilidad/términos. Una ronda paga activa y un guardián seleccionado por evaluación técnica y evidencia de ejecución. El selector conserva modelos de práctica, claramente separados del premio. Un segundo guardián financiado es una expansión posterior; el diseño y pruebas deben aislar rondas desde el inicio.

Web en inglés, mobile primero: login, conectar wallet, recargar, ver precio/beneficiario, enviar mensaje, ver respuesta validada progresiva y aporte al bounty, revisar recibo, retirar crédito y reclamar premio/devolución. No hace falta rehacer la UI actual.

Un activo existente en Robinhood Chain para pago, crédito y premio. Robinhood es obligatoria; evaluar USDG como candidato estable, sin declararlo seleccionado o libre de riesgos. Conversión automática solo de fondos operativos hacia el activo/red del proveedor, con límites y conciliación; nunca del bounty ni de créditos sin consumir. Sin token propio, asociación a stock ni dependencia de Long en V1. El token Long requerirá una nueva ronda/configuración, ruta de liquidez y activos separados; no redenominar créditos existentes.

Premio totalmente ganable, reserva aparte, precio fijo, reglas congeladas y cierre al ganar. Configuración vencida retirada de juego pago hasta nueva versión evaluada; sin reapertura automática. Sponsors iniciales, si existen, se reciben con procedencia y términos explícitos, sin marketplace. Creator fees no son una fuente presupuestada.

Propuesta para piloto: admisión durante 30 días, con deadlines de resolución y devolución publicados. Cambia respecto de la idea de seis meses y requiere elección expresa antes de financiar; 180 días sigue como alternativa de producto. No cambiar la fecha después de aceptar pagos. Ensayar ambos plazos con reloj simulado, sin esperar meses.

Fuera de V1: Telegram, catálogo abierto con premios, precios dinámicos, entrenamiento autónomo, rankings de dificultad concluyentes, token/vesting/LP, expansión automática de guardianes. Se conserva el trabajo de Telegram existente, sin contarlo como integración productiva.

## Estado verificado en el workspace

- `public/` ya contiene chat, cara, bounty por modelo, sonidos opt-in, selección de modelo, recibos y recarga.
- `server/economy/web-funding-runtime.mjs` admite exclusivamente testnet 46630 y una configuración de guardián por ronda; actualmente recibe términos globales compartidos. No alcanza con cambiar un flag a mainnet.
- `server/rounds.mjs` congela manifiestos locales y verifica cambios; esos hashes siguen siendo evidencia del operador.
- `server/economy/model-game.mjs` persiste trabajos, evita reintentos locales y separa estados ambiguos; no prueba exclusión de clones ni inferencia externa única.
- `public/economics-model.js` calcula una proyección aritmética de una ronda; no simula continuidad temporal ni contratos.
- No existe directorio de contratos del juego. Escrow, retiros on-chain, expiración y prueba independiente siguen pendientes.
- El registro de release informa 244 tests/build y circuito real de tokens de prueba. Esta planificación no repitió QA remoto ni afirma pagos reales.
- Git está sin commits en `codex/vault-launch-preparation`; no se puede crear un worktree convencional desde HEAD. Plan escrito en el workspace actual. Antes de código, crear un baseline revisado sin secretos ni datos privados; no hacer `git add .`.

## Decisiones antes de financiar

| Decisión | Recomendación o condición |
| --- | --- |
| Semilla máxima | Usuario confirmó hasta USD 500 para planificar el premio. Monto inicial y activo exactos pendientes; no es presupuesto de hosting/auditoría ni autorización de transferencia. |
| Exposición máxima | Tope del bounty completo, no solo semilla; limitar intentos/contribuciones y cerrar admisiones al alcanzar el tope. |
| Fondo operativo | Separado de semilla y reserva; incluye fallos, pruebas, gas y revisión externa. |
| Split / devolución | Simular 70/20/10 y 75% del bounty elegible como hipótesis; significan 52,5% de lo pagado si expira, no 75%. |
| Duración | Elegir 30 días de piloto o 180 días; deadlines y claims independientes de disponibilidad del operador. |
| Modelo | Uno que pase herramientas, costo, calidad, evaluación adversarial y evidencia; Haiku no está calificado solo por responder bien. |
| Cadena / activo | Robinhood obligatoria; verificar mainnet 4663, contrato del activo, decimals, permisos del emisor, pausas, transferencias, finalidad y wallet. Base solo como infraestructura de pago del proveedor. |
| Autoridad | No aceptar firma del servidor como prueba independiente. Si falla el ensayo de autoridad, el lanzamiento pago queda bloqueado. |

## Hitos y dependencias

### Capital de trabajo y reposición automática

Dirección actual: cobrar/reservar cada intento en Robinhood, reservar costo máximo en la caja USDC Base y pagar x402 por solicitud. Reponer esa caja por lotes desde operación realizada en Robinhood. El [mapa](../treasure-guardian/ROBINHOOD-SYSTEM-MAP-2026-09-15.md) compara esto con convertir y esperar por cada intento. No existe atomicidad entre escrow, bridge y respuesta HTTP. Presupuestar caja inicial, errores y gas aparte del premio. El siguiente detalle conserva la alternativa OpenRouter, que ya no es la recomendación principal.

Aclaración 15/09 tras pregunta del usuario: el objetivo es que el consumo de intentos financie la inferencia. La recarga depositada por el jugador sigue siendo una obligación retirable hasta que se consume; no se compra saldo de OpenRouter con ese dinero sin consumir. El límite de USD 500 definido por el usuario corresponde a semilla del premio, no al capital de trabajo operativo.

Flujo V1 propuesto: depósito → saldo disponible; admisión → precio reservado; caja operativa → pago de inferencia; resultado válido → reparto entre bounty, operación y continuidad; parte operativa devengada → conversión por lotes y reposición de caja. La primera llamada y el lapso hasta liquidar/convertir cobros requieren liquidez operativa propia. Un error reembolsado que haya generado costo API se cubre con la reserva de errores; no con premios ni dinero retirable de otros jugadores.

Ejemplo ilustrativo de activo estable: depósito 10, consumo 1, quedan 9 disponibles. Con split candidato 70/20/10: 0,70 premio, 0,20 operación y 0,10 continuidad. Solo 0,20 está disponible para operación; de ahí se pagan inferencia, recargas, conversión y otros costos. No se puede retirar 10 después de consumir 1. La devolución condicional al vencer la ronda es un derecho distinto al retiro de los 9 disponibles.

OpenRouter carga créditos a la cuenta; una key es una credencial con límites, no una wallet de saldo independiente. Monitorear saldo de cuenta, presupuesto de key y autorizaciones de inferencia pendientes de forma separada. No mostrar créditos OpenRouter como activos líquidos que respaldan retiradas de usuarios.

**Alternativa prepaga, no seleccionada:** saldo de proveedor pequeño dimensionado por contexto máximo, concurrencia y demora de reposición; alertas y recarga operativa revisada por lotes. Auto Top-Up de tarjeta aportaría liquidez, no una transferencia automática desde el token del juego. No imponerla como solución al requisito del usuario. En cualquier modalidad, sin saldo/presupuesto suficiente se cierran nuevas admisiones; claims y retiradas siguen habilitados.

**Automatización cripto requerida por la propuesta actual:** calificar Relay USDG Robinhood → USDC Base con contratos definitivos, ejecución real acotada, slippage propio y conciliación. Limitar router, destinatario, importe por lote/día y fondos exclusivamente operativos. No asumir que el futuro token Long tendrá ruta. No contar fondos en tránsito como disponibles, ni aceptar calldata arbitraria del agregador. Probar x402, máximo de gasto, recuperación y vínculo al intento antes de elegir proveedor. La reposición manual deja de ser el circuito objetivo.

Fuentes consultadas hoy: [Auto Top-Up](https://openrouter.zendesk.com/hc/en-us/articles/51680638594331-How-does-Auto-Top-Up-work-and-how-do-I-turn-it-on-or-off) recarga con tarjeta y no tiene un tope acumulado independiente; los límites de key siguen siendo necesarios. [Crypto API](https://openrouter.ai/docs/cookbook/administration/crypto-api) indica que `POST /api/v1/credits/coinbase` fue retirado y devuelve 410; deriva las compras cripto al flujo web. [Saldo](https://openrouter.ai/docs/api/api-reference/credits/get-credits) requiere management key para consultar créditos totales/usados; mantenerla fuera del navegador y del ejecutor del juego.

**Añadir a Task 1:** simular demoras de recarga, saldo mínimo, costo a contexto máximo, errores facturables, pérdida de conversión y práctica gratuita con presupuesto aparte. La fracción operativa neta debe cubrir el costo total o exigir subsidio explícito; depósitos sin consumir no cuentan como ingresos.

**Añadir a Tasks 6/8:** crear `vault-lab/server/operating-budget.mjs` y `vault-lab/test/operating-budget.test.mjs`; reservar presupuesto API antes de inferencia, conciliar contra costo real y bloquear admisión con saldo/lectura desconocidos o insuficientes. Probar que múltiples solicitudes no reservan el mismo presupuesto, una recarga fallida no dispara cargos duplicados y los retiros no dependen de recargar OpenRouter. Registrar gastos/recargas y su fuente operativa, sin publicar claves ni datos de tarjeta. Si Task 2 selecciona otro proveedor para inferencia verificable, aplicar el mismo modelo económico a su facturación y adaptar el conector; no obligar a usar OpenRouter contra ese requisito.

A. Resolver economía y factibilidad de autoridad. B. Construir máquina de rondas y escrow testnet contra un esquema de autorización estable. C. Integrar web, evidencia, claims y operación. D. Revisión independiente, ensayo completo y apertura acotada.

No estimar una fecha de mainnet antes de A: la exclusión de muestras ocultas y la verificación de inferencia pueden obligar a cambiar de proveedor/modelo. El simulador y la preparación del ensayo son las primeras entregas ejecutables. Los pasos siguientes son implementaciones acotadas; donde la criptografía sigue abierta se exige un resultado de investigación, no un verificador inventado.

## Task 0: Baseline reproducible

**Files:** `vault-lab/.gitignore` (crear solo si hace falta), `vault-lab/deploy/LIVE-BETA.md`, `vault-lab/scripts/verify-release.mjs`; baseline Git de archivos revisados.

1. Inventariar archivos de producto y exclusiones: `.env`, `.local`, bases, backups, claves, códigos de invitación y outputs privados.
2. Revisar el conjunto exacto a versionar y registrar baseline; preservar los archivos de otros proyectos del root.
3. Desde `vault-lab`, ejecutar `node scripts/verify-release.mjs`; exigir tests/build verdes, sin reusar un informe viejo.
4. Registrar SHA y manifiesto de release. Crear worktree `codex/vault-funded-v1` una vez exista HEAD.
5. Continuar cada tarea con commit acotado de código/tests/docs revisados; no publicar un repo con datos de jugadores.

## Task 1: Simulador de continuidad y presupuesto

**Files:** crear `vault-lab/audit/round-survival.mjs`, `vault-lab/audit/fixtures/round-survival.json`, `vault-lab/test/round-survival.test.mjs`; reutilizar lógica de reparto en `server/economy/schema.mjs`/`operations.mjs` cuando sea aplicable, sin duplicar reglas en el frontend.

1. Escribir casos deterministas con cantidades enteras: victorias inmediatas, todas las rondas vencidas, sin actividad, expiración, errores, sponsors, créditos retirados y costo operativo adverso.
2. Ejecutar `node --test test/round-survival.test.mjs`; observar fallos por comportamiento todavía ausente.
3. Implementar simulación con reloj/eventos explícitos. Salida: activos, obligaciones, premio, continuidad, operación, claims y motivos de no apertura. Precios USD son escenarios, no balances ni predicciones.
4. Probar conservación de fondos, cero saldo negativo y prohibición de usar obligaciones ajenas. Ejemplo: reserva 1.000, piso 500 y semillas 100 admite como máximo cinco pérdidas sin reposición; una sexta debe rechazarse.
5. Ejecutar `node audit/round-survival.mjs --out output/round-survival.json`; exigir escenarios reproducibles e invariantes válidos. Registrar parámetros candidatos y sensibilidad; no afirmar continuidad infinita.

Incluir semillas de USD 100, 250 y 500 como escenarios, sin gastar. No usar más de USD 500 de aportes del fundador al premio del piloto sin nueva decisión. Valorar por separado continuidad y operación; si el activo no es estable, convertir estos escenarios a unidades con cotización y límite explícitos antes de cualquier financiación. Los aportes de jugadores pueden hacer crecer el bounty por encima de la semilla: requieren su propio tope de exposición.

## Task 2: Prueba de autoridad antes de fondos

**Files:** existentes `vault-lab/deploy/dstack-verifier.compose.yaml`, `docs/treasure-guardian/AUTHORITY-PROOF-PROPOSAL.md`; crear `vault-lab/audit/authority-proof.mjs`, `vault-lab/audit/fixtures/authority-provider.mjs`, `docs/treasure-guardian/AUTHORITY-PROOF-RESULT.md`.

1. Revisar contrato de evidencia esperado: chain/escrow/ronda, manifiesto, secuencia, beneficiario, entrada/contexto, salida/decisión, instancia/época y autoridad autorizada.
2. Preparar fixture que cuente solicitudes fuera del disco restaurado y devuelva respuestas distinguibles; probar fallo antes/después del envío, pérdida de respuesta, reinicio, clones y rollback.
3. Ejecutar verificador oficial fijado contra prueba inválida y luego una quote auténtica de instancia sin fondos. Confirmar mediciones contra artefactos conocidos; una quote válida de otra imagen debe rechazarse. Elegir hosting/release y tope de gasto concreto antes de aprovisionar.
4. Probar vínculo de clave/configuración y gobierno/KMS. El ensayo falla si una actualización obtiene autoridad de la ronda o si el operador puede seleccionar entre muestras elegibles. Un resultado parcial se reporta como parcial.
5. Ejecutar `node audit/authority-proof.mjs --fixtures --out output/authority-fixtures.json` para el ensayo local y documentar invocación exacta del entorno elegido para la prueba real. Verificar desde otro equipo; no confundir fixtures con atestación.

**Salida obligatoria:** decisión viable/no viable con evidencia. Si no se cumple independencia del operador, mantener práctica/testnet y evaluar una ruta con inferencia verificable; no rebajar el requisito con un badge o multisig del equipo.

## Task 3: Calificar un guardián y congelar sus términos

**Files:** `vault-lab/eval/{runner.mjs,run.mjs,adversarial-scenarios.mjs}`, `vault-lab/server/{profiles.mjs,rounds.mjs}`, crear `vault-lab/eval/qualification.mjs`, `vault-lab/test/qualification.test.mjs`.

1. Definir pruebas separadas: compatibilidad de herramientas, negativas, victoria positiva con fixture, ataques adaptativos y conjunto reservado. Versionar prompt/contexto/herramientas; no entrenar sobre el conjunto reservado.
2. Generar plan sin inferencia: `node eval/run.mjs --suite adversarial`; revisar cantidad de llamadas y presupuesto antes de cualquier `--live`.
3. Medir candidatos compatibles con Task 2 con igual presupuesto, incluyendo salida máxima e historial largo. No reutilizar automáticamente la key de la beta; conservar límite dedicado.
4. Publicar costo/latencia, fallos, ataques y victorias válidas; no convertir rechazos en probabilidades universales. Excluir modelos que aparentan resistencia por herramientas rotas.
5. `node --test test/qualification.test.mjs test/rounds.test.mjs`. La elegibilidad financiada exige resultado de Task 2 y manifiesto completo; no solo nombre de modelo.

## Task 4: Estados, vencimiento y reserva

**Files:** modificar `vault-lab/server/{rounds.mjs,economy/schema.mjs,economy/operations.mjs,economy/model-game.mjs,economy/web-funding-runtime.mjs}`; crear `vault-lab/server/economy/round-lifecycle.mjs`, `vault-lab/test/round-lifecycle.test.mjs`.

1. Tests: ganar una vez, rechazo de intento posterior, expiración con pendiente, devolución por error, cierre por tope y aislamiento entre A/B. Simular reloj; no sleeps de días.
2. Versionar esquema y migración aditiva con copia/verificación previa. No reinterpretar la ronda AMZN existente como mainnet ni cambiar sus términos.
3. Implementar candidata/evaluada/abierta/resolviendo/ganada/expirada y registro de configuración vencida. Separar cierre de admisiones de resolución y claims.
4. Términos por ronda; cumplir piso y presupuestos antes de asignar semilla. Deshabilitar reseed automático y reactivación por mero transcurso de tiempo.
5. `node --test test/round-lifecycle.test.mjs test/rounds.test.mjs test/model-game.test.mjs test/web-funding.test.mjs`; exigir exactitud de reparto y recuperación tras reinicio.

## Task 5: Escrow testnet y claims

**Files:** crear `vault-lab/contracts/{foundry.toml,src/RoundEscrow.sol,test/RoundEscrow.t.sol,test/RoundEscrowInvariant.t.sol}`, `vault-lab/server/economy/escrow-client.mjs`, `vault-lab/test/escrow-client.test.mjs`.

1. Justificar/fijar Solidity, Foundry y biblioteca estándar auditada para ERC-20/firmas; no implementar criptografía propia. Contrato no upgradeable por ronda, una moneda y configuración/autoridad fijadas al crear.
2. Especificar y probar operaciones: depósito, retirada de disponible, admisión con autorización del jugador, resolución con evidencia válida, timeout, cierre, claim de premio y devolución. Wallet destino fijada antes de inferencia, sin allowances ilimitados al modelo.
3. Contabilizar aportes elegibles por wallet on-chain al consumir intentos, para que expiración no dependa de un Merkle root elegido después por el operador. Claims pull sin bucle sobre todos los jugadores. Redondeo y fondos no reclamados con regla previa.
4. Probar misma evidencia en otra ronda/cadena/wallet, doble claim, reentrancy, saldo insuficiente, pausas, resultados tardíos, carrera timeout/resultado y caída permanente del operador. Fijar precedencia temporal; un fallo conocido no invalida una victoria ya aceptada.
5. Desde `contracts`, `forge test -vvv` y `forge test --match-contract RoundEscrowInvariant -vvv`; invariantes: balance cubre obligaciones, operador no extrae premios/créditos, admisiones autorizadas, una adjudicación y continuidad aislada. Desplegar primero en testnet con direcciones nuevas.

Task 2 debe definir cómo verifica el contrato la autoridad; no aceptar cualquier firma que venga del backend. Task 5 no puede cerrarse como segura con un verificador stub. Los derechos existentes de testnet se conservan separados.

## Task 6: Conectar recarga, admisión y conciliación

**Files:** `vault-lab/server/economy/{deposit-rpc.mjs,deposit-monitor.mjs,deposit-orders.mjs,authenticated-game.mjs,web-funding.mjs,web-funding-runtime.mjs,model-game.mjs}`, crear `vault-lab/audit/escrow-recovery.mjs`, `vault-lab/test/escrow-recovery.test.mjs`.

1. Verificar contrato/chain/activo, recibos/eventos y finalización con fixtures de reorg, RPC atrasado y eventos repetidos. Los depósitos nuevos van al escrow, no a la wallet de tesorería anterior.
2. Autorización del jugador ligada a ronda, máximo de precio, nonce y vencimiento. Comenzar con confirmación explícita por intento; no añadir sesión con gasto ilimitado para evitar una firma.
3. Serializar una inferencia por ronda con admisión canónica; comprobar que abortar, refrescar o repetir HTTP no vuelve a cobrar ni ejecutar. Una cola no admitida no consume precio.
4. Reconstruir SQLite desde eventos finalizados y evidencia conservada; evitar pago doble o pérdida de derechos si se restaura una copia vieja. Respetar frescura y estado de Task 2.
5. `node --test test/escrow-client.test.mjs test/escrow-recovery.test.mjs test/deposit-monitor.test.mjs`; `node audit/escrow-recovery.mjs`. Exigir conciliación exacta después de detener/reiniciar servicio.

## Task 7: Recorrido mobile y transparencia

**Files:** `vault-lab/public/{app.js,account.js,account-credits.js,funding.js,web-credits.js,guardian-bounty.js,details.js,treasury.js,index.html}`, crear `vault-lab/public/claims.js`, modificar rutas finas en `vault-lab/server/http.mjs`.

1. Mostrar modo/activo/premio, precio y wallet antes del intento; confirmación al cambiar guardián/ronda. No presentar el valor testnet como dólares.
2. Añadir retirar disponible, reclamar premio/devolución y recuperar transacción. Resultado visual de victoria solo después de la validación; estado claim distinto de pago confirmado.
3. Página de evidencia: manifiesto, fondos y obligaciones por bloque, permisos, ejecución y enlaces de verificación. Errores o evidencia desconocida visibles; no usar "provably fair" sin cumplir alcance.
4. Preservar burbuja, intro que desaparece, sonidos opt-in y selector dentro del chat. Probar 360/390px, escritorio y dos teléfonos reales con Phantom/Privy, teclado, rechazo de firma, cambio de red y reload durante transacción.
5. `node scripts/verify-release.mjs`; QA por flujo hasta receipt/claim confirmado. No crear tests cosméticos que repliquen CSS. Guardar evidencia de dispositivo sin secretos ni datos de otros usuarios.

## Task 8: Operación, revisión independiente y ensayo

**Files:** crear `vault-lab/audit/funded-release-drill.mjs`, `vault-lab/deploy/FUNDED-RELEASE.md`, `vault-lab/deploy/FUNDED-INCIDENTS.md`; extender `vault-lab/scripts/preflight.mjs` y `vault-lab/server/health.mjs`.

1. Preflight exige jurisdicción/términos y presupuesto aprobados, activo/RPC verificados, manifests publicados, escrow verificado y autoridad válida. Un env `REAL_FUNDS=true` no puede saltar requisitos.
2. Ensayar testnet: depósito→crédito→intento→aporte; victoria→claim; vencimiento→devolución; disponible→retiro. Incluir pérdida de API/RPC/host, reorg, doble petición y fondos enviados por error.
3. Alarmas de solvencia, antigüedad de estado, presupuesto API/gas, ejecutor no verificable y trabajo atascado. Pausa limitada de nuevas entradas; no bloqueo discrecional de claims.
4. Revisión externa de contrato, ejecutor, KMS/gobierno y frontend de firmas. Una segunda pasada del mismo agente no cuenta como auditoría independiente. Resolver hallazgos materiales antes de fondos reales.
5. `node audit/funded-release-drill.mjs` y `node scripts/verify-release.mjs`. Registrar configuración, hashes, resultados y pendientes. Probar retiro/claim desde otra interfaz aunque nuestra web esté caída.

## Task 9: Apertura acotada y criterio de expansión

**Files:** `vault-lab/deploy/FUNDED-RELEASE.md`, `docs/treasure-guardian/LAUNCH-DECISIONS.md`; configuración nueva fuera de secretos versionables y artefactos verificados por separado.

1. Cerrar los importes exactos de semilla, reserva, operación y máximo de exposición; tope de depósitos/usuario y total. Presupuesto de auditoría/hosting separado del premio.
   Semilla del fundador: máximo de planificación USD 500 confirmado. Revisar monto concreto antes de financiar y no comprometerlo automáticamente por completo.
2. Verificar red/activo/RPC en mainnet, bytecode y permisos del despliegue, autoridad/manifest y rutas de salida. La firma de financiación se revisa con direcciones y montos concretos.
3. Abrir por invitación con una ronda y guardián; no enviar invitaciones o anunciar garantías todavía sin texto y destinatarios autorizados.
4. Medir 48–72h de operación inicial, luego cierre/claim real de la ronda. Cero descuadres, cero resultados pendientes fuera de plazo y cero sustituciones sin evidencia; toda incidencia debe cerrar antes de ampliar.
5. Segundo guardián/Telegram/token Long solo tras cumplir esos criterios y presupuesto. No aumentar exposición por mero paso del tiempo o por métricas de tráfico.

## Fuentes y límites de esta planificación

Consulta 15/09/2026: [Robinhood conexión](https://docs.robinhood.com/chain/connecting/) publica mainnet 4663 y testnet 46630; [contratos](https://docs.robinhood.com/chain/contracts/) lista USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`. Es identificación documental, no verificación por RPC, liquidez, elegibilidad de usuario o compatibilidad de nuestro cobro. No se copiaron direcciones de testnet a mainnet.

[Phala verificación](https://docs.phala.com/phala-cloud/confidential-ai/verify/overview) separa gateway atestiguado de upstream verificado. Evaluar mediciones y alcance exactos antes de elegir modelo; un proxy firmado no acredita por sí mismo pesos o exclusión de muestras ocultas.

[Freysa original](https://github.com/0xfreysa/agent) y [Sovereign Framework fijado](https://github.com/0xfreysa/sovereign-freysa/blob/002a3d75097f15f6abe7f3680394188d80d01fd8/README.md) siguen como referencias de diseño según la revisión anterior. No se presentan como código auditado ni como evidencia de nuestra ejecución.

Resultado de este trabajo: alcance V1 y plan revisable. No hay contrato implementado, mainnet habilitada, cuenta cloud contratada ni dinero movido por redactar este plan.
