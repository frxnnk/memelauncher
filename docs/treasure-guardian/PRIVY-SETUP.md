# Privy configurado para desarrollo

**Actualización 15/09/2026 UTC:** `https://vault-closed-beta.vercel.app` agregado a los orígenes de app y cliente, conservando localhost; cambios guardados y recargados en el dashboard. El dueño completó login real por email, canjeó su invitación y restauró la misma sesión después de recargar. [Evidencia de beta](CLOSED-BETA-STATUS.md). Continúa en modo desarrollo, sin wallets automáticas, sin firma ni plan pago. El inventario siguiente documenta la configuración inicial.

14/09/2026. La pestaña autenticada de Brave permitió crear **Vault** en la organización visible `vaulthood`, en modo desarrollo. El dashboard indica hasta 150 usuarios y uso para pruebas; no se cambió a producción ni se contrató un plan.

| Configuración observada | Resultado |
|---|---|
| App ID público | `cmu1sjit800710bl1fohjv3ju` |
| Cliente web | `Vault local development` |
| Client ID público | `client-WY6dn5zzZ6rh8Rp6zEbjCAfxb4MELrESnszD6erMDU86L` |
| Origen del cliente y de la app | `http://127.0.0.1:4319` |
| Email | Habilitado |
| Return user data in an identity token | Habilitado |
| Creación automática de wallets al login | Deshabilitada |
| Smart wallets, CLI/agent access, test accounts | Deshabilitados |
| Desactivar confirmaciones de transacciones | Deshabilitado; no se retiraron confirmaciones |
| Cookies del cliente | Deshabilitadas en esta integración local |

App ID, Client ID y clave pública EC P-256 se copiaron a `vault-lab/.env`, excluido de Git. El servidor se reinició con `npm start` y `/api/auth/config` devuelve `configured: true` para estos IDs. Una consulta pública GET al JWKS del emisor confirmó que la clave local coincide con exactamente una clave publicada por Privy para esta app. [Comprobante de configuración](../../vault-lab/output/privy-setup-check.json). No se copió, reveló ni utilizó el App Secret que el dashboard muestra enmascarado. No hay una API key de inferencia configurada.

[App en Privy](https://dashboard.privy.io/apps/cmu1sjit800710bl1fohjv3ju/settings), [cliente](https://dashboard.privy.io/apps/cmu1sjit800710bl1fohjv3ju/app-client/wl8dhng6hya0o5e9gowpmmbdi). Estos enlaces requieren la cuenta del dueño. El estado del dashboard es evidencia de configuración, no de login o wallet verificados.

## Verificación que falta

El acceso automatizado de Brave a `http://127.0.0.1:4319` devolvió `ERR_BLOCKED_BY_CLIENT`. No se cambió ninguna protección para sortearlo. Se pidió al usuario abrir Vault y completar el login manualmente, sin compartir códigos. La cuenta está dentro del botón **Wallet and treasury**, sección **Your account / Privy**.

Todavía no se verificaron con la app real la entrega OTP, la respuesta firmada aceptada por el backend, la recuperación de sesión, el iframe de wallet o la creación de wallet. Los tests de autenticación usan claves ES256 generadas para fixtures. El bundle está compilado; su carga real con esta app sigue pendiente.

El cliente actual usa almacenamiento local y `cookieWriteBehavior: never`. Antes de fondos públicos hay que resolver la protección de sesión/wallet en HTTPS, revisar cookies seguras y CSP contra el flujo real. El dashboard advierte que sin aislamiento por cookies un token puede permitir acceso a la wallet. Esta configuración de desarrollo no declara resuelta esa frontera.

No se crearon wallets, firmaron mensajes/transacciones, habilitaron cobros, asignaron operadores de fondos ni desplegó la app. La selección de red/token, proveedor de modelos y autoridad del premio sigue pendiente.
