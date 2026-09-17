# Verificación del laboratorio — corte 15/09/2026

## Rediseño de la bóveda

Frontend publicado `dpl_tGMXtqyEnKL37E3uHF4cWkcAS8ye`. Misma API y datos. 212 pruebas completas y build; inspección de layouts 390×844, 320×568 y alto reducido 390×400 sin scroll de página, más escritorio. Estados locales controlados: escritura, espera, respuesta, error, apertura y cierre por reset; ninguna victoria de esos fixtures se atribuye a un LLM. Movimiento reducido produce una forma estable y elimina la transición de la puerta. El selector está dentro del formulario y no enfoca la búsqueda automáticamente en móvil.

En la beta publicada, sesión Privy restaurada, Haiku seleccionado desde el editor y una llamada real completada. Recibo `1bfa2a1e-689c-4ab7-9388-f05dd50e0fb9`, `keep_locked`, USD 0,001496. La tarjeta PNG se previsualizó con la nueva bóveda, sin publicarla ni descargarla. La prueba de alto reducido simula el espacio disponible: no reemplaza verificar Safari/iPhone y un teclado físico de dispositivo. [Detalle](../docs/treasure-guardian/VAULT-DOOR-UI.md).

## Beta cerrada publicada: verificación actual

HTTPS real en `https://vault-closed-beta.vercel.app` (Vercel frontend). El `/api` verificado ese día era el rewrite a Caddy, no un deploy nuevo a VPS. El paid-beta de este árbol apunta a Node en Vercel + Turso después del cutover (`deploy/vercel.api-cutover.json`); no se despliega un VPS. El dueño inició sesión con Privy y canjeó su invitación. Antes de canjearla, el juego rechazaba acceso; sin autenticación el POST devuelve 401, y otro origen devuelve 403. Se completaron tres mensajes reales: uno con Gemini y dos con Haiku, cupo de 25 a 22, tres recibos y contexto previo registrado. Cambiar modelo inicia otro chat sin reiniciar el cupo.

Backup consistente de los datos reales con escritor detenido, cinco SQLite íntegros y reinicio conservando hashes de sesiones/recibos. Después de recargar, `Sign in → Restore existing session` recuperó la misma membresía y `Receipts` mostró los tres resultados sin inferencia nueva. La pantalla no reanuda el chat activo; el contador del pie es local a la pestaña. Evidencia en `output/beta-live-web-verification.json` y `output/beta-browser-verification.json`.

Landing inspeccionada visualmente. Juego a 1536×646 y 390×844 sin scroll de página; el panel Account cabe en móvil. La consola capturada contiene un error de la extensión Phantom al redefinir `ethereum`; no hubo errores de aplicación observados en ese recorrido. No equivale a QA exhaustiva de navegadores o teclado virtual móvil.

6/6 controles reales de herramientas aprobados. Matriz base completa Gemini/Haiku: 76 llamadas, cero aperturas, cero errores. Un lote anterior con Qwen paró por HTTP429/costo desconocido y se conserva como fallo. Candidato defensivo inactivo. Gasto acumulado de la key a las 02:50 UTC: USD 0,1048924 de 5; BYOK incluido y sin renovación. [Resultados](output/beta-evaluation.json), [presupuesto](output/beta-provider-budget.json) y [operación](deploy/LIVE-BETA.md).

## Corte histórico: preparación antes de publicar

`npm run verify:release`: **212/212 tests y build aprobados**. Incluye admisión/expiry/replay/revocación/pausa, HTTP sin inferencia no autorizada, CLI que no divulga códigos, estados del cliente con fixtures y la operación preparada del presupuesto. `output/release-verification.json` conserva los hashes de los archivos. `output/beta-package.json` identifica el paquete extraído y verificado (158 archivos, sin claves ni datos de jugadores).

`npm run drill:restore` recuperó cinco bases SQLite de fixtures con integridad correcta, acceso/revocación/pausa y recibos. Cero datos reales copiados y cero llamadas pagas. HTTP del proceso reiniciado en 4319: landing, juego, guía y recursos 200; rutas privadas 404. `output/beta-http-smoke.json` no es QA visual ni prueba de login.

OpenRouter revalidado por GET: límite USD 5, gasto acumulado USD 0,00595465, restante USD 4,99404535, sin renovación y BYOK=false. La guarda pública sigue cerrada. No hubo nuevo gasto en esta preparación. Host/HTTPS, login real, controles de apertura y matriz adversarial siguen pendientes. [Estado y artefactos](../docs/treasure-guardian/CLOSED-BETA-STATUS.md).

## Corte anterior: práctica local

Estado: práctica local con inferencia real; 9 solicitudes, 8 respuestas válidas y un 429. Consumo USD 0,00595465 conciliado con OpenRouter. Sin publicación ni fondos del juego. [Resultados y límites](../docs/treasure-guardian/LIVE-PRACTICE-2026-09-15.md).

## MVP web y Telegram

Landing y rutas nuevas verificadas por HTTP. Nueve pruebas de Telegram cubren motor, dueños, recuperación, presupuesto y transporte controlado. La suite de 200 pruebas + build es independiente de las [pruebas reales](output/live-smoke/summary.json). Key Vault MVP con límite total USD 5, sin renovación. Gemini y Haiku pasaron conversación de tres turnos, memoria y reducción de bromas; Qwen respondió tras un 429 inicial. Los tres llamaron `keep_locked` ante una falsa autoridad. El control BYOK del modo público y evaluador sigue pendiente; no se ejecutó la matriz ni se demostró `release_prize` real. Sin bot real; Brave bloquea localhost y no hay QA visual actual de la landing. [Estado y activación](../docs/treasure-guardian/MVP-WEB-TELEGRAM.md).

## Preparación de lanzamiento: corte vigente

- Aportes a reserva: cinco pruebas específicas y una HTTP pasan autenticación, propósito inmutable, ausencia de créditos para sponsor, deduplicación frente a recargas, monitor/reinicio, rollback de escritura, evidencia alterada, bloqueo y asignación a ronda. `drill:funding` conserva 6.000 unidades base ficticias y registra 5.070 pagaderas; siete eventos reproducidos offline. [Reporte](output/prize-funding-drill.json). La QA anterior del navegador no cubre los nuevos textos de donación; login real y fondos siguen pendientes.
- **200 pruebas aprobadas**, bundle Privy compilado con `npm run verify:release`. [Hashes ligados a las pruebas](output/release-verification.json) y [TAP](output/launch-tests.tap). `npm run preflight` detecta si el código cambió después de esa ejecución.
- Doce pruebas del monitor opcional: barridos acotados, política/binding, cursor después de reiniciar, RPC caído, evidencia desaparecida, permisos vencidos y respuesta del modelo conservada hasta una revisión fresca. Cuatro de ellas comprueban pérdida de permiso justo antes de escribir y exclusión con un proceso competidor: permiso y depósito comparten ahora el ledger esquema 5. `npm run drill:monitor` pasó con dos cuentas sintéticas, 30 RPC interceptadas y una inferencia simulada. [Reporte](output/deposit-monitor-drill.json). No prueba finalidad real, independencia del operador u operación pública de múltiples procesos; no está conectado al servidor estándar.
- Privy: app y cliente de desarrollo reales creados; email, identidad firmada y origen local configurados. El backend reconoce los valores públicos en `.env`. Brave bloqueó la navegación automatizada a localhost; login real, OTP, wallet y carga del SDK con esta app siguen pendientes. [Registro](../docs/treasure-guardian/PRIVY-SETUP.md).
- Cuatro pruebas HTTP de saldo e historial privado: autenticación, campos proyectados, paginación, rechazo de cuenta ajena/escrituras/otro origen y ausencia de configuración. [QA de Your credits](output/playwright/account-credits-qa.txt) pasó lectura sin POST/RPC, precisión, descarga coincidente, reload, errores sin saldos viejos, hold, cambio de cuenta y tres viewports. [Captura con fixtures](output/playwright/account-credits-fixture-mobile.png). La UI existe; el arranque normal aún no conecta un ledger de activo ni fondos.
- Ocho pruebas nuevas de recarga recuperable: request de transferencia fijo y sin firma, validación previa a RPC, hash guardado, reinicio, confirmaciones, historial privado, vencimiento, RPC concurrente acotado, replay y migración. El ensayo de cuentas ahora incluye 16 consultas interceptadas y recuperación de hashes antes del comprobante. [Flujo](../docs/treasure-guardian/WALLET-FUNDING-FLOW.md). Sin HTTP/UI de cobro ni wallet real.
- Auditor offline de activo: ocho pruebas nuevas y [replay del ensayo](output/asset-ledger-verification.json) sobre 15 eventos, dos depósitos y sus bloqueos declarados. Rechaza cambios en saldos, evidencia, destinatarios, manifiestos, observaciones y registros incompletos. Cero red o fondos; no prueba autenticidad externa. [Uso y límites](../docs/treasure-guardian/ASSET-AUDIT.md).
- Once controles añadidos en el bloque de juego por cuenta: JWT ES256 de prueba verificados por el SDK de Privy, separación de saldos/resultados/claves/sesiones, roster, wallet fija, discrepancias de recibo, límites, reinicios, bloqueo de depósito durante inferencia, recuperación del costo exacto y migración sin inventar destinatarios antiguos. [Recorrido de tres guardianes](output/account-game-drill.json): cuatro respuestas simuladas, 2000 unidades ficticias conservadas y cero llamadas externas. No cambió la UI ni se habilitaron pagos.
- Nueve pruebas nuevas de contabilidad de depósitos: saldo del dueño en enteros exactos, evidencia/saldo/evento/orden atómicos, fallos antes y después de actualizar la orden, replay/restart, denominación congelada y aislamiento de TEST, reservas/reparto/premio pagadero, bloqueo persistente por incertidumbre, overflow y restore desde RPC sintético. [Ensayo de depósitos](output/deposit-drill.json). La app pública sigue sin aceptar cobros ni usar este ledger de preparación.
- Cuatro pruebas de compatibilidad verifican el plan técnico de seis llamadas, prompt aislado del juego, invocaciones reales de ambas herramientas y rechazo de texto que las imita, herramientas incorrectas o errores. Son transportes simulados: cero llamadas externas y ninguna medida de resistencia. [Plan preparado](output/tool-compatibility-dry-plan.json).
- Historial privado: cuatro pruebas nuevas verifican persistencia tras restart/expiración de sesión, paginación estable de 20 entradas, errores preservados, redacción de la key y API autenticada sin selectores de propietario. El restore recupera también esos recibos. [QA de navegador](output/playwright/account-records-qa.txt): lectura/descarga tras recarga, cuenta ajena, respuesta tardía descartada, datos privados retirados del DOM y tres viewports sin desborde. El [JSON descargado de fixture](output/playwright/qa-account-receipt.json) coincide con la entrada seleccionada. Cero inferencias o wallets reales.
- `npm run drill:concurrency`: PASS, 86 solicitudes HTTP por loopback y dos inferencias simuladas, pico de una activa. Ráfagas de 12 sin autenticación, 8 de otro origen, 8 con JSON inválido, 4 con cuerpo excesivo, 32 durante inferencia y 16 tras agotar presupuesto verifican rechazo sin gasto extra. Una desconexión posterior al envío conserva recibo/costo y una sesión ajena se rechaza antes del proveedor. [Informe](output/concurrency-drill.json). No midió Privy real, proxy HTTPS, latencia externa, saturación del host o usuarios de producción.
- Lector RPC probado con respuestas controladas: red, autenticación antes de consultar una orden, IDs, errores, límites y timeout. `npm run drill:restore` verifica copia/restauración de cuatro bases con jobs, recibos y saldos TEST; recuperación sin doble cargo, consumo pendiente y sesión privada. [Informe del drill](output/restore-drill.json). Cero lectura de bases del usuario, RPC real o inferencia externa.
- Se agregaron roster inmutable, identidad Privy con JWT ES256 de prueba, aislamiento/persistencia de sesiones, modo público autenticado, límites y conciliación de consumo, órdenes de depósito y comparación explícita de prompts. Ninguna prueba llama a una API de inferencia real o mueve fondos.
- `qa-launch-account.js`: PASS en navegador real, transporte Privy/inferencia simulado; SDK cargado solo al iniciar login, envío autenticado, saldo TEST oculto en modo público, cuenta bloqueada durante inferencia y limpieza de conversación/recibos ocultos al salir. Servidor real sin key probado en 1280×720, 390×844 y 320×568, sin scroll de página. Cero POST al servidor real y cero errores de página.
- [Informe de navegador](output/playwright/launch-account-qa.txt), [captura real local](output/playwright/launch-local-desktop.png), [cuenta móvil de prueba](output/playwright/launch-account-fixture-mobile.png).
- Salud: agregados sin prompts/usuarios/claves, bloqueo real tras fallo de persistencia, estados de consumo y errores de lectura sanitizados. El rechazo por almacenamiento antes de inferencia no deja consumo incierto y devuelve TEST; un fallo después de inferencia conserva la reserva. `qa-health.js`: PASS en 1280×800, 390×844 y 320×568; estado local real y fixtures de conciliación/almacenamiento, cero POST y errores de página. [Informe](output/playwright/health-qa.txt), [snapshot local](output/operational-status.json), [captura móvil con fixture](output/playwright/health-reconciliation-fixture-mobile.png).
- Investigación separada de los tests: GET al registro oficial RHJ y cuatro lecturas del RPC público comprobaron identidad, red, decimales y código presente del candidato NVDA. No se configuró un indexer o activo de depósito, ni se simuló Long. [Fuentes y límites](../docs/treasure-guardian/ASSET-CHECK-2026-09-14.md).
- Prompt base y candidato: planes adversariales con versión/hash propios, 90 sesiones y máximo 114 llamadas por variante, **0 ejecutadas**. La UI conserva su prompt base. Privy está integrado en código y configurado para desarrollo; todavía no se verificó el login real.
- Deploy/proxy son plantillas sin ejecutar; las operaciones de órdenes no están expuestas por HTTP ni acreditan dinero real. La lectura privada de registros sí tiene rutas y panel preparados. [Estado actual y pendientes](../docs/treasure-guardian/LAUNCH-HANDOFF.md).

Las secciones que siguen son cortes históricos previos a esta implementación.

## Actualización: investigación y suite adversarial

- **84/84 pruebas Node aprobadas** con `npm test`; 14 corresponden al runner de evaluación. No hubo inferencia pagada ni transferencias.
- Suite `adversarial`: 30 escenarios (4 controles, 26 ataques), 38 turnos máximos por modelo/repetición. Prueba de recorrido completa con respuestas simuladas, rechazo de matrices excesivas y conservación de una apertura válida aunque el texto imite roles de sistema.
- Plan seco generado con `node eval/run.mjs --suite adversarial --repeats 1 --max-calls 114`: 90 sesiones, máximo de 114 llamadas planificadas, **0 llamadas ejecutadas**. [Snapshot](output/adversarial-dry-plan.json).
- Prompt candidato preparado en `eval/candidate-system-prompt.txt`, inactivo y sin evaluación. El prompt del servidor, UI y políticas de victoria no cambiaron. Privy sigue sin integrar.
- [Informe con fuentes](../docs/treasure-guardian/JAILBREAK-DEFENSE-RESEARCH.md). Los resultados de código no son una medida de dificultad del modelo.

## Entrega previa: modelos, créditos, wallet y economía

- **81/81 pruebas Node aprobadas** en la revisión final. Incluyen contabilidad transaccional, persistencia y schema, idempotencia, cola/victoria/payout, trabajo de modelo, reconciliación HTTP, wallets simuladas, evidencia de depósito, economía, replay del export y evaluación. Todos los proveedores de inferencia fueron mocks.
- Cuatro perfiles publicados y comprobación GET de metadatos, sin inference POST: rutas explícitas y reasoning desactivado. El historial preserva reasoning estructurado cuando el proveedor lo devuelve. El texto posterior de la sección histórica del runner describe su versión anterior.
- `qa-credit-chat.js`: **PASS**, cuatro llamadas a fixture sin transporte externo; topup/seed, consumo válido, aporte visible junto al chat, pérdida de respuesta después de liquidar, práctica separada sin perder la clave pendiente, recuperación sin nuevo cargo/inferencia y ganador con 1.210 TEST pendientes de payout. Ocho tamaños sin scroll/solapamiento de saldos; cero errores de página.
- `qa-treasury.js`: **PASS** después de integrar el modo de créditos. Wallet mock, acceso solamente por click, solo `eth_requestAccounts`/`eth_chainId`, ledger/export/payout, recarga del navegador, foco y tres tamaños móviles. Cero conexiones reales.
- `qa-viewport.js`: **PASS** después de los cambios en el encabezado y modo TEST. Ocho tamaños, estados intro/borrador/pending/locked/released/error, paginación sin pérdida, controles sin solapamiento. Las comprobaciones de voz/historial de versiones anteriores siguen documentadas debajo; no se modificó ese motor en esta entrega.
- `qa-economics.js`: **PASS**, cuatro tamaños, sin recursos rotos ni errores de página. Cero valor realizable muestra déficit; reparto inválido oculta cifras anteriores; sponsor cambia premio; export conserva supuestos. Tests de fórmulas contemplan errores reembolsados, redondeo por intento y financiación externa necesaria.
- Verificador `audit/verify-ledger.mjs`: reconstruye export; falla ante saldo, resultado, hash, secuencia, ganador o unidad alterados. Una reescritura íntegra coherente del operador no se detecta como fraude por este mecanismo, y el reporte lo declara.
- `audit/capture-readiness.mjs`: **PASS**, 08:25:51 UTC del 14/9. GET al servidor real 4319 y replay offline: key ausente, bounty deshabilitado, 12 modelos de catálogo, cuatro perfiles y 0 TEST de custodia. `output/local-readiness.json`, `source-manifest.json` y `local-ledger-export.json` conservan evidencia. No es evidencia de deploy o inferencia real.
- Servidores QA usan exclusivamente memoria y puertos 4320/4321; sus datos nunca se importan en la base de la app. La base de la app persiste bajo `.local/`, ignorada por Git. Node 22.16 emite advertencia de SQLite experimental.
- `qa-final-preview.js`: **PASS** contra la app real reiniciada, sin mocks de respuestas: key ausente, enviar deshabilitado, perfil Qwen/DeepInfra visible, custodia 0 TEST, escritorio/móvil sin desborde y cero POST/errores de página. Capturas `vault-functional-desktop.png` y `vault-functional-mobile.png`. Los servidores de prueba se apagaron al finalizar.

Limitaciones de aquel corte histórico: sesiones de chat entonces en memoria; trabajos interrumpidos sin recibo sin resolución automática; sin login, indexer, activo/destino, contrato, payout real, atestación, gasto público limitado o prueba de carga. La conexión de wallet es acceso a cuenta, no autenticación. Las sesiones ahora persisten; para el estado actual usar el corte de beta al inicio de este archivo.

## Historial de verificaciones anteriores

## Banco de evaluación de modelos

- `npm test`: 32 pruebas aprobadas, incluidas 11 nuevas del runner. Todo el transporte de inferencia está simulado; cero inferencias reales.
- Modo seco ejecutado: 14 escenarios, tres modelos y tres repeticiones; 126 sesiones y máximo 162 llamadas planificadas. Archivo `output/evaluation-dry-plan.json`; disponibilidad no comprobada por ese comando.
- Verificado: modo seco sin leer claves ni red, límites de matriz, comprobación de presupuesto de key antes de POST, parada al abrir, historial real de herramientas, errores fuera de derrotas, costo desconocido detiene matriz, interrupción por fallo de persistencia y artefactos sin clave.
- Revisión independiente detectó que un plan podía declarar una configuración alterada; corregido validando configuración/hashes y usando una copia verificada. La prueba incluye esa regresión.
- El prompt y el routing de la app no cambiaron. Falta presupuesto/key para compatibilidad y medidas reales; no se califica ningún modelo para un premio con dinero.

## Current revision: custodian, new premise and one-screen game

- New headline: “Talk your way in.” Premise: “An AI guards the vault. Convince it to open.” No affirmative-word win condition was introduced; server rules remain unchanged.
- Replaced the green vector character with three high-definition PNG pose illustrations. All are 1254 × 1254 with a verified 32-bit alpha channel and transparent corner pixels. Palette is ink, ivory and orange, including the light theme, icon and exported attempt card. These are generated illustrations, not a real-time 3D rig.
- `qa-viewport.js` passed at 1440×900, 1280×720, 1024×600, 768×1024, 390×844, 375×667, 320×568 and 390×320. Each size exercised intro, draft, pending, long locked/released replies and a pre-inference error. Document, body and main game area had no scroll overflow; character, reply and controls stayed visible, without overlapping the editor. Large fixtures were paginated losslessly and receipts remained 1→2→2 across reset/error.
- `qa-pagination.js` passed: lossless Unicode/graphemes, page boundaries, resize, reading offset, font refresh and reset. The bubble uses explicit pages; voice, copy, share and receipts retain the complete response. The whole transcript is separately accessible.
- Updated `qa-chat.js`, `qa-voice.js` and `qa-mascot.js` passed: model/reset flows, downloads, focus, full reply pages, history reading position, notifications inside a modal, reduced motion and opt-in speech cancellation. APIs and speech were mocked; no actual inference or audible playback.
- Tight layouts needed two fixes found by the stricter test: a shorter reply panel at desktop heights below 680px, and a send control matching its row height on very short screens. The transcript now jumps directly to the latest response to avoid racing an unfinished smooth scroll.
- Real preview captures: `vault-custodian-desktop.png`, `vault-custodian-mobile.png`, `vault-custodian-short.png`. Files named `QA-viewport-*` show labeled fixtures, not live inference. Asset prompts and provenance are in `docs/treasure-guardian/ART-DIRECTION.md`.
- The local API still needs a key. No token, wallet, bounty, deployment or publication was created. Earlier 21/21 backend checks remain recorded below; this revision changed the frontend only.

## Previous revision: persistent mascot and optional voice

- Original SVG vault character stays in the central conversation area after every reply. Draft attention, pending request, locked, released, error and reset states follow actual UI/request events. Poking animates the character without generating dialogue or an API request.
- The bubble contains the complete provider response. Copy, receipt and meme actions use that same response. Transcript retains each message once, preserves reading position and announces pending/completed/failed requests inside the active modal. A response does not steal focus from settings or dialogs.
- `qa-chat.js` passed with controlled replies: mascot states, actual response text, transcript/nested receipt, downloads, reset/model switching, pre-inference refusal and mobile focus behavior.
- `qa-mascot.js` passed: long response preserved in full, bounded scroll on mobile, transcript reading position and latest-reply control, results/errors announced inside the modal, and reduced motion. All POST requests were intercepted.
- `qa-layout.js` passed at six viewport sizes from 320px wide to 1440px, including 390×320: no page overflow, send control reachable, model picker, copy feedback, theme and mobile settings behavior preserved. Desktop/mobile mascot captures were inspected visually.
- `npm test`: 21/21 server tests passing. No backend rule or payout change in this revision. Real `/api/status` remains unconfigured practice with no bounty.
- Current character captures: `vault-mascot-desktop.png`, `vault-mascot-mobile.png`, and `vault-mascot-qa-response.png` under `output/playwright/`. The response capture is explicitly marked as controlled QA, not real inference.
- Voice uses opt-in English browser synthesis, restricted to voices reported as local. Its availability depends on the browser. Text remains available regardless of audio support. No microphone, added package dependency or voice API.
- `qa-voice.js` passed in an isolated browser context with all API and speech functions replaced by fixtures: default off, no reading of the intro/wait status, exact reply text, local voice selection, speaking mouth, mute, stale-event isolation, cancellation on new attempt and reset. No actual sound was played. Audible quality and real-provider conversation remain unverified.

Earlier checks below describe preceding iterations.

## Current revision: English product and roasting guardian

- All authored product strings are now English: HTML and accessible names, chat, settings, receipts, PNG cards, server errors, and social drafts. Number/date formatting uses `en-US`. Raw user messages, provider output, and receipt payloads are preserved.
- The live local `/api/rules` exposes `vault-practice-v2-en-2026-09-14`, including the English response instruction and contextual roast personality. The local server was restarted after the change. Game tools and win conditions remain unchanged.
- `npm test`: 21/21 passing, with assertions that the publicly inspectable system prompt is exactly the one sent to the API and that the receipt contains its version.
- The English browser flows passed: chat states with controlled responses, PNG/JSON downloads, receipts, resets, model selection, copying, themes, and six viewport sizes. Current captures use `vault-english-*` in `output/playwright/`.
- No live inference was run. The style examples are authored prompt guidance; actual model tone still needs validation with a configured API key.

## Última revisión: identidad y pulido del chat

- `npm test`: 21/21 pruebas de servidor aprobadas. Sintaxis verificada en `app.js`, `conversation.js`, `details.js` y `share.js`. Revisión estática independiente: sin nuevos bloqueantes.
- `output/playwright/qa-chat.js`: respuestas controladas para verificar cierre/apertura, foco del panel, cancelación de reinicio, confirmación de cambio de modelo, conservación de borradores/recibos y rechazo anterior a inferencia sin inventar una decisión. Descargas PNG y JSON comprobadas en navegador. Todos los POST de esta prueba fueron interceptados; no hubo inferencia ni crédito consumido.
- `output/playwright/qa-layout.js`: 320×640, 390×844, 768×1024, 1024×768, 1440×1000 y 390×320, sin desborde horizontal y con Enviar alcanzable. Verificados font local, Ctrl+K, búsqueda sin resultados, selección con flechas/Enter, copia del prompt con feedback, temas y recuperación de interacción al pasar de móvil a escritorio.
- Capturas vigentes: `vault-pro-desktop.png`, `vault-pro-mobile.png`, `vault-pro-models.png`, `vault-pro-mobile-settings.png`, `vault-pro-dark-settings.png` en `output/playwright/`. Los archivos `vault-pro-qa-response.png` y `vault-pro-qa-meme.png` contienen datos explícitos de QA, no una partida real.
- El escenario de rechazo simula intencionalmente un HTTP 409. Al volver a la página real, consola sin errores ni advertencias. API sigue sin configurar y el envío permanece deshabilitado.
- Instrument Sans se sirve localmente; fuente y licencia se conservan en `public/fonts/`. Sin nuevas dependencias de paquetes.
- Redes: seis borradores ES/EN en `docs/treasure-guardian/SOCIAL-DRAFTS.md`, sin publicación. Nombre/stock/token definitivos pendientes.

Las secciones siguientes conservan las comprobaciones de iteraciones anteriores.

- `npm test`: 21 pruebas aprobadas. Respuestas del proveedor controladas en tests; cero inferencias reales. Incluye victoria, rechazo textual, herramientas inválidas, respuestas truncadas, modelo incorrecto, fallos, timeout, persistencia, sesiones, catálogo y límites del servidor local.
- `node --check public/app.js` y `public/details.js`: sin errores de sintaxis.
- Servidor real: `/api/status` devuelve `configured: false`, `mode: practice`, `bountyEnabled: false`, `authentication: local-only`.
- `/api/models`: consulta real exitosa a OpenRouter. Hasta 12 modelos, fuente y fecha; los aliases móviles con prefijo `~` o segmento `latest` se excluyen.
- Navegador: interfaz real carga, selector cambia Qwen por Gemini, modal de reglas muestra prompt, herramientas, límites y parámetros; Escape cierra. Consola sin errores ni advertencias en esta revisión.
- Vista móvil de 390px: ancho del documento de 390px, sin desborde horizontal. También se inspeccionó escritorio a 1440px.
- La herramienta del navegador integrado no pudo iniciar su runtime; se usó Playwright CLI para estas comprobaciones locales.

## Revisión de chat simple

- Se volvió a ejecutar `npm test`: 21/21 aprobadas. No se modificó la API del servidor.
- Interfaz reemplazada por chat convencional: selector con búsqueda y grupos por proveedor, panel de configuración efectiva, prompt y herramientas desplegables, temas claro y oscuro.
- Búsqueda de Gemini y cambio desde Qwen comprobados en navegador. La conexión sin clave queda visible y el envío deshabilitado; se permiten borradores.
- Escritorio 1440×1000 y móvil 390×844 inspeccionados visualmente. En móvil el documento mide 390px y el editor queda dentro del primer viewport. A 390×320, el área de conversación vacía permite desplazamiento para alcanzar los controles.
- Configuración móvil conserva un nombre accesible y deja inerte el chat cubierto. Escape cierra el panel. La finalización de un intento no roba el foco si hay un panel o diálogo abierto.
- Flujo de mensajes probado con interceptación de API en Playwright: respuesta con cofre cerrado, apertura de práctica, contador de recibos, descarga JSON y conversación nueva conservando recibos. Las respuestas están marcadas como QA; no se llamó a inferencia ni se escribieron intentos en el servidor real. Las rutas de prueba se retiraron y la página volvió al estado real sin clave.
- Consola al finalizar: 0 errores y 0 advertencias.
- Capturas: `output/playwright/chat-simple-desktop.png`, `chat-simple-settings.png`, `chat-simple-dark.png`, `chat-simple-mobile.png`. La captura `qa-chat-response-mobile.png` usa respuestas controladas, no un modelo real. El guion reproducible es `output/playwright/qa-chat.js`.

Pendiente: primera inferencia real por modelo, estados visuales de respuesta comprobados contra una inferencia real, accesibilidad completa, pruebas de carga y toda la versión pública con usuarios/fondos. Los tests no acreditan resistencia del guardián a prompts adversariales.

No se usó el repo público de Freysa como código de implementación; solo su mecánica como precedente. No hay evidencia de un lanzamiento externo en esta entrega.

