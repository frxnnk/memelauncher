# Estado real del radar y lanzador

Verificado el 12 de septiembre de 2026, aproximadamente 06:25 ART / 09:25 UTC.

## Resultado

Existe un prototipo local de radar asistido, con consultas públicas, mapa e historial. No existe todavía el circuito autónomo noticia → idea → materiales → token confirmado. El modo manual solicitado, «launcheá esto y hacé todo», tampoco está implementado.

| Capacidad | Evidencia actual | Límite |
| --- | --- | --- |
| Consultar mercado | `node market-agent/cli.mjs scan --limit 1 --query CATGPT` terminó con código 0 y tres consultas correctas a DEX Screener. | Consulta acotada bajo demanda; no demuestra oportunidad ni relevancia de todos los resultados. |
| Mapa interactivo | Abrí el HTML existente en un navegador y comprobé cambio de noticia, selección de interpretación y expansión de revisión posterior con fuente. Catálogo: 3 noticias, 9 interpretaciones. | Archivo generado con datos incorporados; no es una aplicación conectada a un feed. |
| Historial social | `followup.mjs status` informa 18 fuentes conservadas. Las pruebas verifican comparación, deduplicación y conservación tras capturas fallidas. | Último lote real registrado: 2026-09-12 07:34:47 UTC / 04:34:47 ART. Importar requiere preparar una captura. |
| Leer X por API | Existe `x-search.mjs`; sus pruebas con respuestas simuladas pasan. | El entorno de este proceso no tiene la credencial configurada. No se verificó acceso autenticado, ni hay ingesta continua implementada. |
| Entender noticias/memes y elegir ideas | Hay instrucciones y propuestas curadas con sus fuentes en `concepts.json`. | El trabajo editorial lo realiza el asistente durante las pasadas. `ideas.mjs` valida datos y disposiciones suministradas; no invoca por sí solo un modelo para descubrir o crear ideas. |
| Preparar metadata | Ejecuté `cli.mjs prepare` con una entrada ficticia identificada como auditoría; produjo metadata y propuesta locales. | Recibe nombre/ticker/tesis ya escritos. No genera imágenes, sitio, metadata publicada ni token. Exige un `decision.json` previo: falta una entrada directa desde un meme/post para el modo manual. |
| Preparación de Long | Seis pruebas de su preparador pasan. Hay codificación de una transacción sin firma y registros históricos de simulación fallida. | El contrato capturado sigue pausado según la lectura nueva. No hay transacción utilizable validada ni equivalencia verificada con la ruta actual del frontend. |
| Ejecución manual o automática | `server/adapter.ts` contiene `OfflineAdapter`; `requestLive` lanza `LIVE_EXECUTOR_NOT_IMPLEMENTED`. | No hay firma, envío ni verificación de recibos reales. La simulación de BELLFLY no es un lanzador genérico conectado al radar. |

## Pruebas de esta revisión

- Radar: 61 pruebas aprobadas, ninguna fallida.
- Preparador de Long: 6 pruebas aprobadas, ninguna fallida.
- Aplicación BELLFLY: 15 pruebas aprobadas, ninguna fallida, incluyendo ejecución simulada con subproceso Python. No se repitió el experimento científico de referencia.
- La primera consulta de mercado falló bajo la restricción de red del entorno; la repetición autorizada fuera de esa restricción funcionó. Ambos archivos se conservaron. No hubo un rechazo del revisor automático.
- Prueba del mapa: interacción básica y captura visual en el navegador. No se auditó toda la interfaz, accesibilidad, móvil ni publicación externa.
- Ninguna de estas pruebas demuestra calidad predictiva o rentabilidad.

## Lectura actual de la ruta capturada de Long

En `long-factory-read.json`: consulta pública a Robinhood Chain 4663, bloque 60996866, observada el 12/09 a las 09:23:57.878 UTC. El contrato `0x22e99278308B393ea1260859B181AD7E78f5eeED` devuelve `paused: true`.

Esta lectura describe únicamente el contrato que usa el preparador existente. No permite afirmar que todas las rutas actuales de Long estén pausadas. No se firmó ni transmitió ninguna transacción.

## Próximos entregables concretos

1. Validar una ruta actual de lanzamiento de punta a punta en preparación/simulación, con su plataforma, red, parámetros y costos. La ruta antigua no basta.
2. Construir el modo manual: recibir texto, imagen o enlace; preservar la idea; generar identidad y materiales; aplicar un perfil de lanzamiento previamente configurado; preparar y ejecutar mediante el proveedor validado; devolver contrato y enlaces verificados.
3. Dar al ejecutor persistencia y recuperación reales: distinguir preparado, enviado, confirmado y fallo; reconciliar un envío dudoso antes de reintentar; verificar la configuración efectiva del token. Reutilizar principios del simulador no equivale a tener esta integración terminada.
4. Convertir el radar asistido en un proceso operativo: acceso real a fuentes, descubrimiento periódico, interpretación y comparación mediante modelo, actualización del mapa y avisos por cambios relevantes.
5. Conectar el radar al mismo lanzador bajo reglas autorizadas de selección, presupuesto, frecuencia, vencimiento de propuestas y pausa. Debe poder abstenerse de lanzar.

El primer circuito demostrable debe ser: una idea suministrada → paquete completo → simulación correcta → lanzamiento autorizado → contrato confirmado. La selección automática se conecta después al mismo ejecutor.

## Evidencia local

- Consulta correcta: `../2026-09-12T09-23-23-582Z-ff0f332a-2d0f-4eee-a125-0a2ea12f3620/scan.json` y `REPORT.md`.
- Consulta con red restringida: `../2026-09-12T09-22-47-148Z-83a4f1ba-f4d0-4efb-a5c9-b8c780e7debf/scan.json`.
- Entrada ficticia de preparación: `prepare-input.json`.
- Salida ficticia de preparación: `../draft-2026-09-12T09-24-24-958Z-b2322b68-2aa4-4fb1-aaa8-ff920c0532b0/`.
- Historial social existente: `../social/2026-09-12T07-41-04-113Z-d9d5f6bc-2d84-4bdd-968b-f7e129c7eba1/`.

El repositorio sigue sin commits ni remoto configurado. Esta revisión generó únicamente archivos locales de diagnóstico y pruebas; no publicó, lanzó ni conectó cuentas.
