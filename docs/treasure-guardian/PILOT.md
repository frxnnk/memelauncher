# Piloto funcional: modelos, créditos y tesoro

14 de septiembre de 2026. Demo y contabilidad TEST implementadas; conector de wallet preparado, sin conexión efectuada, cobros, token emitido ni inferencia real. Identidad y acción relacionadas siguen abiertas. Ver [estado implementado y recuperación](IMPLEMENTATION.md).

## Decisiones recomendadas

**Práctica:** selector amplio de modelos candidatos. **Dirección aceptada para la primera ronda con premio:** cofre común y 2–3 guardianes aprobados, con modelos, endpoints, prompt, parámetros y precio publicados y congelados por ronda. La dificultad queda expuesta al más fácil de esa lista. No se sabe aún cuál es: el catálogo no mide resistencia. [Implementación y pendientes actuales](LAUNCH-HANDOFF.md).

**Condición de victoria:** conservar una sola acción estructurada válida. Es un desafío de romper la regla del guardián, no una puntuación secreta de persuasión. La respuesta y el resultado se conservan íntegros. Cualquier capa adicional que pueda bloquear una victoria cambia las reglas y tiene que ser pública antes de pagar.

**Modelo y personalidad:** probar primero Qwen9B, Gemini Flash y Claude Haiku con los perfiles públicos de endpoint/proveedor y reasoning explícito ya implementados. Qwen27B queda como otro candidato. Medir llamadas válidas, aperturas, errores, costo, demora y calidad del rival. No endurecer el prompt sin medir si el juego sigue siendo entretenido. [Research de modelos](MODEL-EVALUATION-RESEARCH.md).

**Primer dinero:** usar el mismo activo del proyecto para recargas y premio reduce conversiones. Su cantidad se expresa en unidades del token, sin garantizar valor USD. La API necesita fondos líquidos de operación, aunque el token baje o no pueda venderse. Un premio estable requiere conversión y custodia adicionales antes de aceptar recargas. Robinhood Chain + Long sigue candidata; falta elegir/verificar token, par y contratos. [Research de tesorería](TREASURY-RESEARCH.md).

## Lo que ve el jugador

1. `Connect wallet` → autenticación con nonce, dominio y vencimiento. Conectar no autoriza retirar ni gastar fondos.
2. `Add credits` → activo, cantidad, créditos, destino y términos; la wallet confirma su transacción. La recarga pasa por `Pending` hasta la confirmación exigida.
3. El mensaje muestra precio y reparto antes de enviar. Su costo queda reservado; el servidor acepta una vez el intento con su posición de cola.
4. Respuesta válida que no abre: consumir créditos una sola vez y animar el aporte real hacia el cofre. Ejemplo de 100 unidades con reparto ilustrativo 70/20/10: `+70 to this vault`, `20 operations`, `10 next round`.
5. Error técnico confirmado: liberar la reserva, indicar `Credits returned` y no aumentar el tesoro. Resultado incierto: `Reconciling`, sin repetir un cobro ambiguo.
6. Apertura válida: cerrar la ronda, reservar el premio al jugador aceptado y mostrar `Payout pending`; `Paid` solo tras confirmación. El modelo no elige direcciones ni cantidades.

El historial distingue **asignación contable** y **transferencia onchain**. Si el depósito fue onchain y cada consumo se registra internamente, no presentar una animación por mensaje como una transacción blockchain. Una liquidación por lotes necesita pruebas y periodicidad publicadas; el riesgo del operador permanece mientras ese registro sea suyo.

La pantalla principal conserva chat y mascota. Al activar TEST aparecen precio, créditos y premio del ledger local; cada respuesta confirmada muestra su reparto. Actividad, saldos y conexión de wallet están en el panel de tesorería. Los controles están implementados como laboratorio; el circuito descrito arriba con autenticación, depósitos y pagos reales sigue pendiente.

## Economía para probar

**70% premio / 20% operación / 10% siguiente ronda** es una hipótesis de simulación, no una decisión cerrada. Se aplica al intento válido ganador también; su aporte integra el premio antes del pago. El ejemplo contable completo está en el research de tesorería. El precio se fija por ronda después de medir costos por modelo y contexto.

Para un precio neto realizable `P` por intento y costo operativo esperado `C` —API de errores reembolsados, infraestructura, gas y conversión incluidos—, ese reparto cubre operación solo si `0,20 × P >= C`. Es una condición contable propuesta, no una predicción de precio o demanda. Probar también peor costo observado y liquidez adversa. Nunca cubrir pérdidas operativas con créditos sin consumir ni con premio comprometido.

Creator fees: cobrarlas, registrar activos recibidos y asignarlas según política. Los [términos actuales de Long](https://app.long.xyz/terms) requieren iniciar el claim y no garantizan que una estimación sea cobrable. Verificar que el contrato de tesorería pueda ejecutar ese cobro. Las cifras de CATGPT, OCAT o BELLFLY no fijan nuestros porcentajes.

Sponsors: el aporte anunciado al premio entra íntegro al cofre; publicidad e infraestructura se registran aparte. No dan privilegios para ganar. Promesas de sponsors o futuras fees no son saldo. Una reserva siguiente permite probar continuidad; no demuestra un bounty infinito autosostenible.

Supply, asignación del equipo, vesting y permisos de emisión quedan pendientes del lanzamiento exacto. La utilidad de acceso no vuelve al token una acción de la empresa asociada al par. No añadir recompensas a holders, recompras o derechos al premio sin una decisión expresa.

## Entrega y orden de implementación

**Preparado:** [runner reproducible](../../vault-lab/eval/README.md), 14 escenarios, hasta 162 llamadas para tres repeticiones. Primera repetición de compatibilidad: máximo 54 llamadas. Pruebas con mocks aprobadas; ninguna inferencia paga ejecutada.

**Próximo acceso necesario:** key dedicada de OpenRouter y presupuesto limitado; ejecutar compatibilidad, revisar resultados y después repetir/adaptar ataques. No hay base para anunciar hoy dificultad, tasa de apertura o mejor modelo.

**Integración de dinero:** el ledger transaccional, cola, reserva/reembolso, cierre y payout simulado ya tienen pruebas. El validador de depósitos comprueba evidencia suministrada, sin consultarla ni acreditar fondos. Faltan token/red/activo premio y autoridad, login de wallet, órdenes/indexer/finalidad, escrow, ejecutor de payout y conciliación con fondos reales. Conectar una wallet sin ese circuito no convierte la demo en producto cobrable.

**Confianza:** una API externa y nuestros recibos no demuestran que el operador no pueda fabricar al ganador. Antes de anunciar independencia hay que verificar una ruta de ejecución y autorización que lo impida, o describir claramente el piloto como operado por nosotros. Publicar prompt y contrato por separado no resuelve ese punto.
