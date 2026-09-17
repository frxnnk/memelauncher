# Después del lanzamiento: producto y X

Propuesta para discusión, 10/09/2026. No cambia el alcance autorizado: desarrollo local y lecturas; publicación, cuentas, créditos y ejecución financiera siguen deshabilitados. No se conectó X ni se creó una automatización.

## ¿La diferencia alcanza?

Que una regla neuronal previa determine LAUNCH o NO_LAUNCH es una diferencia técnica verificable frente a un script que siempre acaba lanzando. Es buena metodología; por sí sola es fácil de copiar y probablemente poco visible para la mayoría de la audiencia. No la trataría como una ventaja comercial validada. FLYBRAIN también plantea actividad después de emitir: una mascota/experimento neuronal continuo tampoco debe presentarse como una categoría inédita.

La hipótesis de producto más interesante es un personaje al que la gente quiera volver: un pequeño entorno que la mosca puede afectar, participación comprensible de la comunidad y episodios breves con consecuencias visibles. El lanzamiento sería un episodio inaugural, no todo el producto. El token puede ser el artefacto del experimento y su comunidad; todavía no demostramos que sea necesario para la interacción ni que genere una economía sostenible. No prometer valor, ingresos, recompensas ni inventar token-gating para justificarlo.

## Postlaunch propuesto: una vida pública pequeña

1. La web muestra su entorno y lo que acaba de hacer. Se distinguen estado del juego, variables neuronales y decoración.
2. Los participantes pueden enviar un conjunto pequeño de estímulos definidos: por ejemplo, una cantidad acotada de estímulo azucarado. Luz/otras modalidades requieren entradas neuronales identificadas y validación adicional; no están implementadas hoy.
3. La simulación produce una acción de un vocabulario pequeño y previamente definido, o ninguna acción. Un cambio visible del entorno y un registro enlazan entrada, salida y consecuencia.
4. X publica algunos episodios reales con imagen/clip y un texto corto. No un bot de promoción financiera ni de respuestas masivas.

Ejemplo conceptual: un visitante selecciona un estímulo; la simulación puede acercar el personaje a una campana o dejarlo quieto; la web registra el episodio; si se cumple una regla de publicación y un límite de frecuencia, el editor genera una tarjeta. Es una propuesta de interfaz/decodificación, no una capacidad ya demostrada del circuito ni una emoción atribuible al modelo.

## Qué significa que la mosca maneje X

| Responsabilidad | Implementación honesta propuesta |
|---|---|
| Publicar o permanecer en silencio | Salida del modelo interpretada por una regla fija, dentro de límites operativos. Un fallo de seguridad puede impedir publicar, nunca convertir silencio en publicación. |
| Elegir entre unos pocos tipos de episodio | Decodificador definido y probado para ese propósito. El actual único umbral MN9 no equivale a un selector de contenidos ya validado. |
| Escribir texto y diseñar la tarjeta | Plantillas primero; un LLM opcional después, identificado como redactor. No atribuir al connectoma palabras, comprensión de memes o intención financiera. |
| Publicar por red | API oficial mediante una cuenta del proyecto y permisos limitados, idempotencia local, límites de frecuencia, conciliación de resultados y registro del post ID. |
| Comprender un timeline y conversar libremente | No demostrado. Una captura a baja resolución no equivale a leer. Agregar un LLM que tome estas decisiones convertiría esa parte en un agente lingüístico asistiendo al experimento. |

Un flujo razonable: entrada permitida → simulación → decisión registrada → plantilla/imagen → outbox → API X. La outbox empieza exclusivamente en modo borrador local. Las reglas del editor deben estar visibles: texto humano/plantilla/LLM y qué control tuvo realmente el modelo.

## Capacidad actual frente al siguiente prototipo

`runner/reference.py` construye un modelo nuevo por ensayo, reinicia el scope y usa un seed fijo; corre una ventana de 1 segundo simulado. Tenemos control causal acotado y replay, no un organismo persistente que aprende de interacciones ni un gestor de X.

Para continuidad hacen falta sesiones y checkpoints del estado adecuado, control del reloj, recuperación y límites de actividad. Acumular un historial de posts o guardar un estado de juego no demuestra memoria neuronal. El aprendizaje/plasticidad es trabajo científico separado; no hace falta prometerlo para una primera mascota interactiva.

El primer prototipo puede ser episodios independientes rotulados como tales, conservando las reglas y evidencias actuales. Probar publicación/silencio con plantillas y un candidato de contenido fijado antes del ensayo es menor alcance que abrir un navegador social completo. Para seleccionar varios contenidos se necesita otro decodificador validado.

## Reglas y acceso a X verificados hoy

- X permite publicaciones automáticas de entretenimiento/información dentro de sus demás reglas; prohíbe automatizar el sitio mediante scripts en lugar de su API. No se propone operar la cuenta continuamente con clics en Brave. También prohíbe likes automáticos y respuestas no solicitadas. Sus bots de respuestas con IA requieren aprobación previa, expresa y escrita de X. [Reglas oficiales](https://help.x.com/en/rules-and-policies/x-automation).
- Un bot debe identificarse y tener un responsable humano; revisar la etiqueta de cuenta automatizada. [Etiquetas](https://help.x.com/en/using-x/automated-account-labels).
- Publicar requiere app de desarrollador y autorización OAuth del usuario; `POST /2/tweets` devuelve el identificador del post creado. No basta con tener una sesión abierta de X. [Quickstart oficial](https://docs.x.com/x-api/posts/manage-tweets/quickstart).
- La API se cobra por uso con créditos; presupuesto y precios concretos se revisan antes de activarla. No se compraron créditos. [Precios oficiales](https://docs.x.com/x-api/getting-started/pricing).

En el MVP propongo solo posts originales, sin DMs, follows, likes, promoción por menciones ni respuestas automáticas. Una futura política de publicación y su presupuesto se autorizan antes de operar. El alcance de aprobación para replies de IA es distinto del de posts originales; no convertirlo en un veto a toda automatización creativa.

## Prueba barata antes de apostar al postlaunch

Proponer un piloto de siete días: web/entorno mínimo, pocos estímulos, episodios reales y outbox local que muestre tanto borradores como decisiones de silencio. Primero validar causalidad con controles y compararla con un comportamiento aleatorio simple; no confundir una ruleta visual con un comportamiento interesante atribuible al circuito.

Con autorización para compartir el piloto, invitar a diez personas que no necesiten comprar el token. Criterio inicial propuesto: al menos cinco vuelven por voluntad propia en tres días distintos y pueden explicar una interacción que les interesó. Registrar intentos, retornos y comentarios, sin confundir views o expectativa de precio con interés por el personaje. Es una señal de decisión, no validación estadística de mercado.

Si solo interesa el día del lanzamiento, asumirlo como una pieza puntual de arte/entretenimiento. Si interesa observar e intervenir en la vida de la mosca, desarrollar esa continuidad y luego habilitar X como su diario. No afirmar ya que esa demanda existe.
