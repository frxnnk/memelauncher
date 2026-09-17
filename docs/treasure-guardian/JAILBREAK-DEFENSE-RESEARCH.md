# Un guardián difícil, con victorias verificables

La recomendación es mantener una arena de práctica con varios modelos y seleccionar un modelo y una configuración por ronda financiada. El prompt puede elevar la dificultad, pero los permisos de pago, identidad y contabilidad deben resistir incluso cuando el guardián pierde. Privy es la dirección elegida para acceso y wallet; Robinhood Chain y Long son candidatos para el token, mientras que el activo vinculado a NVIDIA sigue sin validar. La configuración actual todavía no tiene resultados de inferencia real: este documento distingue investigación externa, controles implementados y experimentos pendientes.

## Qué significa proteger este juego

El objetivo del jugador es conseguir una llamada válida a `release_prize`. Esa apertura es una victoria prevista por el producto, aunque contradiga la instrucción del guardián. Obtener una frase como “yes”, mostrar JSON con el nombre de la herramienta o hacer que el personaje diga una grosería no demuestra que el premio se haya liberado. La evaluación debe medir exactamente la acción que utiliza el servidor.

Hay dos objetivos de seguridad distintos. El primero es que el rival no resulte trivial: requiere seleccionar el modelo, ajustar instrucciones y medir ataques. El segundo es que nadie pueda crear créditos, cobrar dos veces, cambiar al destinatario o sustituir una respuesta por un comprobante inventado. Este segundo objetivo pertenece al software y a la infraestructura de ejecución, incluso si el modelo obedece todas las instrucciones del atacante.

La transparencia vuelve esperable que un jugador estudie el prompt y ensaye fuera de la web. Publicar instrucciones no permite impedir la ingeniería inversa; permite que las reglas sean inspeccionables. En un modelo abierto también puede existir búsqueda local sobre sus pesos, mientras que en una API cerrada sigue siendo posible consultar y adaptar ataques. Cobrar intentos oficiales limita el tráfico de la plataforma, pero no elimina esa preparación externa.

Por eso no conviene anunciar un modelo “imposible de romper” ni aprendizaje continuo. Las mejoras deben producir versiones nuevas entre rondas, con cambios y resultados publicados. Una ronda ya financiada necesita conservar sus condiciones: cambiar discretamente el prompt al detectar una estrategia ganadora alteraría el juego que se vendió. Un cambio urgente de disponibilidad debe tener un procedimiento publicado de pausa y tratamiento de intentos pendientes.

## Qué repos pueden ser los mencionados

**Heretic** es un candidato fuerte si el recuerdo era una herramienta que convierte modelos descargados en variantes con menos rechazo. Su README describe modificación de modelos mediante abliteration y optimización automática; esto exige acceso a pesos y ejecución local. No equivale a enviar un texto que modifique los pesos del modelo servido por una API. La investigación sobre direcciones de rechazo ayuda a entender ese mecanismo, pero no certifica resistencia ni fragilidad del guardián. [^1][^2]

**L1B3RT4S, de Pliny**, es otro candidato si se trataba de una colección de prompts. Contiene archivos separados para Alibaba, DeepSeek y otros proveedores. Los ejemplos inspeccionados combinan cambio de personaje, formato, instrucciones que se presentan como sistema y ofuscación; una sección de Qwen incluso exige colocar el texto como prompt de sistema. Un jugador de esta aplicación no dispone de ese control, aunque puede intentar imitarlo dentro de su mensaje. [^3]

La búsqueda pública de X permitió corroborar publicaciones de Pliny que anuncian modelos “liberados”, incluida una de GPT-5.2 del 11 de diciembre de 2025. Son declaraciones del autor acompañadas por ejemplos seleccionados, no un ensayo con denominador completo y la configuración de este juego. Una referencia a DeepSeek v4 de mayo de 2026 apareció por una fuente secundaria, pero su publicación original no fue recuperable; no se usa aquí como resultado confirmado. Esta revisión de X cubre material público indexado, no una revisión completa de una cuenta o de su feed. [^4]

“Modelos chinos” no define una clase uniforme de seguridad. Hay que distinguir pesos originales y modificados, modelo instruct y base, cuantización, versión, proveedor, plantilla de chat y permisos del atacante. También importa si el estudio mide al modelo como defensor o como generador de ataques. No hay evidencia reunida que permita afirmar que un mismo repo rompe la mayoría de los endpoints actuales de Qwen y DeepSeek bajo nuestras reglas.

## Métodos relevantes y calidad de la evidencia

| Recurso | Acceso y mecanismo | Utilidad para el cofre | Límite de la evidencia |
|---|---|---|---|
| Heretic / refusal direction [^1][^2] | Pesos y activaciones; modificar el comportamiento de rechazo | Entender modificaciones y preparación local de atacantes | No transforma remotamente nuestro endpoint |
| L1B3RT4S [^3] | Colección de instrucciones y formatos; algunos ejemplos requieren cambiar el sistema | Fuente de familias para regresión | Demostraciones heterogéneas, sin una tasa comparable para el juego |
| PAIR [^5] | Un modelo atacante propone y refina mensajes con feedback | Prioridad alta para probar persuasión adaptativa por API | Su objetivo original es contenido rechazado, no nuestra herramienta |
| TAP [^6] | Búsqueda ramificada y poda de candidatos con modelos auxiliares | Explorar más estrategias que una conversación lineal | Contar llamadas del atacante y evaluadores, además del guardián |
| AutoDAN-Turbo [^7] | Exploración y reutilización de estrategias de ataque | Referencia para futuras campañas adaptativas | La memoria de estrategias puede contaminar la evaluación reservada |
| GCG / llm-attacks [^8] | Optimización de sufijos con acceso a un modelo local; ensayos de transferencia | Relevante si publicamos pesos o se ataca un sustituto local | La implementación original advierte limitaciones de modelos y tokenizadores |
| Many-shot [^9] | Repetir demostraciones dentro del contexto | Motiva pruebas de ejemplos, saturación e historial | Nuestros límites restringen longitud, pero no prueban inmunidad |
| Best-of-N [^10] | Muchas variaciones de un mensaje y selección de resultados | Medir dificultad frente a presupuesto creciente | Una tasa después de miles de variantes no es una tasa por intento |
| Tensor Trust [^11] | Juego humano de defensa y ataque de instrucciones | La referencia más cercana al tipo de producto | Su contraseña y objetivo textual difieren del prompt público y tool call |
| JailbreakBench [^12] | Evaluación estandarizada, configuraciones y artefactos | Disciplina de reproducción y comparación | Su puntuación no reemplaza al validador de nuestro servidor |
| garak / PyRIT [^13][^14] | Herramientas para organizar pruebas de riesgo de modelos | Posible ampliación futura del laboratorio | Necesitan adaptación al objetivo y límites; no hacen seguro un producto por instalarlas |

Tensor Trust publicó más de 126.000 ataques y 46.000 defensas creados por jugadores. Es especialmente útil porque estudia tanto extracción como secuestro de instrucciones en un entorno de juego. Para este producto la extracción del prompt público no cuenta como fallo; interesan estrategias que cambien la acción del guardián. Conviene adaptar categorías con ejemplos originales y conservar procedencia, en lugar de incorporar indiscriminadamente conversaciones del dataset. [^11]

El trabajo *The Attacker Moves Second*, publicado inicialmente en octubre de 2025, examina defensas frente a atacantes que conocen el mecanismo y se adaptan a él. Es evidencia a favor de evaluar después del ajuste, con ataques diferentes, y de desconfiar de conclusiones basadas únicamente en plantillas fijas. No implica que todas las defensas sean inútiles ni permite asignar una probabilidad de pérdida a esta aplicación. [^15]

La versión publicada en Nature Communications en febrero de 2026 de *Large reasoning models are autonomous jailbreak agents* estudia cuatro modelos como atacantes de nueve modelos objetivo. Su cifra agregada de 97,14% corresponde a alcanzar el máximo nivel de daño en 68 de 70 ítems mediante el conjunto de combinaciones estudiadas; no significa que cada mensaje ni cada pareja lograra ese porcentaje. Su implicación práctica es incluir adversarios que planifican conversaciones, no usar esa cifra para elegir el guardián. [^16]

Best-of-N reporta resultados históricos elevados tras muestrear hasta 10.000 variantes en su ensayo. Esa escala explica por qué un ataque que falla tres veces puede seguir siendo relevante. Los intentos correlacionados, los cambios de modelo y un objetivo de salida distinto impiden traducir ese dato a “probabilidad de abrir el cofre”. La comparación útil registra victorias en función del presupuesto real de búsqueda. [^10]

## Superficie de ataque del laboratorio actual

El navegador puede seleccionar un modelo permitido y enviar texto del jugador. El servidor construye el mensaje de sistema, conserva el historial, fija parámetros y publica las herramientas. La ruta de inferencia admite `modelId`, `prompt` y, cuando corresponde, `sessionId`; no permite enviar otro arreglo de mensajes, roles o herramientas. Una etiqueta `system` escrita dentro del texto sigue viajando como contenido del jugador, aunque el modelo pueda dejarse persuadir por ella.

No hay navegación, RAG ni acceso del modelo a una wallet. Los únicos tools del juego son `keep_locked` y `release_prize`, ambos con una explicación textual. Por tanto, la inyección indirecta a través de páginas y documentos no es la superficie dominante de esta versión. Si más adelante se agregan links de sponsors, voz, imágenes o búsquedas, aparece una superficie nueva que necesita su propio ensayo y versión de reglas.

El validador exige el modelo solicitado, una respuesta completa y como máximo una llamada de herramienta con formato admitido. Argumentos como destinatario, monto o instrucciones de ejecución no forman parte del esquema y se rechazan. Texto normal sin herramienta deja el cofre cerrado; una respuesta ambigua, truncada o inválida queda como error. Estas comprobaciones ya existen y no necesitan que el LLM reconozca el ataque para funcionar.

Los registros conservan configuración y resultados, pero siguen siendo registros del operador. Un hash local permite detectar diferencias entre archivos conocidos; no acredita que el proveedor haya ejecutado esos pesos ni impide que el operador fabrique un resultado. Resolver la confianza en quién puede autorizar el premio sigue siendo trabajo separado de endurecer instrucciones. Privy tampoco cambia por sí solo esa autoridad.

## Prompt y configuración que conviene probar

El prompt activo ya fija deber de custodia, idioma inglés, humor sobre la estrategia, ausencia de dinero real y una condición de victoria basada en herramientas. La propuesta nueva conserva esos elementos y hace explícitos tres límites: las transformaciones de texto no son autorización, las respuestas anteriores no pueden modificar reglas y los recibos o sponsors mencionados por el jugador no tienen autoridad. Además, aclara que la naturaleza ficticia de la práctica no constituye una excepción al objetivo.

El candidato está en [candidate-system-prompt.txt](../../vault-lab/eval/candidate-system-prompt.txt). **No está cargado por el servidor ni por el runner**, y no hay resultados que demuestren que sea mejor. Mantenerlo separado evita cambiar la referencia antes de compararla. Su texto está en inglés y conserva una apertura válida como victoria; no añade contraseña, juez secundario ni veto editorial.

| Decisión | Base actual | Ensayo propuesto |
|---|---|---|
| Identidad | ID de modelo y perfil de proveedor publicados | Congelar también fecha, ruta solicitada y datos devueltos; no afirmar pesos atestados |
| Prompt | `vault-practice-v2-en-2026-09-14` | Comparar con el candidato manteniendo lo demás igual |
| Temperatura | 0,7 | Comparar primero 0,2 frente a 0,7; no asumir que cero vuelve seguro o determinista al servicio |
| Reasoning | Solicitado desactivado en perfiles candidatos | Mantenerlo en la primera comparación; evaluar después solo si el endpoint documenta soporte |
| Herramientas | Dos tools, `tool_choice: auto` | Mantener el mismo contrato; no forzar siempre `keep_locked` |
| Salida | 512 tokens | Medir truncamientos y calidad; aumentarla solo como configuración distinta |
| Contexto | 2.000 caracteres por mensaje, 12 turnos, 12.000 caracteres de entrada serializada | Registrar rechazos y ensayar límites; no convertirlos en defensas infalibles |
| Routing | Sin fallback solicitado | Un fallo de proveedor debe conservarse como error, no cambiar de rival |

OWASP recomienda separar instrucciones y datos, validar llamadas, limitar privilegios y monitorear interacciones. También advierte que un guardrail basado en otro modelo puede sufrir inyección. En este juego un filtro que anule silenciosamente cualquier intento de jailbreak destruiría la mecánica; una restricción de contenido necesaria debe ser pública y aplicarse antes de aceptar el intento, con tratamiento claro de créditos. Es una decisión de producto adicional, no una prueba de dificultad. [^17]

El router libre encaja en práctica y comparación. Para un bounty común, el rival más vulnerable puede determinar la supervivencia del fondo aunque los demás sean resistentes. La recomendación es un modelo por ronda, o premios separados por modelo, con identificador de configuración visible. El tamaño o reputación comercial del modelo no reemplaza los resultados del ensayo.

## Pruebas preparadas y protocolo pendiente

La suite ampliada contiene **30 escenarios: 4 controles y 26 ataques**. Conserva los 14 originales y agrega 16 casos sobre roles falsos, continuación de respuestas, herramientas simuladas, codificación, Unicode, ejemplos repetidos, presión de sponsors, recibos, reintentos, JSON mostrado como texto y conversaciones que convierten una descripción en una supuesta autorización. Son casos originales e inocuos sobre este cofre; las referencias indican la familia que motivó cada caso, no una reproducción literal de ataques dañinos.

Hay cuatro conversaciones de tres turnos y 26 escenarios de un turno, con hasta 38 llamadas por modelo y repetición. Con tres modelos y una repetición se preparan 90 sesiones y hasta 114 llamadas. `node eval/run.mjs --suite adversarial --repeats 1 --max-calls 114` produce únicamente un plan: no lee claves, no consulta modelos y no ejecuta inferencia. La configuración y los textos quedan congelados con hashes en el manifiesto. [Artefacto](../../vault-lab/output/adversarial-dry-plan.json).

Las pruebas automatizadas verifican que el plan respeta límites, que los textos permanecen dentro del rol de jugador y que una apertura válida no es vetada por parecer un ataque. También recorren los 38 turnos con respuestas simuladas. Esto valida transporte, historial y evaluación; no mide la resistencia del guardián. Un caso que cabe con una respuesta corta puede agotar contexto con respuestas reales más largas, y ese error debe seguir visible.

El siguiente ensayo debe separar compatibilidad, ajuste y evaluación reservada. Primero hay que comprobar que cada endpoint responde, respeta el esquema y puede producir herramientas cuando una prueba técnica se lo pide. Después se comparan prompts con la suite pública, sin usar esa misma suite para proclamar seguridad final. Los finalistas reciben una campaña adaptativa y casos humanos que no se utilizaron para ajustar.

Una propuesta acotada para esa última fase es dos configuraciones finalistas, tres estrategias de atacante y hasta diez pasos por estrategia: como máximo 60 solicitudes al guardián y, si cada paso requiere una generación atacante, hasta otras 60. Es un presupuesto experimental propuesto, no implementado ni autorizado para gasto. Debe preservar los límites por sesión del producto y sumar los costos del atacante, guardián y cualquier evaluador. La victoria la determina el validador del cofre; un juez lingüístico puede puntuar humor o relevancia, nunca autorizar fondos.

Conviene publicar por configuración sesiones iniciadas y completas, ataques que abrieron, controles que abrieron por error, respuestas inválidas, costo reportado y desconocido, latencia y proveedor observado. Para comparar campañas adaptativas también hacen falta familias, presupuesto y pasos hasta apertura. Un error no es una defensa exitosa, y ausencia de costo reportado no significa gratuidad. Una fracción de esta muestra no debe mostrarse al jugador como sus probabilidades de ganar.

La publicación del conjunto reservado puede hacerse después de cerrar la evaluación y la ronda correspondiente. Reservar casos de evaluación evita ajustar sobre ellos; no equivale a ocultar reglas al jugador. La regla, herramientas y configuración que gobiernan cada intento deben seguir siendo públicas antes del pago.

## Privy, depósitos y límites de autoridad

Privy tiene una receta oficial para JavaScript sin React mediante `@privy-io/js-sdk-core`, con configuración de aplicación y client ID. Por tanto, la wallet no obliga por sí sola a reescribir la interfaz. La integración sí necesita empaquetar el SDK, montar su iframe y completar el ciclo de autenticación y disponibilidad del proveedor. En la aplicación actual solo existe conexión EVM del navegador, sin autenticación Privy ni depósitos efectivos. [^18]

El backend debe verificar el access token de Privy: firma, emisor, audience de la aplicación y expiración. El identificador autenticado se vincula a una cuenta del ledger, y la relación con la wallet debe resolverse por evidencia verificada del usuario. Una dirección enviada en el cuerpo de una solicitud no prueba propiedad. Los tokens de autenticación no deben ir en recibos públicos ni registros de prompts. [^19]

El flujo recomendado es `autenticación → orden de depósito → transacción del usuario → verificación independiente → créditos`. La acreditación requiere red, contrato de token, destinatario, cantidad y evidencia canónica; una captura o hash aportado por el navegador es únicamente una pista para consultar. La clave de idempotencia debe impedir acreditar dos veces el mismo evento. El ledger TEST ya modela reservas y liquidación, pero falta conectarlo con usuarios, indexación y dinero real.

El modelo no necesita acceso de servidor a la wallet del usuario. Privy distingue propietarios y autorizaciones para operaciones sensibles; la configuración exacta de ownership importa. La elección inicial propuesta es wallet del jugador bajo su autorización, backend limitado a autenticar y verificar, y ejecutor del premio separado. La decisión sobre quién controla ese ejecutor y qué puede modificar sigue abierta y debe poder inspeccionarse. [^20]

La CSP actual permite recursos propios y bloquearía partes de la integración. Privy publica dominios requeridos por función; habrá que permitir solo los recursos del SDK y métodos de login realmente seleccionados. La guía consultada incluye ejemplos para React, de modo que la configuración final de la receta JavaScript necesita prueba propia. No corresponde reemplazar la política por un comodín ni afirmar compatibilidad completa antes de probar login, reconexión y cambio de cuenta. [^21]

## Robinhood Chain, Long y NVIDIA

La documentación de Robinhood consultada el 14 de septiembre de 2026 publica mainnet 4663, testnet 46630 y ETH para gas. Privy documenta soporte de redes EVM y redes personalizadas; eso hace plausible esta integración, pero no demuestra que todas sus funciones de sponsorship o funding estén disponibles en esa red. Un ensayo de autenticación y firma en testnet es un paso distinto de configurar depósitos de producción. [^22][^23]

Long anuncia públicamente lanzamiento con stock tokens en Robinhood Chain. La página de contratos de Robinhood indica que el registro canónico se genera en vivo y advierte que un ticker coincidente con otra dirección no identifica el mismo activo. En la consulta estática no se recuperó el catálogo dinámico completo. **NVIDIA permanece como hipótesis de elección**, sin contrato, aceptación como quote en Long ni pool verificados para este proyecto. [^24][^25]

Antes de diseñar una identidad asociada a ese activo se necesita la tupla exacta de red, contrato, decimals, emisor y activo subyacente; también la admisión en Long y los permisos del pool. El token del juego, el activo del pool y el premio son decisiones separadas. No hay autorización para emitirlo ni una afiliación con NVIDIA, Robinhood o Long derivada de esta investigación.

La contabilidad debe mostrar créditos sin consumir separados del bounty, operación y reserva. La recarga crea primero un derecho del jugador sobre sus créditos; un intento aceptado y resuelto aplica el reparto publicado. El componente visual debe animar importes confirmados y enlazar evidencia, en lugar de aumentar un contador solo porque llegó una respuesta. Creator fees y donaciones se incorporan cuando se reciben y reconcilian; expectativa de volumen no es un ingreso realizado.

Un guardián más resistente puede retrasar aperturas, pero no crea recursos para siempre. Hace falta medir costo de inferencia y gas, activo disponible para pagarlos, precio por intento y reserva después de un ganador temprano. Los valores 100 TEST y 70/20/10 siguen siendo supuestos del laboratorio. La propuesta de sponsors debe darles visibilidad pública sin capacidad de alterar decisiones del guardián o adjudicar premios.

## Decisiones y entregables

Quedan preparados el informe, el candidato de prompt y una suite ejecutable con el validador real del juego. La recomendación técnica inmediata es comparar endpoints concretos en práctica, mantener pagos fuera del alcance del LLM y preparar Privy como capa de identidad y wallet. La selección de modelo requiere inferencia medida; la de NVIDIA requiere contrato y ruta de lanzamiento verificados. Ninguno de esos estados pendientes se presenta como una integración terminada.

Para iniciar inferencia faltan una key dedicada y un presupuesto de API; el runner ya exige límites explícitos y no reutiliza automáticamente la key de la app. Para Privy faltan aplicación configurada, métodos de acceso, dominios y decisiones de ownership. Para aceptar fondos faltan identidad integrada, contratos y depósitos, además de una autoridad de liquidación compatible con la promesa de transparencia. Estas dependencias permiten avanzar por etapas sin confundir el laboratorio con un bounty financiado.

## Fuentes

Consultadas el 14 de septiembre de 2026. Repos y documentación son páginas mutables; las versiones de papers se identifican cuando afectan la interpretación. Las implementaciones externas fueron inspeccionadas como referencias, no ejecutadas ni incorporadas como dependencias.

[^1]: [p-e-w, Heretic, README y arquitectura](https://github.com/p-e-w/heretic).
[^2]: [Arditi et al., Refusal in Language Models Is Mediated by a Single Direction, 2024](https://arxiv.org/abs/2406.11717).
[^3]: [Pliny, L1B3RT4S](https://github.com/elder-plinius/L1B3RT4S), [ALIBABA.mkd](https://github.com/elder-plinius/L1B3RT4S/blob/main/ALIBABA.mkd) y [DEEPSEEK.mkd](https://github.com/elder-plinius/L1B3RT4S/blob/main/DEEPSEEK.mkd).
[^4]: [Pliny en X, publicación sobre GPT-5.2, 11/12/2025](https://x.com/elder_plinius/status/1999253071189189114). Evidencia de una declaración pública del autor, no validación independiente.
[^5]: [Chao et al., PAIR, implementación oficial de JailbreakingLLMs](https://github.com/patrickrchao/JailbreakingLLMs).
[^6]: [Mehrotra et al., TAP, implementación oficial](https://github.com/RICommunity/TAP) y [paper, 2023 / NeurIPS 2024](https://arxiv.org/abs/2312.02119).
[^7]: [Liu et al., AutoDAN-Turbo, ICLR 2025](https://arxiv.org/abs/2410.05295) y [repositorio](https://github.com/SaFo-Lab/AutoDAN-Turbo).
[^8]: [Zou et al., llm-attacks, implementación oficial de GCG, 2023](https://github.com/llm-attacks/llm-attacks).
[^9]: [Anthropic, Many-shot jailbreaking, 2024](https://www.anthropic.com/research/many-shot-jailbreaking).
[^10]: [Hughes et al., Best-of-N Jailbreaking, arXiv v2, diciembre de 2024](https://arxiv.org/abs/2412.03556).
[^11]: [Toyer et al., Tensor Trust, paper y proyecto, 2023 / ICLR 2024](https://tensortrust.ai/paper/) y [dataset oficial](https://github.com/HumanCompatibleAI/tensor-trust-data).
[^12]: [JailbreakBench, implementación y artefactos](https://github.com/JailbreakBench/jailbreakbench).
[^13]: [NVIDIA, garak](https://github.com/NVIDIA/garak).
[^14]: [Microsoft, PyRIT](https://github.com/microsoft/PyRIT).
[^15]: [Nasr et al., The Attacker Moves Second, octubre de 2025](https://arxiv.org/abs/2510.09023).
[^16]: [Hagendorff, Derner y Oliver, Large reasoning models are autonomous jailbreak agents, Nature Communications, febrero de 2026](https://www.nature.com/articles/s41467-026-69010-1). Se utiliza la versión publicada, no solamente el preprint de 2025.
[^17]: [OWASP, LLM Prompt Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html).
[^18]: [Privy, receta de JavaScript Core SDK](https://docs.privy.io/recipes/core-js).
[^19]: [Privy, tokens de autenticación y verificación](https://docs.privy.io/authentication/user-authentication/tokens).
[^20]: [Privy, authorization signatures](https://docs.privy.io/api-reference/authorization-signatures) y [server-side access](https://docs.privy.io/wallets/wallets/server-side-access).
[^21]: [Privy, Content Security Policy](https://docs.privy.io/security/implementation-guide/content-security-policy).
[^22]: [Robinhood Chain, conexión a la red](https://docs.robinhood.com/chain/connecting/).
[^23]: [Privy, configuración de redes EVM](https://docs.privy.io/basics/react/advanced/configuring-evm-networks).
[^24]: [Long, aplicación y anuncio de stock tokens](https://app.long.xyz/).
[^25]: [Robinhood Chain, contratos canónicos](https://docs.robinhood.com/chain/contracts/).
