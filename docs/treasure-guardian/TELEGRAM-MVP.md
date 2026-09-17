# Telegram MVP

Implementación local, aún sin bot/token ni mensaje real. No usa la cuenta personal de Telegram del fundador.

## Activación

Crear un bot siguiendo el flujo oficial de [BotFather](https://core.telegram.org/bots/tutorial#obtain-your-bot-token). Guardar el token exclusivamente en el `.env` privado del host de Vault. El proceso ya debe estar configurado en `public-practice`, con Privy y una key de OpenRouter cuyo presupuesto finito se verifica al arrancar.

```dotenv
VAULT_TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=TOKEN_PRIVADO
TELEGRAM_MODEL_ID=google/gemini-2.5-flash
```

Reiniciar el único proceso `npm start`. `getMe` verifica la identidad del bot antes de leer mensajes; la landing muestra el enlace `t.me` solamente cuando el worker está corriendo. No configurar webhook ni ejecutar un segundo consumidor de updates. El worker no borra un webhook existente: si lo hubiera, detenerse y revisar el bot correcto con su operador.

La integración usa [getUpdates y sendMessage](https://core.telegram.org/bots/api#getupdates) de la Bot API, con long polling, texto plano, mensajes divididos y sin anuncios pagos. No registra tokens ni URLs que los contienen. Los plazos de espera son acotados; los mensajes del proveedor y las acciones de Telegram no tienen reintento automático.

## Experiencia

- `/start`, `/help`: objetivo, límites y comandos.
- `/models`: catálogo permitido; `/model <id>` selecciona el identificador exacto e inicia una conversación nueva.
- `/new`: empezar de nuevo. No devuelve consumo ni borra recibos.
- `/last`: recuperar la última respuesta/estado guardado sin volver a consultar al modelo.
- `/receipt`: metadatos del último resultado: ID, modelo, proveedor, configuración, uso y decisión. No es una exportación del recibo completo.
- `/rules`: prompt y regla de victoria públicos.
- Mensaje normal: argumento de hasta 2.000 caracteres. El modelo solo gana/retiene según el motor validado del juego; ninguna frase del adaptador elige el ganador.

Solo se admiten mensajes de texto privados de usuarios humanos con `chat.id === from.id`. Se ignoran grupos, canales, ediciones, adjuntos y mensajes vía otros bots. Los IDs de dueño se derivan del ID del bot y del usuario; no se aceptan selectores de sesión o dueño en el texto. Las cuentas de Telegram y Privy son distintas: no comparten historial, wallet ni créditos. Sí comparten la reserva global y el presupuesto del proveedor. Las cuotas por usuario corresponden a identidades de canal, no a una persona verificada entre canales.

## Persistencia y fallos

`telegram.sqlite` guarda IDs procesados, cursor, perfil de sesión y respuesta. La identidad de un update se reclama antes de llamar al modelo; el resultado se guarda antes de enviarlo. Si cae la entrega, el bot se detiene y retira su enlace activo. Tras revisar el problema y reiniciar, `/last` recupera la respuesta sin una segunda inferencia. Una caída antes de guardar el resultado puede dejarlo sin respuesta recuperable en el bot; no se inventa un resultado. El recibo del motor y su reserva permiten investigar/conciliar el consumo.

Una reserva pendiente o costo desconocido bloquea nuevas inferencias en ambos canales. `/new` no elimina ese bloqueo. Los errores inesperados se presentan como resultado no confirmado, nunca como derrota. El proceso debe reiniciarse después de resolver una caída de red/entrega; no hay supervisor separado para el bot ni alerta externa instalada todavía. `/api/channels` permite comprobar `status` y el log avisa cuando se detiene.

Conservar la base de deduplicación durante despliegues: restaurar un backup antiguo puede olvidar updates ya procesados; la protección no pretende resolver rollback arbitrario del operador. Retención, borrado de datos y continuidad operativa deben definirse antes de invitar al público. Esta versión es práctica, sin premio monetario.

## Evidencia

`test/telegram.test.mjs`: nueve casos con el servicio de Vault y almacenamiento reales, transporte de modelos y Telegram controlado. Cubre victoria validada, reinicio tras entrega fallida, aislamiento, comandos, crash con uso pendiente, presupuesto/costo desconocido, cursor tras inactividad, secreto/redirect/texto plano e identidad/estado del worker. Suite completa: 200 pruebas + build correctos el 14/09/2026. No prueba disponibilidad de una cuenta Telegram, login Privy real ni resistencia a jailbreak de modelos reales.
