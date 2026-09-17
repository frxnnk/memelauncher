# Checkpoint de investigación — ronda 3

Goal activo por instrucción del usuario: continuar con cuatro agentes hasta agotar el cupo principal disponible. Inicio 05:47 UTC: 53% usado / 47% disponible. Última comprobación 06:18:50 UTC: 67% usado / 33% disponible. Créditos adicionales y resets disponibles: cero. No se compran ni canjean. No marcar el goal completo mientras siga pendiente esta instrucción.

## Actualización integrada a 06:27 UTC

- `DECISION.md` integra los resultados completos de la ronda 3 y sustituye sus conclusiones preliminares de abajo. Los documentos anteriores tienen un enlace a esta actualización.
- Mercado: segunda captura de los mismos42 pools a06:12:36–47. CATGPTMC7,650M, ANTHLong2,147M, CLAUDEGATOR217K. ANTH/CLAUDE rebotaron18,04%/38,21% desde05:50, aún−21,68%/−73,74% desde04:48. MONEYMC1,289M y+110,42% desde04:11. `tracked-interval.json` conserva cada intervalo.
- Profundidad:63llamadasRPC al bloque60.879.734 de06:05:54,48quotes para4pools,0errores. `depth/quotes-four-pools.json`, `depth/LECTURA.md` y gráficoPNG/SVG. USDGpoolsLP5%+protocolo0,1%→5,095% antes de curva. No comparar nominalwrapper conUSDG como mismo capital.
- Fees: informe completo,16cobrosCAT y19ventasexactamenteconciliadas pagaron3,193118245290266401ETHalreceiver; gasventas0,000855059771962ETH. LPcreator95%×0,2%; hook1,4%otra ruta. UIcompatible con marktomarket, noUSDrealizados.
- ALL:161derivados154≤10K/4>10K/3null; muestra6pequeños0compras1h. Drops3derivados14transferencias13direcciones; noaudiencia única. `distribution/LECTURA.md` completo33JSONválidos.
- Cultura:BetterCallSteel8autoresposterioresalcorte,yaexistíaantes. STEELtokenUS$5,01vol1h. ACME+0,17%views;Warsawsinrenovaciónexactacomparable. `culture/REPORT.md` completo.
- Ronda4 activa: fresh_narratives top25Base+25BSC con orígenesFLM/BUDDY/BinanceTown; launch_space emisor/catálogo/controles deGOOGLc/AAPLc y quizáQQQB; winner_refresh revisión independiente profundidad/fees. Root mantiene síntesis y continuidad.
- PythonMatplotlib quedó en `plot-deps/` local, instalado en contexto escalado. Para volver a graficar requiere ejecución escalada por ACL; no escanear recursivamente esa carpeta desde sandbox. No dependencias de aplicación modificadas.

El resto del checkpoint documenta el estado preliminar anterior; leer primero `DECISION.md`.

## Avances guardados

- `tracked-first.json` y `tracked-first-summary.json`: 42 pools exactos refrescados 05:50:39–05:50:52 UTC; 18 winners previos, cohorte fija de 11 pares pre-IPO, seis pares adicionales y siete culturales.
- Los diez memes recientes de la cohorte IA cayeron frente a 04:48; el token AI anterior quedó con precio residual sin actividad horaria. CATGPT MC7,739M; ANTHROPIG LONG1,819M; CLAUDEGATOR157K y −81% desde el corte previo. No equiparar esta muestra con todo el mercado.
- STEEL seguido: volumen1h5,01USD / una compra. Los otros seis culturales tienen volumen1h cero; null de liquidez no equivale a cero.
- `depth/LECTURA.md`: quoter oficial, bloque60.875.164 a05:58:10UTC, 24 simulaciones para CATGPT y ANTHROPIG. Tamaño10Kquote: desvío8,46%/13,49%; tamaño25K:17,13%/26,76%. Sin transacciones.
- `discovery-feeds.json`, `meta-contrast.json`: contraste de categorías DEX. Slang tiene gran variación agregada pero predominan activos antiguos; no declararlo narrativa nacida hoy. Los boosts son promoción, no organicidad.
- `catgpt-ui.txt`: contador claimedUSD bajó frente al corte anterior; la fórmula exacta sigue pendiente de conciliación con ledger/precios. No llamarlo ingresos realizados.

## Trabajo paralelo en curso

- `winner_refresh`: ledger completo de fees LP, cambios de receptor, fees de hook separadas, gas y ventas comprobables. Hallazgos parciales: CATGPT16cobros; ANTHROPIG aúnsinCollect/Release al bloque05:52. LPfee0,2%; hookfeeefectiva1,4%; el routing de esta última va a un integrador y no al beneficiario LP. No sumar ambas como ingreso del creador. Esperar informe en `fees/`.
- `fresh_narratives`: Steel sigue sumando autores pequeños, originalsubióa2,248Mvistas; ACMEapenas+0,17%. Busca nuevas escenas posteriores al corte y controla revivals. PosiblesfrentesMbappé/PSG yOmos–Rey requieren evidencia adicional.
- `launch_space`: ALL161derivados:154<=10K/4>10K/3null. Muestraregla10tokens; seis pequeños sin compras1h, incluso algunosconpayouts. Revisa recibos/recompensas; no confundir100% de un splitcon100% del volumen negociado.

## Siguientes pasos de root

1. Terminar contraste de profundidad con pools USDG/ruta externa si se pueden obtener claves y simular con lecturas públicas. No conectar wallet.
2. Integrar informes y corregir contradicciones entre comentarios de código, eventos, UI y efectivo realmente obtenido.
3. Segunda captura de la MISMA cohorte tras un intervalo útil; nuevas expresiones culturales solo si aparecen en fuentes independientes.
4. Revisar el cupo periódicamente, sin polling continuo. Conservar snapshots y reporte actualizado antes de agotar acceso. No programar seguimiento externo ni publicar.
