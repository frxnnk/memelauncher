# Decisiones para una primera ronda financiada

Actualización 15/09: el [diseño de continuidad por guardián](ROUND-SURVIVAL-DESIGN-2026-09-15.md) propone premios aislados, retiro de configuraciones vencidas y límites de reapertura. Revisa la dirección inicial de cofre común documentada debajo; no cambia reglas de una ronda activa ni fija todavía precios/porcentajes. Para el estado implementado y desplegado usar `vault-lab/deploy/LIVE-BETA.md`.

14/9/2026. Propuesta para revisar; no habilita cobros ni selecciona contratos. La implementación disponible es el laboratorio TEST descrito en [IMPLEMENTATION](IMPLEMENTATION.md).

## Modelo y dificultad

Decisión aceptada: **un cofre común con elección entre 2–3 guardianes aprobados**, congelados por ronda. Su dificultad depende del guardián más fácil de esa lista; no hay evidencia todavía de cuál es. Se congelan todos sus modelos/proveedores, prompt, herramientas, parámetros, límites y precio. Otra configuración inicia otra ronda. El código ya impide acceder a una ronda con un modelo ajeno; los perfiles actuales siguen como candidatos no medidos.

Protocolo siguiente: inspeccionar formato/costo/latencia, compatibilidad de herramientas y calidad de respuesta; después ataques adaptativos y casos reservados con presupuesto igual por candidato. La suite adversarial actual tiene 30 escenarios, incluidos controles técnicos; una repetición de tres modelos planifica hasta 114 llamadas. Hay variantes base y candidata versionadas y aisladas. Ninguna se ejecutó contra modelos reales; una fracción de rechazos no prueba defensa si la ruta no admite herramientas.

La decisión de lanzar requiere resultados medidos, no una tasa elegida de antemano. Publicar cantidad de ataques, llamadas efectivas, aperturas válidas, errores, sesiones abiertas, costo conocido/desconocido y versión. Mantener pruebas reservadas distintas de las usadas para ajustar. No llamar probabilidad de ganar a una fracción de éxito de ataques sintéticos dependientes.

Publicar un modelo/prompt facilita la experimentación externa. Cobrar un intento oficial no puede impedir que alguien estudie la configuración por fuera. Cambiarla a escondidas perjudicaría la transparencia; mejorarla entre rondas permite comparar versiones. No anunciar aprendizaje automático continuo: hoy no hay entrenamiento ni actualización autónoma de pesos.

## Ganador y autoridad

La [revisión técnica de autoridad](PRIZE-AUTHORITY.md) concreta las opciones siguientes en una prueba propuesta: ejecutor verificable por ronda, estado resistente a repetición y escrow con reglas fijas. dstack TDX es el primer candidato de investigación; no hay release/host elegidos, atestación real o aprobación para habilitar fondos.

El código actual acepta una sola acción válida `release_prize` del modelo. Un “yes”, una captura, una explicación o una decisión del sponsor no autorizan pagos. El futuro ejecutor debe tomar dirección y monto de la solicitud aceptada y de la ronda, nunca de texto generado por el LLM.

| Modalidad | Lo que permitiría afirmar | Dependencia que sigue existiendo |
|---|---|---|
| API + servidor y firmante del operador | Reglas publicadas, ejecución registrada y pagos auditables si se integra un escrow | El operador podría fabricar resultados o cambiar el código. No satisface por sí sola la independencia buscada |
| Varios verificadores con reglas públicas | Reduce la dependencia de una sola clave, si se implementa verificación efectiva | Disponibilidad, coordinación y posible colusión; no basta con que varios firmen el mismo JSON sin verificar su origen |
| Ejecutor con atestación y clave restringida | Ruta candidata para vincular una firma a código/configuración autorizados | Hay que demostrar toda la ruta. Si llama una API externa, no acredita por sí mismo los pesos de esa API |
| Inferencia de pesos publicados dentro de una ejecución verificable | Ruta candidata que podría incluir identidad de pesos y código | Costos, soporte del modelo/hardware, atestaciones y pruebas aún sin investigar ni implementar para este proyecto |

La elección por API permite avanzar en el juego, pero **no resuelve automáticamente el riesgo de que el fundador o un amigo se lleven el premio**. Una firma de wallet tampoco acredita que dos wallets pertenezcan a personas distintas. Las reglas iguales, ausencia de información privilegiada y orden de admisión comprobable reducen ventajas; no certifican relaciones personales.

Antes de cobrar, precisar quién puede autorizar, pausar, cambiar código/configuración o retirar fondos. Si la respuesta sigue siendo “nuestro servidor”, describirlo así y no anunciar autonomía exclusiva de la IA. Un hash privado generado por nosotros no prueba cuándo publicamos algo. Para prometer configuración inmutable habría que comprometerla en una fuente externa antes de admitir pagos.

El orden y publicación de intentos también importa: exponer una estrategia ganadora antes de fijar su propietario permite que otros la copien. Diseñar aceptación/compromiso/revelado y vincular ronda, intento, destinatario y recibo. No insertar un desempate editorial después de observar respuestas. El ledger actual demuestra orden interno, no ausencia de censura o reordenamiento antes de aceptar.

## Token, créditos y premio

**Privy** es la elección para autenticación y wallet. SDKs e integración implementados; app y cliente local de desarrollo creados/configurados, con login real pendiente. Robinhood Chain + Long sigue como candidata. **NVIDIA sigue sin elegir:** su stock token está identificado en el registro del emisor y comprobado por RPC; Long muestra un par existente con NVDA, pero el formulario de creación sigue sin cargar. No se verificó una creación para Vault. Ver [consulta actual de Long](LONG-LAUNCH-CHECK-2026-09-14.md), [comprobación del activo](ASSET-CHECK-2026-09-14.md) y [entrega vigente](LAUNCH-HANDOFF.md). La elección de wallet no resuelve la autoridad del ejecutor del premio.

Robinhood Chain + Long sigue como candidata por el research existente. La red y documentación fueron consultadas; no hay lanzamiento elegido. Validar `(chainId, tokenAddress, decimals)`, activo quote, issuer, factory, pool/hook, permisos, beneficiarios y función de claim. No reutilizar contratos/tickers de OCAT o BELLFLY. [Fuentes y límites actuales](TREASURY-RESEARCH.md).

Propuesta inicial: el mismo activo T para recargas y premio, con créditos internos no transferibles. El quote del pool es otra decisión. El token del juego no se convierte en una acción por estar emparejado con una. API y gas necesitan presupuesto líquido; un contador de T no asegura solvencia operativa en dólares.

El reparto 70/20/10 y precio 100 son supuestos TEST. El [simulador](http://127.0.0.1:4319/economics.html) muestra qué ocurre con errores, costos y conversión adversa. Antes de adoptarlos, sustituir supuestos por costos medidos y rutas realmente ejecutables. Los fondos sin consumir y premios comprometidos no cubren déficits operativos.

La reserva siguiente permite continuidad bajo ciertas condiciones, no un bounty infinito garantizado. Si una ronda termina muy pronto o no llegan intentos, puede necesitar otra semilla. No presupuestar con volumen del token ni creator fees futuras. Si se reciben activos distintos, mostrar cada uno por separado; no sumar sus cantidades ni convertirlas con una cotización sin fuente/hora.

## Lo que falta antes de aceptar fondos

1. Roster final probado y configuración de ronda comprometida; condición de victoria y tratamiento de errores publicados.
2. Identidad, token, red, quote y premio exactos; elegibilidad y términos concretos del producto revisados. No hay conclusión legal de esta entrega.
3. Autenticación de wallet, órdenes, indexer, verificación de token, finalidad/reorg y créditos respaldados por depósitos comprobados.
4. Autoridad de ejecución y custodia decididas, contrato y permisos verificables, cola, payout único y recuperación de incidentes con evidencia.
5. Presupuesto operativo, límites por cuenta/ronda, rate limits, persistencia de sesiones, privacidad, observabilidad, revisión de seguridad y carga de la versión pública.

Todo esto está separado de publicar una arena gratuita de práctica. La arena también requiere controles de gasto y acceso antes de exponer una API key al tráfico público mediante el backend.
