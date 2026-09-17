# The Vault — núcleo local del MVP

14 de septiembre de 2026. Nombre provisional: el usuario dejó la identidad y la acción relacionada pendientes.

Chat simple con una mascota central que habla mediante una burbuja, selector de modelos, configuración en un panel lateral y acceso al prompt, las reglas y los recibos. El historial completo se abre desde Transcript. El catálogo se consulta realmente a OpenRouter. La inferencia requiere configurar una API key; no se generan conversaciones de muestra como si fueran respuestas de un modelo.

La experiencia del producto es íntegramente en inglés: interfaz, accesibilidad, errores, recibos, tarjetas y borradores para redes. El prompt público `vault-practice-v2-en-2026-09-14` instruye al guardián para responder en inglés con humor competitivo y burlas específicas al argumento. Las frases de referencia son ejemplos de estilo. El primer smoke real verificó respuestas, memoria y reducción de bromas; la dificultad todavía no está medida.

Este laboratorio permite validar el núcleo antes del lanzamiento. **No es todavía el producto público con token, cobros y bounty.** La primera implementación usa API; la autoridad sobre un premio real y las garantías contra intervención del operador siguen pendientes.

## MVP actual

**Rediseño del 15/09:** puerta de bóveda con carita SVG de Bloub, mirada/espera/sueño y reacción al resultado; apertura visual únicamente tras `released`. Selector de modelo dentro del editor, UI compacta para teclado móvil y respuestas paginadas. Landing y tarjetas usan la misma bóveda. Publicado y probado con un intento real adicional de Haiku. [Entrega y verificación](../docs/treasure-guardian/VAULT-DOOR-UI.md).

**Beta cerrada publicada, 15/09:** [landing](https://vault-closed-beta.vercel.app) y [juego](https://vault-closed-beta.vercel.app/play). Privy y acceso individual verificados con el dueño, tres intentos web reales, recibos recuperados y reinicio con persistencia. Gemini 2.5 Flash y Claude Haiku 4.5; 25 solicitudes por cuenta/día y 250 globales. Cinco invitaciones de testers preparadas, todavía no enviadas. 212 tests y build aprobados. [Estado preciso](../docs/treasure-guardian/CLOSED-BETA-STATUS.md); [inventario y operación reales](deploy/LIVE-BETA.md). Telegram, depósitos y premios monetarios están deshabilitados.

Landing nueva en / y juego en /play; las URLs anteriores siguen abriendo el chat. Telegram privado está implementado y desactivado hasta configurar el bot en modo público. Web y bot comparten motor y presupuesto; no requiere Docker. [Entrega y pendientes](../docs/treasure-guardian/MVP-WEB-TELEGRAM.md) y [activación del bot](../docs/treasure-guardian/TELEGRAM-MVP.md). El límite semanal previo fue retirado por el usuario.

## Ejecutar

Entrega actual: [beta cerrada](../docs/treasure-guardian/CLOSED-BETA-STATUS.md), [operación en el host](deploy/LIVE-BETA.md), [pagos preparados](../docs/treasure-guardian/PAYMENTS-IMPLEMENTATION.md) y [evaluación reproducible](eval/README.md). Un bounty compartido con 2–3 guardianes congelados por ronda es la dirección aceptada para después de la beta. La evaluación adversarial base ya se ejecutó; el candidato defensivo y los ataques adaptativos siguen pendientes.

Requiere Node 22.16 o superior. Instalar los SDKs oficiales de Privy y esbuild desde el lockfile; compilar el cliente antes de ejecutar.

La contabilidad usa SQLite nativo de Node. En el runtime comprobado, Node 22.16, aparece una advertencia de característica experimental; no es una dependencia descargada ni una base alojada.

```powershell
cd 'C:\Users\franc\OneDrive\Documentos\ChatGPT\memelauncher\vault-lab'
npm ci --ignore-scripts
npm run build
npm start
```

Abrir http://127.0.0.1:4319. Sin API key se pueden explorar el catálogo y las reglas; enviar intentos está deshabilitado.

Para activar inferencia: copiar `.env.example` como `.env`, agregar una key propia de OpenRouter y reiniciar. Nunca incluirla en el frontend ni en un commit. Los intentos reales consumen crédito de esa cuenta. No se usaron credenciales de otros proyectos.

## Funcionamiento implementado

- Catálogo consultado en `https://openrouter.ai/api/v1/models`, con filtro de herramientas y fecha de consulta. Hasta 12 modelos; precio de entrada/salida por millón de tokens. Un resultado de catálogo no acredita una inferencia exitosa.
- Regla y herramientas originales, inspiradas en la mecánica de Freysa. No se copió su código.
- Cada sesión conserva dueño, ronda, modelo y configuración en SQLite. Cambiar modelo inicia una partida nueva; cambiar de cuenta borra los datos privados de la pestaña. En práctica pública, Your records consulta y descarga recibos guardados para la cuenta después de recargar; no reanuda conversaciones ni importa logs históricos sin vínculo de propietario.
- Hasta 12 turnos válidos por sesión, mensajes de 2.000 caracteres y contexto acotado públicamente. El historial efectivo, incluidos mensajes de herramientas, queda en el recibo.
- Victoria solo con una llamada válida a `release_prize`. Texto sin llamada deja el cofre cerrado. Llamadas inválidas, ambiguas, truncadas o errores no cuentan como derrota.
- Premisa: “Talk your way in. An AI guards the vault. Convince it to open.” El objetivo es lograr una apertura válida; una frase afirmativa no concede la victoria.
- Un custodio metálico original, renderizado en alta definición, reemplaza al personaje verde. Paleta tinta, hueso y naranja. La pantalla principal se adapta al ancho y al alto sin desplazamiento: mascota, respuesta y editor quedan visibles. Las respuestas largas se leen por páginas sin perder caracteres; el historial completo sigue en Transcript. Tocar al personaje anima un gesto sin generar mensajes ni consumir un intento.
- Voz inglesa opcional del navegador, apagada inicialmente. Solo se eligen voces marcadas como locales por el navegador; si no hay una disponible, se informa y queda el texto. Lee las respuestas reales, nunca el saludo ni los errores. Se cancela al apagarla, iniciar otro intento, reiniciar la conversación u ocultar la pestaña. No usa micrófono ni una API de voz; la inferencia continúa por OpenRouter.
- Editor, historial completo en Transcript, búsqueda de modelos agrupados por proveedor y tema claro u oscuro. El estado del cofre se indica junto a la conversación. Los errores de audio no cambian el resultado ni el recibo del intento.
- Identidad visual del guardián: icono original, humor seco en el copy e Instrument Sans alojada localmente con su licencia. Vault sigue siendo un nombre provisional.
- Editor de altura acotada para conservar el encuadre, selector con `Ctrl/Cmd + K` y flechas, confirmación antes de descartar la conversación o borrador, e historial que respeta la posición de lectura. Los borradores largos pueden desplazarse dentro del editor.
- Configuración efectiva de generación y límites de solo lectura; prompt y herramientas completos desplegables. Los valores vienen del servidor.
- Cuatro perfiles candidatos con rutas solicitadas explícitas, sin fallback y reasoning desactivado: Qwen9B/DeepInfra BF16, Qwen27B/Chutes FP8, Gemini Flash/Vertex Global y Haiku/Anthropic. La comprobación de metadatos no los acredita para una ronda financiada. Otros modelos del catálogo conservan el perfil base no calibrado.
- Copia del prompt y configuración JSON; los recibos muestran el uso informado por la API y señalan datos ausentes. El costo solo se muestra cuando la API lo informa, en sus unidades de crédito.
- “Crear meme” genera un PNG de 1200×900 desde el mensaje y la respuesta registrados. Los extractos recortados se marcan, junto al ID de recibo y el estado de práctica sin premio real. Descargar no publica nada.
- Errores rechazados antes de inferencia separados de resultados no confirmados. El transporte tiene un tiempo límite y el catálogo se puede volver a consultar sin borrar el borrador.
- Recibos de resultados y errores en `.local/attempts.jsonl`; exportación desde la UI. Un fallo de persistencia impide confirmar el resultado.
- Clave solo en servidor, validación de origen, límites de tamaño, un intento concurrente y servicio ligado a localhost.
- Wallet and treasury: ledger SQLite persistente de TEST, con créditos disponibles/reservados, premio, operación, reserva siguiente y pago pendiente separados. Reparto ilustrativo 70/20/10. Recargas, contribuciones, errores, victoria y payout manuales están identificados como simulaciones.
- Opción de vincular TEST al chat real: el servidor reserva 100 TEST antes de consultar al modelo y liquida desde su recibo. Resultado válido consume una vez; error conocido devuelve créditos; incertidumbre retiene la reserva. Una respuesta perdida se puede recuperar sin repetir inferencia. Los controles manuales no pueden elegir el resultado de estos intentos.
- Conector EVM de descubrimiento y acceso explícito a cuentas; no firma, cambia red ni paga. Validador de evidencia de depósito preparado y probado con fixtures, sin indexer activo ni activo configurado. Una wallet conectada no autentica al dueño del saldo compartido de prueba.
- [Economy lab](http://127.0.0.1:4319/economics.html): calculadora separada de escenarios, costos, errores y reparto, con export de supuestos. Todos los números son ilustrativos; no consulta precios ni presenta ingresos reales.
- Export completo del ledger y verificador offline que reconstruye saldos, rondas y pagos desde los eventos: `node audit/verify-ledger.mjs <export.json>`. Verifica consistencia interna; no acredita depósitos, ejecución del modelo o independencia del operador.
- SDKs oficiales de Privy para login/wallet y verificación de firmas, esbuild para el bundle cargado bajo demanda. La app Privy y su prueba real están pendientes; no se requiere App Secret para la verificación con clave pública. assistant-ui fue referencia de interacción, sin instalarlo ni copiar su código React.
- Modo `public-practice` preparado: autenticación previa, origen HTTPS exacto, cuotas persistentes y sandbox deshabilitado. Modo `local` sigue en loopback; el ledger TEST conserva su identidad compartida de simulación. Ver [operación](../docs/treasure-guardian/OPERATIONS.md).

## Lo que falta para lanzar

1. **API y prueba real:** configurar la cuenta, acordar el presupuesto operativo y verificar cada modelo ofrecido. Algunos proveedores pueden devolver alias de modelo o no soportar toda la configuración; la versión actual los reporta como error en vez de sustituir el modelo silenciosamente.
2. **Identidad y par:** elegir empresa/acción, nombre y ticker del juego. Verificar el activo exacto y una ruta utilizable en Long, además de dominio y handles.
3. **Guardianes del cofre común:** calificar 2–3 con pruebas reales y congelar la configuración. Ya se implementó el manifiesto y rechazo de modelos ajenos; los candidatos actuales no están calificados para dinero.
4. **Versión pública:** configurar y probar Privy/API reales, privacidad, observabilidad, backup/restore y despliegue HTTPS. Autenticación, cuotas y persistencia están implementadas y probadas con fixtures, sin publicación.
5. **Dinero:** elegir moneda, tarifa, reparto y autoridad; integrar RPC, órdenes y finalidad con créditos respaldados y un ejecutor de payout. Hay órdenes persistentes y validación de evidencia como preparación; ningún depósito acredita dinero. El ledger TEST sigue siendo una simulación local compartida.
6. **Después:** bounties separados por modelo, logros verificables, rankings, patrocinio y aprendizaje entre versiones. No se presentan como capacidades actuales.

No hay contrato, token, wallet conectada, pago ni publicación. Tampoco se afirma autonomía de custodia o ejecución atestiguada. Publicar instrucciones y recibos del servidor no elimina la confianza en el operador y el proveedor.

## Verificación

```powershell
npm test
npm run verify:release
npm run preflight
```

Las pruebas de servidor usan respuestas controladas de API: validación de victoria, formato, modelo incorrecto, fallos, timeout, persistencia, sesiones y seguridad del servicio local. No llaman a modelos reales ni consumen crédito.

Las capturas de revisión de interfaz se guardan en `output/playwright/`. El estado que muestran es el del laboratorio, sin premio real.

## Referencias

- [Diseño general y dinero](../docs/treasure-guardian/README.md).
- [Direcciones de identidad anteriores](../docs/treasure-guardian/IDENTITY.md).
- [Voz y seis borradores para redes](../docs/treasure-guardian/SOCIAL-DRAFTS.md).
- [Mascota, gestos y lectura en voz alta](../docs/treasure-guardian/MASCOT.md).
- [Nueva dirección visual y prompts de los assets](../docs/treasure-guardian/ART-DIRECTION.md).
- [API OpenRouter](https://openrouter.ai/docs/api/reference/overview).
- [Herramientas en OpenRouter](https://openrouter.ai/docs/guides/features/tool-calling).
- [Precedente Freysa](https://github.com/0xfreysa/agent).
- [Referencias de chat de assistant-ui](https://www.assistant-ui.com/examples).
- [Selector de modelos de assistant-ui](https://www.assistant-ui.com/elements/model-selector).

