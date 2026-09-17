# LongX en FOMO: precio, NAV y cambios de oferta

Revisión de solo lectura: 12 de septiembre de 2026, aproximadamente 05:40–05:45 UTC (02:40–02:45 Argentina). Comparación con las observaciones de este mismo chat del 11 de septiembre, aproximadamente 23:45 UTC. Las observaciones no son simultáneas ni cotizaciones ejecutables.

## Resultado

La evidencia favorece una compresión del sobreprecio del mercado secundario frente al NAV publicado por Long. Entre las dos observaciones aumentaron los límites de depósitos y la oferta de ambos tokens; el precio del pool bajó mientras el NAV por token publicado subió ligeramente. Esto no identifica por sí solo qué transacción produjo las caídas exactas de la captura original.

Son los tokens de los vaults LongX de Long.xyz. La identidad se comprobó por dirección completa entre FOMO, Long y las cuentas públicas de Lighter. El nombre de una empresa no establece propiedad de sus acciones ni afiliación.

| Token | Contrato en Robinhood Chain |
|---|---|
| OPENAIx1L | `0xfe09Fb328bE1c286B4f597eD34764b7472ae72c5` |
| ANTHROPICx1L | `0x1937caD42b17D43bB2b347ce16d5288887C46c33` |

## Comparación de las dos observaciones de Long

| Métrica | OPENAI anterior | OPENAI nueva | ANTHROPIC anterior | ANTHROPIC nueva |
|---|---:|---:|---:|---:|
| Precio medio del pool, USD | 1.9603 | 1.0692 | 1.2443 | 1.0643 |
| NAV publicado por token, USD | 1.0242 | 1.0392 | 0.9896 | 0.9963 |
| Prima mostrada frente al NAV | 91.39% | 2.88% | 25.74% | 6.82% |
| Oferta de tokens | 195,439.92 | 577,383.60 | 200,901.66 | 451,819.69 |
| TVL publicado, USD | 200,173.09 | 600,033.78 | 198,815.90 | 450,180.03 |
| Límite de depósitos, USD | 200,000 | 600,000 | 200,000 | 450,000 |

Las dos lecturas nuevas del NAV indicaban `proven 4h ago`. Es un valor publicado con antigüedad, no una verificación propia de su vigencia. Los porcentajes de prima provienen del sitio, que puede usar mayor precisión que las cifras redondeadas visibles.

Cálculos entre estas observaciones:

- OPENAI: precio del pool −45.46%; NAV publicado +1.46%; oferta +195.43%.
- ANTHROPIC: precio del pool −14.47%; NAV publicado +0.68%; oferta +124.90%.

Interpretación: permitir más depósitos puede ampliar la emisión cerca del NAV y reducir la escasez que sostenía una prima. La coincidencia observada es consistente con ese mecanismo; falta reconstruir las transacciones de ampliación del límite, emisión y venta para atribuir causalidad y horarios exactos.

## Qué se observó en Lighter

La dirección L1 de cada cuenta coincide con el contrato del vault correspondiente.

| Cuenta | Mercado y lado | Tamaño | Precio de entrada | PnL mostrado, USD | Saldo USDG mostrado |
|---|---|---:|---:|---:|---:|
| 25700 | OPENAI LONG | 350.5926 | 1,604.23 | 8,096.05 | 603,629.593654 |
| 25736 | ANTHROPIC LONG | 187.55533 | 2,161.4 | 4,673.65 | 452,418.299514 |

Esto aporta evidencia de posiciones y saldos en la infraestructura vinculada. No prueba que el usuario posea acciones de las empresas. No sumamos automáticamente PnL y saldo: no se validó aquí si el campo de saldo ya lo incorpora. Tampoco se igualó esta cuenta con el NAV de Long, porque sus momentos de actualización difieren y pueden intervenir obligaciones o fondos pendientes.

## Emisión y rescate: lo que realmente se verificó

En el panel Vault de OPENAI, sin ingresar importes ni enviar solicitudes:

- Emisión: mínimo publicado USD 1.02; comisión 30 bps (0.30%); demora estimada de 1–2 minutos.
- Rescate: descuento de salida publicado de 60 bps (0.60%); demora estimada de 15–40 minutos.
- El sitio distingue compra/venta instantánea en el pool de emisión/rescate mediante el vault.

La promesa de liquidar al NAV y los plazos son información del proveedor. No se ejecutó un rescate ni se verificó una liquidación completa de terceros. La prima frente al NAV no equivale a beneficio de arbitraje realizable: hay límites, comisiones, precio de ejecución, espera y riesgo del contrato.

## Por qué FOMO mostraba capitalizaciones diferentes

En la captura visual anterior de este chat, ANTHROPIC mostraba simultáneamente precio USD 1.26, aproximadamente USD 73.5K de capitalización en la lista y USD 252.5K en el detalle. La lista implicaba unas 58,333 unidades; el detalle era consistente con unas 200,000. La captura original del usuario, USD 3.50 y USD 205K, también implica unas 58,571 unidades.

Esto apunta a una oferta distinta o desactualizada entre componentes, pero no se inspeccionó la implementación de FOMO para confirmar el origen. En la nueva lectura, el detalle ya mostraba oferta 451.8K y capitalización cercana a USD 482.7K, consistente con precio cercano a USD 1.07.

La oferta variable también afecta las comparaciones históricas: capitalización = precio × oferta. Puede aumentar la capitalización mientras baja el precio por token. No debe calcularse el rendimiento de un tenedor comparando capitalizaciones de fechas con distinta oferta.

## Contrato y límites de la revisión

Blockscout identifica el contrato OPENAI como un Beacon Proxy EIP-1967, parcialmente verificado, con beacon `0x50e11fAAe3C85f1ff7E38933c707AE5E0116dE5f` e implementación observada `0x2B111295865030edD3C247893dE6F634018E0c1A`.

La página de la implementación mostró código de creación y bytecode, pero no fuente Solidity verificada ni ABI de aplicación. El código del proxy no basta para auditar la lógica del vault. No se comprobó el control del beacon, política de upgrades, reglas completas de pausa, actualización de NAV ni garantías de rescate. No se afirma una vulnerabilidad explotable ni que el vault sea seguro.

FOMO marcaba ambos tokens como potencial estafa/no verificados en la observación anterior. En la nueva lectura de ANTHROPIC añadió que solo 26.17% de la liquidez estaba bloqueada o quemada. Son alertas de FOMO, no conclusiones independientes sobre fraude ni pruebas de un retiro de liquidez.

La revisión de la primera página de transacciones de OPENAI mostró principalmente aprobaciones ERC-20 y transferencias. No se identificó allí la transacción exacta de ampliación del límite ni un ciclo de rescate completo. No se atribuyen ventas a una persona ni se presenta la hipótesis de compresión como reconstrucción forense terminada.

## Fuentes primarias consultadas

- [Long: OPENAIx1L](https://app.long.xyz/longx/0xfe09Fb328bE1c286B4f597eD34764b7472ae72c5).
- [Long: ANTHROPICx1L](https://app.long.xyz/longx/0x1937caD42b17D43bB2b347ce16d5288887C46c33).
- [Lighter: cuenta 25700](https://robinhoodchain.lighter.xyz/explorer/accounts/25700).
- [Lighter: cuenta 25736](https://robinhoodchain.lighter.xyz/explorer/accounts/25736).
- [Blockscout: contrato OPENAI](https://robinhoodchain.blockscout.com/address/0xfe09Fb328bE1c286B4f597eD34764b7472ae72c5?tab=contract).
- [Blockscout: implementación observada](https://robinhoodchain.blockscout.com/address/0x2B111295865030edD3C247893dE6F634018E0c1A?tab=contract).
- [FOMO: ANTHROPIC](https://fomo.family/tokens/robinhood/0x1937cad42b17d43bb2b347ce16d5288887c46c33).
- [FOMO: OPENAI](https://fomo.family/tokens/robinhood/0xfe09fb328be1c286b4f597ed34764b7472ae72c5).
- [Términos de Long, fecha efectiva 8 de septiembre de 2026](https://app.long.xyz/terms): distinguen productos y exposición; advierten que precios y metadatos pueden estar desactualizados. Sus cláusulas generales sobre Stock Tokens no prueban que estos vaults concretos contengan títulos RHJ.

No se compró, vendió, depositó, emitió, rescató, aprobó gasto ni firmó ninguna transacción. Este documento es local; no se publicó ni envió a terceros.
