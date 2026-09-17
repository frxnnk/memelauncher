# Vault: beta cerrada publicada

**Hosting 16 Sep 2026:** Live product is Vercel (`vault-closed-beta`). Paid-beta x402 and the Node `/api` cutover are Vercel project env, not a new VPS. Do not SSH or write `C:\vault-beta` from a paid-beta session. Today’s live `/api` is still the historical Caddy rewrite until the operator copies `vault-lab/deploy/vercel.api-cutover.json` and approves a deploy. [Inventario](../../vault-lab/deploy/LIVE-BETA.md).

**Actualización visual posterior:** [puerta reactiva y UI móvil](VAULT-DOOR-UI.md) publicada en `dpl_tGMXtqyEnKL37E3uHF4cWkcAS8ye`. Se sumó un intento real de Haiku: cuatro recibos web totales, dueño con 21/25 intentos al comprobarlo. El inventario y resultados siguientes conservan el corte de activación inicial; el backend sigue en `e6a7e1e9ae99`.

Corte: 15 de septiembre de 2026 UTC. **La beta funciona por la web y el dueño ya tiene acceso.** [Landing](https://vault-closed-beta.vercel.app) · [Juego](https://vault-closed-beta.vercel.app/play). No exige wallet ni depósitos y no ofrece premio monetario.

## Qué funciona

- Landing en inglés y juego sin scroll de página, con custodio animado, humor, selector de modelos, reglas, configuración y recibos.
- Login real con Privy, invitaciones individuales vinculadas a la cuenta verificada, vencimiento, revocación y pausa. La cuenta del dueño pasó de no admitida a activa al canjear su código.
- Gemini 2.5 Flash y Claude Haiku 4.5 por OpenRouter. Qwen quedó fuera de la beta después de dos HTTP429 observados; sigue disponible en el laboratorio local.
- 25 solicitudes por cuenta/día, 250 globales/día, UTC. Cambiar modelo inicia otro chat y conserva el cupo consumido. Una inferencia activa global como límite de esta primera beta.
- Tres solicitudes reales desde el navegador: Gemini una, Haiku dos. Tres respuestas válidas, costo total USD 0,0045937, cupo del dueño de 25 a 22. El segundo mensaje de Haiku recibió el contexto anterior. Su personaje desconfiado evitó repetir la frase de memoria; no se declara aprobada la recuperación literal de esa frase.
- Recibos privados recuperables después de recargar y restaurar sesión, sin otra llamada paga. El reinicio del servicio preservó los hashes exactos de sesiones y recibos.
- Seis invitaciones emitidas: dueño canjeado y cinco testers sin compartir. Códigos en [archivo privado local](../../vault-lab/.local/beta-testers.json), uno por persona; vencen el 22 de septiembre UTC. No se enviaron emails ni mensajes.

## Evidencia

| Verificación | Resultado y alcance |
|---|---|
| Pruebas y build | 212/212; [prueba ligada al código](../../vault-lab/output/release-verification.json). No generan inferencia. |
| HTTPS y acceso | Landing/juego/guía 200; secretos/base 404; POST sin auth 401; otro origen 403. [Reporte](../../vault-lab/output/beta-deployment-http.json). |
| Privy y UI real | Login, canje, tres mensajes, modelos, cupo y recibos. Juego 1536×646 y 390×844 sin scroll; Account cabe en móvil. [Registro](../../vault-lab/output/beta-browser-verification.json). |
| Persistencia real | Backup con escritor detenido; cinco SQLite íntegros; reinicio sin perder los tres recibos ni membresía. [Reporte](../../vault-lab/output/beta-live-web-verification.json). No es una restauración destructiva sobre la base viva. |
| Control de herramientas | 6/6 controles reales: abrir y cerrar con cada uno de los tres modelos, usando un prompt permisivo exclusivo de evaluación. No son jailbreaks del juego. |
| Matriz adversarial | Gemini/Haiku: 30 escenarios por modelo, 76 llamadas, cero aperturas y errores. Qwen tuvo un lote parcial con 429 conservado en la evidencia. [Resultados y límites](../../vault-lab/output/beta-evaluation.json). |
| Presupuesto | GET 02:50 UTC: USD 0,1048924 usados, 4,8951076 restantes, cap acumulado de 5 sin renovación y BYOK incluido. [Registro](../../vault-lab/output/beta-provider-budget.json). |

La matriz es estática y no demuestra invulnerabilidad ni probabilidad de victoria de jugadores. El prompt defensivo candidato sigue inactivo y sin evaluar. La dificultad se calibra después de observar esta beta, manteniendo versiones y evidencia. La API no identifica necesariamente una revisión inmutable de los pesos; un recibo del operador no es prueba independiente de ejecución.

## Dónde está

Frontend: Vercel project `vault-closed-beta`. **Live product is Vercel.** Today’s live `/api` is still the historical Caddy rewrite (`vault-beta-api.173.212.246.68.sslip.io`) until the operator copies `vault-lab/deploy/vercel.api-cutover.json` over `vercel.json` and approves a deploy. Paid-beta x402 is Vercel project env (`0xf670…7d40`); durable store is a new Turso database. Do not deploy a new VPS and do not SSH or write `C:\vault-beta` from a paid-beta session. [Inventario, pausas, invitaciones, backup y rollback](../../vault-lab/deploy/LIVE-BETA.md).

The backend archive of the still-live Caddy host is identified in [manifest desplegado](../../vault-lab/output/beta-deployed-backend-package.json). [Manifest del paquete local](../../vault-lab/output/beta-package.json) is the last prepared package, including later docs; do not confuse those versions. The repo stays local. Do not treat an SSH/VPS session as paid-beta work.

## Límites y siguiente etapa

Al recargar la página se usa **Sign in → Restore existing session**. Los recibos vuelven desde **Receipts**, pero la conversación activa no se reconstruye en pantalla y el contador del pie es de la pestaña actual. El servidor conserva los registros. La consola capturada tuvo un error de la extensión Phantom, sin error de aplicación observado en el recorrido.

Telegram tiene un motor preparado, pero no está habilitado en la beta porque le falta admisión por invitación. Wallet/recargas con token, treasury real, fees de creador, sponsors y payout verificable pertenecen a la siguiente etapa; no están funcionando como producto monetario. Nombre/token/stock siguen sin decidir. No hay afiliación con marcas de modelos o empresas cotizadas.

El anfitrión que envíe cada código recibe feedback y solicitudes de eliminación. La guía pública explica los datos guardados y que no hay borrado automático. Las invitaciones todavía no se distribuyeron. No se emitió token, movieron fondos o contrataron planes nuevos.
