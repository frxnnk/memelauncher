# Cerrar el circuito de la beta web

## Alcance autorizado

Primero completar la beta web con AMZN de prueba en Robinhood Chain Testnet, usando el saldo existente de 0,1. No habilitar fondos reales ni payouts. Conservar ledger, reservas y recibos; no inventar costos ni volver a enviar solicitudes inciertas.

## Plan y revisión

1. Investigar la generación de Gemini que terminó en error sin costo. Reconciliar sólo con evidencia de OpenRouter y guardar su procedencia. Verificar que el desbloqueo no altere créditos ni límites del proveedor.
2. Ejecutar un intento válido con Haiku y comprobar saldo consumido, bounty de 0,07 y reparto del resto en el ledger.
3. Verificar idempotencia y recuperación con las pruebas existentes y reproducción del depósito ya confirmado, sin firmar otra transferencia.
4. Mejorar las instrucciones de Testnet Mode, el estado visible al esperar Phantom, órdenes vencidas y errores del proveedor. Revisar en mobile.
5. Correr verificaciones pertinentes, revisar los cambios y publicar sólo los componentes necesarios. Cualquier actualización del backend financiado debe conservar todas las bases actuales y detener el servicio durante copia/verificación.

## Decisiones de producto pendientes, propuestas por el usuario

- Custodia lo más transparente posible. Propuesta: multisig de dos firmas, usuario + agente, para impedir retiros unilaterales del usuario.
- Evaluar quién genera y controla la clave del agente, dónde se ejecuta la política, cómo se cambian sus reglas y qué sucede ante fallos. Dos direcciones controladas por el mismo operador no prueban independencia.
- Pagar el premio a la wallet vinculada del jugador, con vinculación y dirección comprometidas antes del intento.
- Evitar vaciar el treasury: reserva mínima que permita continuar el juego; distinguir tesorería, créditos no consumidos, premios comprometidos y bounty disponible.
- Evaluar precio de intento creciente según bounty. No implementar una fórmula antes de definir límites y términos públicos por ronda.

Estas propuestas no son mecanismos ya construidos ni reglas económicas aprobadas. Se diseñarán después de cerrar el circuito actual.

## Cierre verificado, 2026-09-15 aproximadamente 07:11 UTC

El usuario liberó Brave. Se completó la revisión autenticada en 390×844 y 360×740: instrucciones de Phantom, recarga, recuperación, custodia y selector de modelos. La orden acreditada se volvió a comprobar desde la web sin firma ni transferencia nueva. Se detectó y corrigió que el precio estaba oculto junto al contador en mobile: ahora figura debajo del composer, visible en ambos tamaños y sin scroll de la pantalla principal. Frontend final `dpl_FD83g1ibTT5ABfEjxNn9Ggppq5AE`, 12 archivos publicados coinciden por hash, backend sin cambios, 242 pruebas y build pasaron.

Auditoría del objetivo: costo pendiente resuelto con evidencia y recibo conservado; intento Haiku válido y reparto 0,07/0,02/0,01 verificados; replay aislado sin duplicaciones más recheck real de la orden; instrucciones/errores y UI mobile revisados; fondos reales y payouts deshabilitados; propuestas de multisig, wallet premiada, reserva y precio variable registradas arriba sin implementarlas. Ledger vivo comprobado nuevamente a las 07:09 UTC: balanceado, 12 eventos, un depósito acreditado y saldos sin cambios. El tamaño del navegador se restauró.

Límite de esta validación: emulación responsive en Brave, no firma desde un teléfono físico. Se observó un error de inyección de la extensión Phantom; no se pidió una nueva firma. Evidencia detallada: `vault-lab/output/mobile-circuit-review-20260915.json`. Los pendientes mobile de las notas cronológicas siguientes quedan resueltos por este cierre.

## Resultado del trabajo, 2026-09-15 06:55 UTC

- OpenRouter reconciliado con la política publicada de zero completion insurance y consumo de clave sin cambios. Recibo original conservado. Los errores ambiguos siguen bloqueando nuevas llamadas.
- Haiku respondió `locked` con recibo `fc156278-9597-4db3-b34b-28cbe527906c`. Se consumieron los 0,1 créditos existentes: bounty 0,07; operaciones 0,02; próxima ronda 0,01. La tesorería conserva 0,1 AMZN on-chain y el ledger está balanceado.
- Backend `6ea42baf2d4d`, frontend `dpl_3bD68BruUgMXvJcwZRLn6jgzh8f5`, desplegados y verificados por hashes/health. Siete bases preservadas; no cambiaron términos, asset ni límites.
- 242 pruebas y build; drills de concurrencia, depósito y juego autenticado pasaron. Una copia aislada del backup real soportó dos replays del intento y dos verificaciones del depósito sin cambios de saldos, eventos nuevos ni inferencias.
- UI publicada: instrucciones de Phantom, estado de espera de wallet y confirmaciones de red, mensaje de preflight que distingue no enviado de resultado incierto, controles mobile de 44 px e inputs de 16 px, importes del recibo en tokens legibles. Se exige que el gesto empiece en el backdrop para cerrar un modal, evitando que el clic de apertura lo cierre.
- Pendiente: completar la verificación visual de la versión publicada en viewport 390×844. Brave bloqueó la automatización porque otra extensión tiene una ventana abierta. Se pidió al usuario cerrar esa ventana; no se intentó eludir el bloqueo. No hace falta firmar ni recargar tokens.

Evidencias: `vault-lab/output/live-circuit-20260915.json`, `vault-lab/output/circuit-replay-20260915.json`, `vault-lab/output/usage-policy-recovery-20260915.json`, `vault-lab/output/backend-circuit-upgrade-20260915.json`, `vault-lab/output/robinhood-web-deployment.json`. Estado operativo completo en `vault-lab/deploy/LIVE-BETA.md`.

Continuación: corregida la revisión de órdenes vencidas sin envío. Se retira la orden local sólo si está acreditada o venció sin hash registrado y su estado era preparado; una nueva orden exige otro clic explícito. Confirm no aparece para órdenes vencidas/acreditadas/con transferencia registrada, y el controlador también las rechaza antes de llamar a la wallet. Dos regresiones añadidas; 242 pruebas y build pasaron. Frontend `dpl_3bD68BruUgMXvJcwZRLn6jgzh8f5` publicado. El bloqueo de Brave se volvió a comprobar y continúa; revisión visual mobile pendiente, sin nuevos envíos ni inferencias.
