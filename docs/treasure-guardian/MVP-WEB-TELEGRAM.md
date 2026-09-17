# Vault MVP — estado y activación

**Hosting 16 Sep 2026:** Live product is Vercel. Paid-beta work does not deploy a VPS and must not SSH `C:\vault-beta`. Live `/api` remains the historical Caddy rewrite until an approved copy of `vault-lab/deploy/vercel.api-cutover.json`.

**Actualización 15/09, después de publicar:** la [beta cerrada](CLOSED-BETA-STATUS.md) ya funciona en Vercel; el `/api` verificado ese día era el rewrite a Caddy, no un VPS nuevo. Privy e invitación del dueño verificados. Tres mensajes web reales y recibos recuperados después del reinicio. Gemini/Haiku habilitados; Telegram continúa apagado hasta agregar invitaciones al bot. Lo que sigue conserva el corte histórico de preparación local.

Actualizado el 15 de septiembre de 2026, 01:14 UTC (14 de septiembre en Argentina). La prioridad actual es una versión básica de práctica. El usuario retiró por completo el límite semanal del 30%; el texto anterior del goal quedó desactualizado y no gobierna esta etapa.

## Entrega local

- Landing inglesa en `/`: papel cálido, tinta y naranja, tipografía local, protagonista metálico y humor propio. CTA a `/play`; prompt y reglas accesibles desde la landing. Las frases al tocar el personaje son copy de la landing, no inferencia.
- Juego en `/play`, con compatibilidad para `/?ui=custodian` y variantes anteriores. Acceso visible **Sign in**, selector de modelos, mascota, configuración, reglas y recibos. En modo público, se oculta el acceso duplicado de treasury y la contabilidad TEST.
- Bot privado de Telegram implementado, apagado por defecto. Reutiliza `createVaultService` y `meteredAttempt` dentro del mismo proceso Node y la misma base de consumo que la web. No suma dependencias ni necesita webhook, Redis o Docker.
- 200 pruebas y compilación: `vault-lab/output/release-verification.json`. Ese comando usa transportes simulados y no llama a inferencia. Por separado, las [primeras pruebas reales](LIVE-PRACTICE-2026-09-15.md) registran **9 solicitudes, 8 respuestas válidas, un 429 y USD 0,00595465**. Cero mensajes enviados a Telegram.
- HTTP local verificado: `/`, `/play`, variante anterior, CSS, JS, personaje, status y channels responden 200. Brave sigue mostrando `ERR_BLOCKED_BY_CLIENT`, incluso tras reiniciar el servidor y recargar. No se modificó la protección. La landing y el nuevo acceso a cuenta no tienen QA visual actual; las capturas anteriores pertenecen al juego previo.

## Activación y siguientes pruebas

1. La práctica local ya tiene inferencia real: el usuario cargó USD 10 y la key **Vault MVP** conserva su límite de USD 5 sin reinicio. Gemini, Claude y Qwen respondieron; el consumo acumulado coincide con los recibos. Gemini queda seleccionado por defecto. El presupuesto restante de la key al cierre de este lote es USD 4,99404535; el saldo de la cuenta y ese límite son conceptos separados.
2. Completar un login real con Privy y probar una conversación, cambio de modelo y lectura del recibo. La configuración de la app/cliente ya existe; los tests con identidad simulada no sustituyen esta comprobación.
3. Elegir el host y dominio público y autorizar ese despliegue concreto. No hay URL pública de esta versión todavía.
4. Para Telegram, crear un bot con BotFather y guardar su token como `TELEGRAM_BOT_TOKEN` en `.env`. No pegar secretos en el chat. Activarlo solo cuando se quiera recibir jugadores; ver [Telegram](TELEGRAM-MVP.md).

Antes del modo público también falta `include_byok_in_limit=true`: la key actual devuelve `false` y el validador conserva su rechazo. La página de edición no expone ese control. La [API oficial de actualización](https://openrouter.ai/docs/api/api-reference/api-keys/update-keys) lo admite pero requiere una clave de administración, que no se creó. No se relajó el control para sortearlo. [Verificación sin secretos](../../vault-lab/output/openrouter-setup-check.json).

Ese control también aplica al runner de evaluación; el lote local no equivale a ejecutarlo. Falta demostrar una apertura válida con su prompt permisivo y medir ataques más amplios. El dashboard BYOK mostró sin configurar los proveedores usados; las respuestas reales confirmaron `is_byok: false`.

El onboarding de OpenRouter generó inesperadamente otra **Default key** sin límite. Quedó desactivada, confirmado por la opción **Enable** en su menú; nunca se usó ni se guardó. La Default key preexistente no se modificó. Vault usa exclusivamente su key dedicada.

## Despliegue propuesto

Una sola instancia Linux con Node >=22.16, almacenamiento persistente y Caddy para HTTPS. La aplicación vive en `/opt/vault`, escucha en `127.0.0.1:4319` y se ejecuta con el usuario dedicado `vault`. Plantillas listas en `vault-lab/deploy/vault-practice.service` y `Caddyfile.example`; el dominio real todavía no está elegido. No hace falta un contenedor. No usar una función serverless con disco efímero para estas bases SQLite.

En el host elegido: instalar desde el lockfile, compilar, configurar `.env` privado, crear `.local` con permisos del usuario dedicado y validar el proxy antes de abrir el servicio. Configuración:

```dotenv
VAULT_ACCESS_MODE=public-practice
VAULT_PUBLIC_ORIGIN=https://DOMINIO_APROBADO
VAULT_BIND_ADDRESS=127.0.0.1
PORT=4319
VAULT_API_BUDGET_USD=5
VAULT_REQUESTS_PER_USER_DAY=25
VAULT_REQUESTS_PER_DAY=250
VAULT_TELEGRAM_ENABLED=false
```

Agregar ese origen HTTPS exacto en la app y el cliente de Privy. Mantener una sola instancia de servidor: web y bot comparten una reserva de inferencia global. Copiar/respaldar `.local` con el proceso detenido para incluir las bases y el JSONL consistentes; el bot suma `telegram.sqlite`. Una restauración debe contemplar también el consumo real del proveedor: nunca borrar la base de uso para aparentar presupuesto nuevo.

Antes de abrir a terceros: confirmar el tratamiento y plazo de conservación de prompts/recibos, verificar login, reglas, un intento real por canal, límites y recuperación de la respuesta; revisar `/api/health` y `/api/channels`. Los recibos son registros del operador, no prueba independiente. El estado de Telegram se publica por separado y no convierte su caída en caída del juego web.

## Docker: lo observado

La configuración `CustomWslDistroDir` apunta a `E:\DockerDesktop\DockerDesktopWSL`. Esa ruta existe; contiene `disk\docker_data.vhdx` de 92.420.440.064 bytes. La distribución `docker-desktop` también figura registrada con su ruta `main` en E:. No se observaron procesos Docker Desktop/backend en la última comprobación.

Estos datos son compatibles con un traslado de disco registrado; **no demuestran corrupción ni un motor funcional**. No se borraron, movieron ni reinicializaron discos o volúmenes. El MVP no depende de resolverlo.

## Fuera de esta primera prueba

No se activaron depósitos, recargas reales, cobros, token, sponsors reales ni payout. El trabajo de tesorería/monitoreo existente conserva su estado de preparación. Elegir el stock, lanzar en Long y resolver la autoridad del premio pertenecen a la etapa financiada, no bloquean validar ahora si el juego es divertido.

## Paquete de despliegue verificado

Continuación de las 23:24 UTC: [archivo preparado](../../vault-lab/output/vault-mvp-4c7f967218c3.tar.gz), 5.096.791 bytes, 144 archivos. SHA-256 `c425cc3b5e211bcdbeb097b16390230302484e340c0dbd29bc44485f095b01eb`. [Manifest y prueba de extracción](../../vault-lab/output/mvp-package.json).

Se comparó cada archivo extraído contra los hashes de la ejecución de 200 pruebas + build. En una carpeta temporal aislada se instalaron 42 dependencias desde el cache local de npm (`--offline --ignore-scripts`) y arrancó el servidor con un entorno sin claves. Ocho rutas respondieron 200 y un intento sin key devolvió `MISSING_API_KEY` antes de inferir. Las carpetas temporales se retiraron después de cerrar ese proceso. El servidor de desarrollo habitual sigue separado.

Incluye instrucciones portables en `deploy/README.md`, templates, fuente, cliente compilado y pruebas. Excluye `.env` real, bases, logs e instalación local de dependencias. El arranque extraído se comprobó en Windows; la plantilla de despliegue Linux sigue pendiente de un host real. El paquete no se subió a ningún proveedor. Es el corte anterior: antes del despliegue hay que regenerarlo con el nuevo orden del catálogo y metadatos v2. Bot y origen público siguen pendientes.
