# Validación del radar autónomo — 13 de septiembre de 2026

## Comprobado

El proceso `node market-agent/scout.mjs run` completó una investigación real usando
Codex CLI con login existente de ChatGPT, búsqueda web y consultas públicas de DEX
Screener. Las ideas y su revisión fueron producidas por el proceso, sin editar a
mano el JSON de propuestas. No se usó ningún agente como ayudante de programación;
las invocaciones de Codex son el runtime del producto probado.

Corrida completa: `output/market-agent/autonomous/run-2026-09-13T07-10-13-764Z-203bcc37-6ef3-4e22-9880-cded8bfcaff7/`.

- Inicio: 07:10:13.764 UTC; final: 07:12:52.523 UTC, aproximadamente 2m39s.
- Descubrimiento: 7 fuentes registradas, una historia seleccionada y dos interpretaciones.
- Mercado: consultas `Captain Matt` (30 pares) y `Mirene` (0 pares), ambas correctas;
  también se guardó la consulta acotada de metas del colector.
- Revisión: una idea `EXPLORE` y una `REWORK`. Ninguna es una autorización de lanzamiento.
- Memoria, decisiones, eventos, prompts, respuestas y hashes guardados; `latest.json`
  apunta al resultado completo. El mapa fue abierto en navegador y se comprobó el
  cambio entre ambas interpretaciones.
- Verificación posterior de dos fuentes citadas por el runtime: la noticia de
  [TechCrunch](https://techcrunch.com/2026/09/12/automattic-confirms-mullenweg-has-returned-as-ceo-after-attempted-ouster-by-board/)
  y el [anuncio personal original](https://ma.tt/2026/09/mirene/). Esta comprobación
  fue posterior al resultado congelado; no se incorporó como evidencia previa.

La primera corrida falló porque el modelo devolvió fechas con día, sin hora. Está
conservada en `run-2026-09-13T07-05-17-341Z-06827198-d6c7-454f-b388-7c78234f02ea/`.
Se corrigió el manejo de fechas parciales sin inventar medianoche y se ajustó la
búsqueda, que era demasiado restrictiva al exigir recepción social ya observable.
No se convirtió esa corrida fallida en un éxito retroactivo.

## Verificación de código

77 pruebas del módulo radar aprobadas: 61 existentes y 16 del nuevo circuito.
Incluyen dos etapas de modelo con mercado intermedio, abstención, conservación del
último resultado válido, locks, referencias y pools inventados, fechas parciales,
memoria de fuentes ausentes, límites de búsqueda/tiempo, herramientas inesperadas
y texto UTF-8 partido entre fragmentos de salida. La suite usa modelos simulados;
la corrida de arriba es la prueba adicional con modelo y datos reales.

Tras esa corrida se añadieron la cancelación del proceso, la desactivación de lectura
de imágenes locales, la detección de herramientas inesperadas y una aclaración de
cobertura en la presentación. Se verificaron con la suite; no se repitió la
investigación completa para esas modificaciones. `scout.mjs view` genera una vista
actualizada del mismo resultado sin alterar el archivo histórico.

## Límites observados

- La búsqueda web no obtuvo publicaciones verificables de X; se informó un 403.
  No hay feed autenticado, cobertura completa de respuestas ni inspección de video
  en esta prueba. La idea se conservó como hipótesis apoyada en noticias y comentarios.
- Los niveles `full_text` / `search_excerpt` son informados por el modelo. Los
  eventos documentan las acciones, pero no contienen una certificación independiente
  de cada afirmación ni todos los cuerpos de las páginas visitadas.
- El contexto cultural puede ser poco reconocible fuera de su comunidad. Esta
  ejecución demuestra autonomía técnica, no superioridad sobre el criterio del usuario.
- La etapa de descubrimiento dice que aún no consultó DEX: las consultas ocurren
  después, antes de revisar. La vista actual aclara explícitamente ese orden.
- El runtime informó 258627 tokens de entrada (194688 cacheados) y 2941 de salida
  para descubrimiento; 24236 de entrada y 816 de salida para revisión. Las cifras
  son del runtime, no dólares, personas alcanzadas ni ventaja predictiva. Todavía hay
  contexto de skills cargado por la CLI pese a ignorar configuración de usuario;
  conviene reducirlo antes de aumentar la frecuencia.
- No hay scheduler, monitor 24/7, publicación, wallet, firma ni lanzamiento real.
  Ninguna ruta de Long fue revalidada durante este trabajo.

## Uso

```powershell
node market-agent/scout.mjs run
node market-agent/scout.mjs view
node market-agent/scout.mjs status
```

El modelo usa el modo no interactivo con salida estructurada documentado por
[OpenAI](https://learn.chatgpt.com/docs/non-interactive-mode). El proceso necesita
acceso al login de la CLI y a la red; no se leyeron ni copiaron tokens de autenticación.

Los siguientes trabajos son mejorar la lectura directa de X y el contenido visual,
medir calidad contra una selección humana previa a resultados y conectar una ruta
real de lanzamiento. Esas capacidades no están implícitas en esta validación.
