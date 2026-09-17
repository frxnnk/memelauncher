# Rondas, guardianes vencidos y ejecución comprobable

2026-09-15. Diseño propuesto a partir del feedback del usuario. Aceptación de la dirección general de custodia/economía; porcentajes, tiempos, precios y contratos siguen sin fijarse. No modifica la beta ni mueve fondos.

Complementa [custodia y economía](CUSTODY-AND-ECONOMICS-DRAFT-2026-09-15.md) y [autoridad del premio](PRIZE-AUTHORITY.md). El usuario mantiene la devolución a quienes pagaron intentos cuando una ronda expira sin ganador. Solicita continuidad, aislamiento de modelos vencidos, precios evaluables y pruebas de ejecución; Freysa sigue como referencia explícita.

## Estructura recomendada

| Alternativa | Efecto |
| --- | --- |
| Cofre común, cualquier modelo | La ruta más fácil expone todo el premio. No recomendada para fondos. |
| Cofre común, roster limitado | Simple, pero una sola debilidad afecta a todos los guardianes del cofre. Era la dirección inicial. |
| Rondas y premios independientes por guardián/configuración | Limita cada derrota al premio que ese guardián protege. Recomendada para la próxima versión. |

Una interfaz y selector de modelos, pero obligaciones separadas. Cambiar de modelo muestra su premio, precio, reglas y estado; requiere confirmar otra ronda y comenzar su contexto propio. No arrastrar silenciosamente historial de otro guardián. La práctica puede ofrecer más modelos que las rondas financiadas.

La identidad de una configuración incluye modelo y versión declarada, proveedor/ruta, prompt, herramientas, muestreo, límites/contexto, criterio de victoria y ejecutor. Con APIs cerradas, el identificador del proveedor no prueba pesos inmutables: declararlo como límite. Una corrección crea configuración nueva; no reescribe la ronda activa.

## Derrota y rehabilitación

Flujo propuesto: candidata → evaluada → activa → vencida → revisión → nueva candidata versionada. Expirada y suspendida por infraestructura son estados distintos de vencida.

1. La primera victoria válida según el orden publicado cierra admisiones y reserva exactamente el premio anunciado para la wallet comprometida. No requiere aprobación editorial posterior.
2. Esa configuración deja de aceptar intentos con premio. Sigue visible en el historial como vencida; puede ofrecerse en práctica.
3. No recibe semilla automática ni vuelve a activarse por haber transcurrido un cooldown. El exploit conocido seguiría existiendo.
4. Para volver necesita corrección explícita, nueva versión, repetir el ataque ganador y variantes, evaluar ataques reservados y documentar resultados. Empezar con exposición reducida. Aprobar la evaluación no certifica invulnerabilidad.
5. No reabrir clones equivalentes cambiando solo el nombre. Registrar linaje, diferencias y presupuesto acumulado por familia/configuración.

Para una primera implementación, una sola inferencia elegible en curso por ronda reduce disputas. Las solicitudes en espera no se cobran si la ronda cierra antes de admitirlas. Definir TTL de cola, admisión externa, plazo de resolución y devolución por infraestructura antes de aceptar fondos; un turno atascado no puede bloquear indefinidamente al resto. La serialización del servidor por sí sola no demuestra orden imparcial ni impide reinferencia oculta.

Si un ataque parece transferible a otras configuraciones: detener nuevas aperturas/semillas de esa familia y revaluar. Cualquier pausa de entradas en rondas ya activas debe ser acotada, prevista y pública. No anular victorias válidas, cambiar reglas ni retener claims porque una estrategia resulte demasiado eficaz.

## Anti-vaciamiento económico

- **Premio ganable:** todo lo mostrado como bounty. Al ganar puede vaciarse esa ronda; eso es una victoria legítima. No descontar una reserva sorpresa del premio.
- **Reserva de continuidad:** fondo distinto, visible y fuera del alcance de la acción del modelo. No contiene créditos sin usar, premios pendientes ni derechos de devolución.
- **Tope de exposición simultánea:** suma de premios abiertos, incluso si todos los modelos caen por el mismo exploit. No asumir independencia entre guardianes.
- **Tope de semillas por período y familia:** evita que muchas reaperturas consuman la reserva poco a poco. Se aplica antes de abrir nuevas rondas y se publica por adelantado.
- **Piso de reserva:** si abrir otra ronda lo atraviesa, queda esperando financiación; la práctica puede continuar dentro de su presupuesto operativo. Nunca financiar continuidad con obligaciones de jugadores.
- **Sponsors y creator fees:** solo asignar lo efectivamente recibido, por activo y procedencia. Destino al ganar/expirar publicado; no influyen sobre el resultado.

Regla candidata para abrir una ronda: semilla <= mínimo(tope por ronda, presupuesto remanente del período/familia, reserva libre menos piso). Exigir además cobertura operativa y evaluación de la configuración. No aceptar nueva semilla si cualquiera falla. Todas estas magnitudes se calculan en unidades del activo exacto.

Ejemplo aritmético propio, no parámetros elegidos: reserva libre 1.000, piso 500, semilla 100 y presupuesto total de nuevas semillas 500. Sin ingresos, se pueden perder cinco semillas, no una sexta; quedan 500 y se frena la reapertura. Una reserva que envía 100 indefinidamente termina agotándose, aunque cada premio esté aislado. Ingresos netos y sponsors pueden reponer capacidad, pero no garantizan un juego infinito.

Las devoluciones al vencer sin ganador conservan la regla del borrador: pro rata de contribuciones elegibles efectivas al bounty. El valor del token en USD puede cambiar. Sponsors, seed y creator fees no entran automáticamente en la base reembolsable. Se deben publicar fechas, denominador y redondeo, con claims que no necesiten al agente disponible.

## Precio por modelo

Recomendación inicial: precio fijo por configuración/ronda, visible antes de enviar y fijado en la admisión. No cobrar distinto por usuario ni aumentar un precio ya aceptado. No escoger importes con una única muestra de costo.

Base de cálculo: presupuesto conservador de inferencia a contexto máximo + fallos que el sistema deba absorber + infraestructura/gas subsidiado, contrastado con la fracción operativa y liquidez del activo cobrado. Un modelo caro puede necesitar otro precio, pero caro no significa difícil. Limitar contexto y salida también forma parte del producto y debe declararse.

Después se puede simular una curva acotada en función del bounty de esa ronda: parámetros previos, máximo, redondeo y cotización con vencimiento. No hace falta para la primera versión. Elevar el precio no bloquea un exploit de un solo intento y puede reducir las aportaciones que sostienen la continuidad.

No cobrar de nuevo porque el cliente reintente tras perder conexión. Una admisión tiene un ID/nonce y un único resultado elegible; recuperación y error son parte de la misma orden.

## Qué publicar para que sea evaluable

- Por ronda: activo/red, bounty, reserva aparte, precio/reparto, deadlines, versión de reglas, estado y cambios de estado.
- Por guardián: versión exacta, intentos/sesiones evaluadas, aperturas válidas, errores, contexto permitido, costo/latencia y linaje de derrotas. Separar laboratorio de intentos públicos.
- Un invicto con tres intentos no es comparable a uno con miles. Igualar presupuesto de evaluación y usar casos reservados; la tasa de rechazo no es una probabilidad universal de victoria.
- Después de fijar dueño/orden y resolver el intento, publicar evidencia y estrategia ganadora según política de privacidad previa. Nunca exponer en mempool un prompt ganador sin fijar antes su beneficiario. No publicar datos privados accidentalmente incluidos por jugadores.
- Exportar manifiestos, resultados y saldos/obligaciones, con verificaciones ejecutables desde otro equipo. Un badge de nuestra web no sustituye el verificador.

## Prueba de ejecución: tres alcances distintos

1. **Registro del operador:** hashes, manifiestos, recibos y contabilidad. Útil para trazabilidad; el operador conserva capacidad de fabricar evidencia. Es el límite de la beta descrita en el estado local.
2. **Ejecutor atestiguado:** medición del código/configuración, clave ligada a esa medición y recibo que vincula entrada/salida/beneficiario/ronda. Debe cubrir claves, gobierno, orden, recuperación y rechazo de replay/clonación. Si llama una API normal, no acredita los pesos de esa API.
3. **Inferencia verificable:** además de lo anterior, verificar el entorno del proveedor, su conexión y qué modelo/configuración cubre realmente la medición. No presumir identidad de pesos porque exista una firma; revisar los artefactos medidos. Puede limitar el catálogo disponible.

Consecuencia: selector libre en práctica, roster pequeño y comprobable para fondos. No degradar silenciosamente a una ruta sin evidencia si la ruta verificada falla. Las reglas de error/cancelación deben cubrir esa caída.

El problema de repetir una inferencia y elegir solo la salida conveniente sigue abierto. Un nonce de pago único y un TEE no bastan solos: probar clones/restores y asegurar una historia externa y política de ejecución que no permita escoger muestras. El criterio ya definido en PRIZE-AUTHORITY sigue siendo obligatorio para afirmar independencia del operador.

## Freysa: ideas y límites comprobados hoy

El [README del juego original](https://github.com/0xfreysa/agent) documenta prompt público, decisiones por tool calling, precio creciente, 70% de las tarifas al premio y reparto a participantes al finalizar sin ganador. Es una referencia para mecánica y reglas visibles; no constituye por sí mismo prueba criptográfica de inferencia ni un diseño de continuidad multi-modelo.

El [Sovereign Framework, README fijado](https://github.com/0xfreysa/sovereign-freysa/blob/002a3d75097f15f6abe7f3680394188d80d01fd8/README.md) describe AWS Nitro, claves condicionadas por mediciones, evolución aprobada por Safe y respuestas firmadas. Es el referente más directo para nuestra prueba de autoridad. Son repositorios y alcances diferentes; no atribuir retrospectivamente ese framework al bounty original. Una autoridad capaz de aprobar nuevas imágenes/instancias también debe quedar limitada frente a rondas activas. Esta consulta de documentación no fue una auditoría de sus contratos o despliegues.

La [documentación de verificación de Phala](https://docs.phala.com/phala-cloud/confidential-ai/verify/overview), consultada hoy, distingue gateway atestiguado de proveedor upstream verificado. Exige comprobar hashes, firma, identidad del workload y estado upstream; las respuestas routed no atestiguan el upstream. Esa distinción debe conservarse en nuestros recibos. Su documentación es candidata de integración, no evidencia de que Vault ya tenga esa infraestructura.

## Secuencia de trabajo propuesta

1. Simular escenarios reproducibles: modelos vencidos en primer intento, exploit transferible a todos, nula actividad, vencimientos y refunds, muchos errores, costo API alto y caída de liquidez. Medir exposición total, cobertura de obligaciones, continuidad y presupuesto operativo; sin probabilidades de éxito inventadas.
2. Probar estados, aislamiento y rehabilitación en testnet. Fijar los parámetros que la simulación permita sostener; no desplegar porcentajes preliminares como definitivos.
3. Ejecutar la prueba de autoridad ya preparada con claves sin fondos, evidencia válida y negativa, y ataques de repetición/restauración. El simple arranque del verificador no satisface ese objetivo.
4. Integrar escrow con presupuesto acotado y claims por wallet fija, expiración sin permiso del operador, auditoría de permisos y revisión independiente antes de premios con valor real.

No hay autoentrenamiento durante una ronda ni promesa de seguridad absoluta. El aprendizaje inicial consiste en conservar ataques, medir fallos y publicar nuevas versiones entre rondas.
