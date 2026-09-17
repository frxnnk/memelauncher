# Prueba concreta de autoridad del premio

14/09/2026. Propuesta de evaluación; no contrato, hosting contratado ni prueba de Vault atestiguado. Continúa [el diseño de autoridad](PRIZE-AUTHORITY.md).

La primera instancia debe ejecutar solo respuestas de prueba y un firmante sin fondos. El propósito es descubrir si se puede evitar que el operador modifique una decisión o elija entre repeticiones. Una máquina que firma respuestas correctamente todavía puede fallar esa prueba.

## Versiones identificadas

La consulta actual a GitHub distingue componentes que no deben confundirse: `verifier-v0.5.11` es una publicación no preliminar del **verificador**, del 10/06/2026. Hay publicaciones preliminares `verifier-v0.6.0-rc3` y `mkosi-os-v0.6.0-rc4` de septiembre. Esto no selecciona automáticamente una versión de runtime, OS o SDK para Vault. [Releases](https://github.com/Dstack-TEE/dstack/releases).

Se fijó el verificador de la [publicación 0.5.11](https://github.com/Dstack-TEE/dstack/releases/tag/verifier-v0.5.11), commit `245201be13be06f84b54c416c52b350612aa695e`, con el digest de imagen publicado:

```text
docker.io/dstacktee/dstack-verifier@sha256:a000adea64ba689c8949647bfaa034e56b3e1f537ddf6ae97182abb95e7f560d
```

El digest proviene del cuerpo de esa release; no se verificó independientemente su entrada Sigstore. [README inmutable](https://github.com/Dstack-TEE/dstack/blob/245201be13be06f84b54c416c52b350612aa695e/verifier/README.md), [registro local de fuentes](../../vault-lab/output/authority-research/verifier-probe-preparation.json).

El [compose local](../../vault-lab/deploy/dstack-verifier.compose.yaml) fija ese digest, publica solamente `127.0.0.1:4811` y no entrega variables de la app, wallets, secretos, socket de Docker o carpetas del host. Limita CPU/memoria/procesos y usa almacenamiento temporal pequeño. Sirve para comprobar arranque y rechazo de datos inválidos. La descarga y cálculo de imágenes OS válidas requiere dimensionar cache y recursos por separado; este archivo no es la configuración de la futura CVM.

Comandos preparados desde la raíz del proyecto:

```text
docker compose -p vault-authority-probe -f vault-lab/deploy/dstack-verifier.compose.yaml config --quiet
docker compose -p vault-authority-probe -f vault-lab/deploy/dstack-verifier.compose.yaml up -d
docker compose -p vault-authority-probe -f vault-lab/deploy/dstack-verifier.compose.yaml down
```

Ejecutar un verificador oficial evita escribir una implementación criptográfica propia. Su salida debe obtenerse de ese proceso controlado; un JSON `is_valid` subido por un usuario o escrito por nuestro servidor no constituye verificación. Su resultado tampoco comprueba por sí solo gobierno, KMS, unión con la conexión real o exclusión de repeticiones. [Alcance del verificador](https://docs.phala.com/phala-cloud/attestation/verify-the-platform).

## Infraestructura propuesta para la prueba real

Phala publica `tdx.medium` con 2 vCPU/4 GB a USD 0,12 por hora y disco a USD 0,000139 por GB/hora. Dos horas con 20 GB dan **USD 0,24556 estimados** de cómputo y disco. La capacidad, impuestos, mínimos y un límite efectivo de facturación siguen sin verificar en una cuenta. Detener cómputo conserva cargos de disco; el precio no es un tope autorizado. [Tarifas consultadas](https://phala.com/pricing).

Propuesta: una CVM temporal durante hasta dos horas, sin modelos facturables, token o datos reales. Antes de contratar: confirmar precio final, release/mediciones compatibles con el verificador, límite de gasto y procedimiento para conservar evidencia y eliminar esa CVM. No se contrató nada ni se asume acceso a créditos promocionales.

## Qué debe producir esa instancia

1. Un paquete de código e imagen con digest y una configuración completa comprometida antes del primer intento. El verificador debe contrastar las mediciones con esa selección; no confiar en los valores que declara la propia app.
2. Un desafío aleatorio del verificador, medición del entorno y unión con la clave y conexión que entregan la respuesta. Una captura vieja del dashboard no cumple la frescura requerida.
3. Evidencia separada de KMS, permisos de actualización de la aplicación/plataforma, propietarios efectivos y método para impedir cambios con autoridad sobre una ronda vigente.
4. Un registro externo de admisión y estado por intento, ligado a ronda, cuenta, destinatario, modelo, historial y prompt. Aun con ese registro hay que demostrar que clones/restores no generan varias muestras elegibles de la misma autorización.
5. Una prueba adversarial con proveedor de fixture fuera del almacenamiento que se restaura: cuenta cada solicitud y devuelve resultados distintos para revelar reinferencias. Reiniciar antes/después del envío y después del recibo, clonar estado y suprimir una respuesta. El ensayo falla si el operador puede seleccionar la muestra ganadora.
6. Una verificación desde otro equipo usando mediciones esperadas y herramientas oficiales. Guardar entradas completas, resultados positivos/negativos y límites. No aceptar una captura o hash autoemitido como sustituto.

Solo después de demostrar esas propiedades conviene integrar el escrow de testnet y una llamada real al proveedor presupuestada por separado. El contrato debe fijar destinatario, ronda, monto, autoridad efectiva y cancelación; pagar una sola vez no elimina una selección fraudulenta anterior.

## Estado y siguiente decisión

Se validó la sintaxis con `docker compose ... config --quiet`. Docker Desktop se inició oculto, pero `docker info` no respondió; se canceló esa consulta. Se observó el pipe del motor, sin demostrar disponibilidad de su API. No se descargó la imagen, no arrancó un contenedor y no se envió una quote. No se atribuye el problema a WSL, permisos o licencia sin diagnóstico adicional. Docker Desktop quedó iniciado; el probe no creó recursos cloud ni contenedores. [Evidencia del intento](../../vault-lab/output/authority-research/verifier-probe-preparation.json).

Release/digest, fuentes, restricciones del contenedor y costo orientativo identificados. La compatibilidad con una CVM concreta, atestación válida de Vault, control de KMS, resistencia a clones y escrow siguen pendientes. No se ejecutó un firmante, no se generó un premio ni se habilitaron pagos. El resultado de la prueba local se registra por separado para no confundir infraestructura preparada con autoridad demostrada.
