# Ensayo web sobre Robinhood Chain Testnet

Estado: 2026-09-15. El usuario eligió probar con un token existente y pasar al token de Long después; también eligió probar directamente en Robinhood, no en Base. Phantom ya está vinculada y financiada por el faucet oficial. El ensayo se preparó con AMZN de testnet recibido del faucet; falta la segunda wallet receptora. Esto no elige un stock ni una asociación para el lanzamiento.

## Implementado y verificado

- Red compartida entre cliente y servidor: Robinhood Chain Testnet, 46630 / 0xb626, gas ETH. El RPC oficial respondió con ese identificador.
- Phantom externo mediante su proveedor EVM propio (`window.phantom.ethereum`), sin depender del proveedor global que puede entrar en conflicto con Brave Wallet.
- Conectar no requiere testnet: SIWE usa la red activa de la wallet y no cambia redes. La firma de una recarga sí exige Robinhood testnet. Esto corrige el error real Not in testnet mode al intentar conectar.
- Firma SIWE emitida por Privy para vincular una wallet a una cuenta ya autenticada. El servidor obtiene las wallets desde el identity token firmado por Privy, nunca desde una dirección declarada por el navegador.
- Se observó un segundo error real de Phantom: dirección inconsistente para verificar la firma. El cliente ahora normaliza EIP-55 antes de generar el mensaje Privy y enviar personal_sign; revalida cuenta y red antes de firmar. Tras publicar, la UI autenticada confirmó Wallet linked y mostró la dirección verificada por el servidor. Viem 2.56.0, ya presente como dependencia transitiva de Privy, se declaró directa para usar su conversión de direcciones sin implementar criptografía propia.
- Pago ERC-20 con importe, token, destinatario y red contrastados contra la orden revisada. No se solicita allowance ilimitada. Cambios de cuenta/red o una orden vencida bloquean el envío.
- API web de órdenes, historial, verificación RPC, saldo, intento con créditos y recuperación. Sólo se instancia con configuración explícita de testnet y beta cerrada; el arranque rechaza mainnet.
- Monitor de depósitos persistente, límites compartidos de inferencia y ledger separado de las simulaciones TEST.
- Una ronda por modelo en la configuración web. El manifiesto congela modelo, prompt y precio; no se cambia el activo de un saldo existente.
- El depósito confirmado crea crédito disponible. El intento reserva su precio y sólo una respuesta válida consume/splittea crédito. Errores confirmados devuelven la reserva; incertidumbres preservan referencias para reconciliar.
- El bounty y los recibos muestran la contribución contabilizada. Un premio adjudicado queda como payable; no se presenta como pagado.
- Recuperación del hash tras perder una respuesta y bloqueo de reenvío ciego. Web Locks coordina los envíos entre pestañas del mismo origen.
- 232 pruebas y build completos. La prueba visual anterior recorrió recarga, crédito y dos mensajes con proveedores sintéticos; mobile 390x844 sin desborde horizontal. La firma real de vinculación con Phantom sí se confirmó después; la transferencia en Robinhood todavía no.

## Publicado vs local

Frontend publicado: https://vault-closed-beta.vercel.app/play
Deployment: dpl_BQcdvYFFYNByWf6fsRqP1mUZcmF3.
Se comprobaron diez archivos públicos por hash contra el código local. La cuenta sigue protegida por autenticación (401 sin credenciales). La sesión existente de Brave se restauró, conservó su invitación y 21/25 intentos; Phantom quedó vinculada a esa cuenta. Evidencia: estado Wallet linked y dirección EVM visible en el resumen de cuenta.

La API se actualizó de e6a7e1e9ae99 a b304f17115bd. Las rutas de funding ya están desplegadas y devuelven enabled:false hasta completar la configuración. Se preservaron tres sesiones, cuatro solicitudes registradas y el consumo de USD 0.00609. El respaldo con el servicio detenido verificó ocho archivos por hash y cinco bases SQLite por integridad. No se modificaron credenciales ni se habilitaron depósitos. Evidencia: vault-lab/output/backend-upgrade-2026-09-15.json.

Archivo desplegado en backend: `vault-lab/output/vault-beta-b304f17115bd-c8d06d32.tar.gz`, SHA-256 `c8d06d3218884bdf6f85527ad1e2e54b005b29ce74884acfcab2b88ff6d837b8`, 199 archivos. El frontend posterior corrige la firma SIWE y tiene su propio deployment. `output/beta-package.json` identifica el paquete local más reciente, que no debe confundirse con el backend activo.
Pruebas: `vault-lab/output/release-verification.json`.
Verificación pública y RPC: `vault-lab/output/robinhood-web-deployment.json`.

## Configuración del ensayo

Token candidato verificado contra documentación oficial de Chainlink y RPC: LINK, contrato `0xD610B8f58689de7755947C05342A2DFaC30ebD57`, 18 decimales, chain 46630. El bloque 119750316 confirmó código y metadatos. El preflight encontró cero LINK y cero ETH de prueba en la wallet vinculada. Informe: `vault-lab/output/robinhood-link-preflight.json`.

El usuario completó Google Sign-In y la verificación humana del faucet oficial. La transacción `0x6d1521e824cbd5e42479e34bed46c1dd69c4db29df5c7370891bd99480aeef78` fue confirmada por RPC: 0,01 ETH de prueba y 5 tokens de cada uno de TSLA, AMZN, PLTR, NFLX y AMD. Evidencia: `vault-lab/output/robinhood-faucet-receipt.json`. LINK sigue en cero; ya no es necesario otro faucet para este ensayo.

AMZN de prueba: `0x5884ad2f920c162cfbbacc88c9c51aa75ec09e02`, 18 decimales. Se revisó el proxy verificado y su implementación Stock `0xBd14156E05c6AF28ad39aA53a2AB8eB9CDf657DA`. Transfer delega en ERC20 de OpenZeppelin, sin deducción de fees; el escalado UI añade eventos y no altera los saldos crudos. Los multiplicadores actual y programado fueron 1e18; no estaba pausado. Un eth_call de transferencia a sí mismo devolvió true sin firmar ni mover saldo. Falta simular contra el receptor real y completar el depósito. El emisor puede actualizar, pausar, bloquear y quemar: no es un activo inmutable. Informe: `vault-lab/output/robinhood-stock-preflight.json`.

El borrador privado `.local/robinhood-funding-draft.json` contiene ese activo, máximo de recarga 1 token, precio de ensayo 0,1 token y reparto ilustrativo 70/20/10, con rondas separadas Gemini/Haiku. Es deliberadamente inválido hasta recibir una segunda dirección del usuario. No se subió como configuración activa. Esos valores no son tokenomics comerciales aprobados.

El backend actualizado acepta `VAULT_WEB_FUNDING_CONFIG` (ruta absoluta a un JSON privado de configuración) y `VAULT_FUNDING_RPC_URL` (RPC HTTPS de Robinhood testnet). Exige beta cerrada y Telegram desactivado. Los datos se guardan aparte en `.local/web-funding-testnet`.

Ejemplo deliberadamente inválido hasta completar token y receptor. El precio, tope y reparto son valores de ensayo, no tokenomics aprobados ni una cotización comercial:

```json
{
  "environment": "testnet",
  "asset": {
    "chainId": "46630",
    "tokenAddress": "REEMPLAZAR_POR_CONTRATO_TESTNET_VERIFICADO",
    "destination": "REEMPLAZAR_POR_WALLET_RECEPTORA",
    "decimals": 18,
    "minimumConfirmations": 3,
    "standardTransferVerified": true
  },
  "maximumTopup": "5000000000000000000",
  "terms": { "price": "100000000000000000", "prizeBps": 7000, "operationsBps": 2000 },
  "rounds": [
    { "id": "rh-test-gemini-v1", "models": ["google/gemini-2.5-flash"] },
    { "id": "rh-test-haiku-v1", "models": ["anthropic/claude-haiku-4.5"] }
  ]
}
```

La wallet que paga y la que recibe deben ser distintas. Phantom puede ser la wallet del tester o la receptora, pero una orden no permite pagarse a sí misma. El ensayo puede usar dos cuentas de Phantom o Phantom para tesorería y una wallet Privy para el tester. Las claves quedan en la wallet, nunca en el modelo.

Antes de activar: verificar por RPC el contrato, sus decimales y comportamiento ERC-20 estándar; comprobar saldo de token y ETH de prueba; completar una transferencia mínima y su recuperación tras recargar la página. Confirmar que el saldo, la reserva y el bounty reconcilian. Tres bloques no constituyen una prueba de finalidad L1 ni una garantía para mainnet.

## Pendiente para dinero real

Wallet receptora controlada por el operador; activo concreto en Robinhood; precio y reparto aprobados a partir del costo real de modelos; límites del piloto; mecanismo de devolución y pago del premio; reglas públicas de la beta y modelo de confianza. El operador aún controla custodia y ejecución: el sistema no prueba que sea imposible favorecer a un jugador. No hay payout automático, atestación independiente, fees de Long entrando ni patrocinadores depositando.

El token de Long requerirá una configuración y una ronda nuevas: no se renombra el saldo anterior. Fees y donaciones sólo aumentarán el bounty cuando se verifique su recepción efectiva.

## Fuentes primarias consultadas

- Red/RPC: https://docs.robinhood.com/chain/connecting/
- Compatibilidad EVM: https://docs.robinhood.com/chain/deploy-smart-contracts/
- Phantom testnet: https://help.phantom.com/articles/5997313271699
- Proveedor EVM de Phantom: https://docs.phantom.com/ethereum-monad-testnet-base-and-polygon/getting-started
- SDK Privy: https://docs.privy.io/recipes/core-js y declaraciones del SDK instalado 0.75.0.
- Faucet: https://faucet.testnet.chain.robinhood.com/ (se abrió la página; no se reclamaron tokens ni se confirmó un contrato de faucet).
- LINK de testnet: https://docs.chain.link/resources/link-token-contracts#robinhood-chain-testnet
- Faucet LINK: https://faucets.chain.link/robinhood-testnet
- EIP-4361, checksum de dirección: https://eips.ethereum.org/EIPS/eip-4361
