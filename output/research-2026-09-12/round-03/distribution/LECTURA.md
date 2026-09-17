# ALL: distribución, cohortes y actividad posterior

Investigación del 12/09/2026. Listado congelado a **05:48:50 UTC**, pools a **05:51:25–05:51:29**, leaderboard a **06:04:16** y verificaciones del explorador hasta aproximadamente **06:10 UTC**. Los cortes no son simultáneos. Solo GET públicos y lectura del navegador; no se conectó una wallet, firmó ni hizo una operación.

## Resultado

**Los repartos existen, incluidos los de derivados concretos. La evidencia no sostiene que repartirse entre wallets sea una ventaja suficiente para lanzar.** De los 161 derivados del corte, 154 tenían MC de hasta US$10K; en seis pequeños seleccionados por edad y presencia de pagos no hubo una sola compra indexada en la última hora. Los cuatro mayores sí tenían negociación.

El contador global mezcla activos y pagos repetidos. De 137.293 pagos reportados a las 06:04, 121.712 —88,65%— eran del activo ALL. Eso no significa 137.293 personas ni 137.293 nuevos holders de derivados. Se verificaron tres drops de ALLCAT/ALLDOG/ALLIN: 14 transferencias a 13 direcciones, una repetida entre activos. También se verificaron tres lotes posteriores de ALL: 17 transferencias a 17 direcciones; dos tienen etiquetas de infraestructura en el explorador. Ambas muestras son demasiado pequeñas y seleccionadas para estimar conversión o organicidad.

## Método y archivos

1. Se guardó el HTML completo de [Discover](https://www.allonsol.fun/discover). Se extrajo su JSON público inicial, publicado para renderizar el listado, con `mint`, nombre, `createdAt`, MC exacta, recompensa y `payouts`. No se ejecutaron los scripts descargados.
2. La cohorte tiene **161 mints únicos**; ALL oficial es una ficha aparte. El total visual de 162 incluye esa ficha. Los 161 están en `cohort.json` y `cohort.csv`; los datos originales en `discover.html`, `discover-rsc.txt` y `discover-initial.json`.
3. Se eligieron los cuatro mayores por MC exacta. Para los pequeños, dentro de cada banda de edad 0–3h, 3–6h y 6h+, se eligió la moneda de mediana superior de edad con MC conocida ≤US$10K, una con `payouts>0` y otra con `payouts=0`; empates por mint. Regla fijada antes de consultar DEX. Es una muestra intencional equilibrada, no aleatoria ni representativa de retornos.
4. Se consultó el endpoint público DEX Screener `token-pairs/v1/solana/{mint}` para cada una de las diez. Cuando había varios pools se mostró el de mayor volumen 1h; desempate por liquidez y dirección. Todos los pools recibidos se preservan y se filtran por identidad exacta. No se sumaron capitalizaciones de pools.
5. Se conservaron diez fichas ALL, sus datos y 22 GET exitosos en `fetch-log.json`. Las fuentes públicas `/etc` y `/leaderboard` del worker se identificaron en los componentes de la aplicación y se guardaron, con sus timestamps internos.

Los scripts `analyze.py`, `parse-pages.py` y `analyze-sample.py` trabajan sobre archivos locales. `fetch-sample.ps1` contiene únicamente las lecturas públicas de fichas y DEX. No se usaron RPC de escritura ni credenciales.

## Cohorte completa: edades y recompensas

| Métrica | Resultado |
| --- | ---: |
| Derivados | 161 |
| MC conocida / desconocida | 158 / 3 |
| MC ≤US$10K / >US$10K | 154 / 4 |
| Mediana de MC entre los que tienen precio | US$2.936,25 |
| Algún contador de payout / contador cero | 80 / 81 |
| Campo `paidUsd` desconocido | 161 |

**`paidUsd=null` no es US$0.** El listado no suministra ese valor, mientras algunas fichas individuales sí presentan una estimación. `payouts=0` significa cero registrado por esa fuente; no prueba ausencia universal de transferencias. Las MC son valoraciones y no dinero ingresado o disponible para salir.

| Edad al corte | N | Con payout / cero | Mediana MC con payout | Mediana MC con cero | N >US$10K |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0–3h | 15 | 9 / 6 | US$2.956,73 | US$2.854,10 | 0 |
| 3–6h | 22 | 7 / 15 | US$2.922,96 | US$2.858,43 | 0 |
| 6h+ | 124 | 64 / 60 | US$3.119,79 | US$2.896,51 | 4 |

Las medianas excluyen los precios desconocidos; los conteos de pagos los incluyen. Los mayores tienen más tiempo para acumular atención, negociación y pagos. La pequeña diferencia entre medianas con/sin payout **no identifica un efecto del reparto**: no controla demanda inicial, compras del creador, momento de mercado, presupuesto ni elegibilidad.

| Recompensa declarada | N | Con payout | Mediana MC conocida |
| --- | ---: | ---: | ---: |
| ALL por defecto, `stocks=[]` | 135 | 69 | US$2.942,09 |
| SPYx | 8 | 3 | US$2.853,98 |
| NVDAx | 6 | 2 | US$2.850,35 |
| TSLAx | 3 | 1 | US$2.879,12 |

Otros nueve declaran ALLCAT, AMDx, JTO, MSTRx, PENGU, PUMP o WMTx. Los grupos son pequeños y de edades distintas; no hay fundamento para concluir qué recompensa causa mejores resultados. Son etiquetas del catálogo, no una auditoría de cada emisor o activo. En los pools principales comprobados de esta muestra, la contraparte es **SOL**, incluso CATON/TSLAx y LOYAL/NVDAx: la recompensa elegida no es el quote del pool.

## Muestra de diez: actividad indexada

Los enlaces identifican el pool usado en la fila. MC y liquidez proceden de DEX, por lo que pueden diferir del listado congelado minutos antes. `N/D` conserva ausencia del campo; no significa liquidez cero.

| Moneda / número ALL | Edad h | Payouts en listado | MC DEX USD | Volumen 1h USD | Compras / ventas 1h | Liquidez USD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| [ALLCAT #4](https://dexscreener.com/solana/5zaedm3kecqcgjbx8lwgapmgw3ncv6ldvmcmbhqy9zuc) | 9,91 | 811 | 127.762 | 39.434 | 361 / 259 | 31.831 |
| [ALLIN #7](https://dexscreener.com/solana/bqqtevsy9ubnbtbeelpkax8os4udeg8patcezhlwledj) | 9,75 | 228 | 32.226 | 4.432 | 76 / 78 | 14.126 |
| [ALLDOG #11](https://dexscreener.com/solana/6qa6nmogzms87yjrgvqnza2pedyobw1ppfxexeec5wpc) | 9,34 | 173 | 30.683 | 5.851 | 118 / 89 | 13.529 |
| [CATON #5](https://dexscreener.com/solana/2yyhp4qjyb3azx61puvfw4mgh4jhrs1zyjwlkufgaja6) | 9,91 | 49 | 22.417 | 5.618 | 103 / 64 | N/D |
| [ALLAI #154](https://dexscreener.com/solana/fqdyg2zrocqdtf7vunvveaskabf3xczqcid63ejds8pb) | 1,27 | 2 | 2.865 | 45,30 | 0 / 3 | N/D |
| [LOYAL #152](https://dexscreener.com/solana/2setrhc4tqjvdtekfqo7asmfnrni9bwcrixueu1uw8xa) | 1,84 | 0 | 2.840 | 0 | 0 / 0 | N/D |
| [THAT #136](https://dexscreener.com/solana/3bcbzscnr26w89cirpuyn4ccafq3fdvf4mlpyc5gzbgv) | 5,38 | 1 | 2.910 | 0 | 0 / 0 | N/D |
| [HUNG #135](https://dexscreener.com/solana/5sz8lzgnmrmrnoiq9574gtagaxemnpmonerq81e9qauq) | 5,48 | 0 | 2.886 | 0 | 0 / 0 | N/D |
| [SHIT #67](https://dexscreener.com/solana/ezqr6pewinrectlewyrd8wxlnzdquyrcqzzyx1nbj6ym) | 8,24 | 3 | 3.510 | 0 | 0 / 0 | N/D |
| [CRYPT #59](https://dexscreener.com/solana/8paxiyfsvhajhb96m22acpwa9p7wdyngdlmezzevxfcl) | 8,31 | 0 | 2.923 | 0 | 0 / 0 | N/D |

Los tres primeros pools son PumpSwap; CATON y los seis pequeños son curvas Pump.fun. Todos los pequeños tienen alguna actividad acumulada desde el lanzamiento —volumen 24h entre US$25,40 y US$3.991,13—, pero no compradores en la hora observada. No es correcto llamarlos contratos nunca negociados. Tampoco puede atribuirse su falta de continuidad a los pagos.

### Cuánto dicen haber repartido los pequeños que sí pagan

| Moneda | Recompensa a sus holders, según ficha | Direcciones reportadas | Valor a la cotización usada por la ficha | Drop del propio derivado |
| --- | ---: | ---: | ---: | --- |
| ALLAI #154 | 926,013490 ALL | 3 | US$2,66 | No informado |
| THAT #136 | 1.240,846979 ALL | 2 | US$3,57 | No informado |
| SHIT #67 | 69,901962 ALL | 9 | US$0,20 | No informado |

Estas cifras son agregados del operador, todavía sin conciliación de todos sus recibos. Los tres casos ilustran por qué “tiene payouts” puede significar repartir una cantidad pequeña a pocas direcciones. La ficha no convierte esas direcciones en compradores independientes.

En los mayores, las fichas distinguen recompensa a holders y drop del derivado: ALLCAT informaba 1.031.721,812214 ALL de recompensa y 7.245.979,967602 ALLCAT entregados a 1.423 direcciones. ALLIN/ALLDOG muestran etiquetas auxiliares `DROP-...` en parte de la metadata de drops, mientras el leaderboard identifica sus mints canónicos. Por eso se verificaron los activos directamente en las transacciones siguientes, sin confiar en el texto del símbolo.

## Drops de tres derivados: prueba en cadena

Se filtró cada mint en Solscan por origen `TjJUc9niZ1MAagSmkTkdLpKCk1vnJWL2q7QznzQQALL`, con transferencias pequeñas visibles, y se tomó la transacción de salida más reciente que mostró esa consulta. **La regla no garantiza el último pago desde cualquier otro operador**. Los lotes tienen tamaños distintos; no representan una muestra aleatoria de holders.

| Activo exacto | Transacción y hora UTC | Cantidad entregada | Destinatarios | Comprobación |
| --- | --- | ---: | ---: | --- |
| ALLCAT `J1U1…gALL` | [4F9A…H7J](https://solscan.io/tx/4F9A6QVu5FKQFA8yAbYMQgDZ5Sxm5t1vmoypiEpp5QXknwfEzU775XQyvnjiT2V8YwHqRg1udh2JaGdPwabRVH7J), 11/9 23:51:49 | 6.309,179678 ALLCAT | 10 | Success, finalized; diez `TransferChecked` y creación de una cuenta de token con 0,00151384 SOL de renta |
| ALLDOG `2QRq…6ALL` | [3jab…LFHq](https://solscan.io/tx/3jabwhHw5Uz4T2BHTHBAdQLh1z7ciyX888oLj4ha6dZDD9778awyNUr8WQVTFcck3fwGDn1dxw7FUsGbXSFuLFHq), 12/9 00:34:22 | 4.818,856222 ALLDOG | 1 | Success, finalized; `TransferChecked` |
| ALLIN `A5mD…WVCVL` | [26r2…HVyF](https://solscan.io/tx/26r2gzKQdpAE63HW6kEFZGkc6XeRffjUsr31Zb1oyHony9bszZSku9oaqeMkXhVFiEDvKY1EXzpfNngnq4QDHVyF), 12/9 00:34:29 | 17.041,624173 ALLIN | 3 | Success, finalized; tres `TransferChecked` |

Las **14 transferencias llegan a 13 direcciones únicas**. `woQZigHfLGHje85cjhXr5Y6uUiau2Q8p65N58EQj328` recibió ALLDOG y siete segundos después ALLIN. Los otros doce destinatarios aparecen por primera vez **dentro de esta muestra**, no necesariamente por primera vez en la plataforma. Una cuenta de token creada tampoco es una persona o wallet recién creada. No se verificó su saldo posterior ni una compra realizada tras el drop.

Los mints completos, todos los receptores y cantidades están en `derivative-drop-proof.json`. Se comprobó que las cantidades individuales suman cada total. No se suman cantidades de monedas diferentes.

## El contador global y los pagos de ALL

El componente público de Discover calcula `payouts landed` sumando `assets[].payouts` del [leaderboard del worker](https://all-worker-production.up.railway.app/leaderboard). Al corte 06:04:16 reportaba:

| Activo pagado | Pagos reportados | Direcciones reportadas para ese activo |
| --- | ---: | ---: |
| ALL | 121.712 | 9.800 |
| SPYx | 6.455 | 4.637 |
| ALLCAT | 2.598 | 1.423 |
| BURNALL | 1.041 | 1.032 |
| ALLIN | 1.021 | 345 |
| Total de 43 activos | 137.293 | No sumar entre activos |

El **88,65% de los pagos es del activo ALL**. Su contador por dirección admite repetición. El endpoint devuelve solo 50 filas de wallets para ese activo, aunque informe 9.800: no es un censo descargado de todos los receptores.

La suma `payouts` de los 161 derivados del listado era 2.742 en su corte, con otro alcance/unidad. Por ejemplo, ALLCAT figura con 811 en Discover y 2.598 pagos del activo ALLCAT en el leaderboard. No se conciliaron ambos contadores ni se asumió que cuentan lo mismo. El segundo agrupa por activo entregado, mientras la ficha separa recompensas a holders y drops.

Como comprobación acotada adicional se eligieron las tres transferencias de ALL más recientes visibles de la wallet operadora `P9YXPv62dWAJ5VaiXkn4TVoEdWBasC3tgdkQzdvGALL`:

- [05:55:21, lote de ocho](https://solscan.io/tx/61fybCESmXfRwmZQ5MeDNvxeXty9ApP1yWNKT5ph74WmnCLSummNfya5fwzyQBbA5MNenLYtZbH83UD3zjJTeYf4): 12,532888 ALL.
- [05:55:22, lote de ocho](https://solscan.io/tx/5V6WJZqCghhu65S236A6QcDpuQoMX4m4Vqhu6kKK3phtUJ7tWBQSqyFzfBP5a2XBnPrUqF8Nf5tobWjc9LNn6gvQ): 3,343760 ALL.
- [05:55:24, un receptor](https://solscan.io/tx/bsTkbZZrgH7YPudiVp1RXjKf3e6hFwTqG7aWHhVzToBZsjmJfJrr6txKaTAi44P1rqsFxPxVeBvE3bMQVWJwkkc): 1,136305 ALL.

Total: **17,012953 ALL a 17 direcciones distintas**, aproximadamente cuatro centavos según la valoración que mostraba el explorador; la cantidad de tokens es la comprobación principal. No hubo repeticiones dentro de esos tres lotes. Tres destinatarios aparecen en el leaderboard con 62–65 pagos históricos, afirmación del operador que no se auditó pago por pago. En otro destinatario Solscan muestra la etiqueta `Phantom: Fees`; en otro, `Sol-Cleaner Burn Vault`. Esas etiquetas no identifican personas y refuerzan que recibir un token no implica una audiencia.

Los lotes anteriores no se atribuyeron a un derivado que los haya financiado. `history=null` en las diez fichas impide una conciliación directa por esa vía. Prueban pagos ALL desde el operador, separados de los drops de tres derivados que sí se comprobaron por mint y origen.

## Fees al operador: una distinción adicional

La [transacción vinculada por la ficha ALLAI #154](https://solscan.io/tx/3jSqXwRhY4ED3Kf6v2E1aJE3nzBdHpj7p4jydxtAUcZRUiAqswc754CkMvVKmRfcyn5WTa1Bk65xHD6NPYp192Bz), 05:15:42 UTC, ejecutó `Distribute_creator_fees_v2` en Pump.fun. Distribuyó **0,001278112 SOL**, aproximadamente 50/10/10/10/20:

- 0,000639057 SOL a P9, wallet de ejecución de recompensas.
- 0,000127811 SOL a treasury Tj.
- 0,000127811 SOL a Cu3, etiquetada como plataforma por la ficha.
- 0,000127811 SOL a E3, etiquetada `other`; identidad o relación no verificadas.
- 0,000255622 SOL al destinatario etiquetado launcher.

Los roles son etiquetas de la ficha; las cinco transferencias se comprobaron en Solscan. Esto **no es un pago ALL a tres holders**: es la distribución de SOL previa al trabajo del operador. El 20% genérico de plataforma de los documentos tampoco describe como una única fila este contrato exacto: aquí aparecen 10% plataforma y 10% adicional. No se investigó a quién corresponde ese adicional ni se extrapoló a otros lanzamientos.

## Implicación y límites

La evidencia mejora desde “hay un contador” a **hay transferencias verificables de derivados y del activo de recompensa**. El salto a demanda sigue faltando: los pagos pequeños y la aparición de una wallet como receptora no explican por sí mismos compras, retención o difusión. La muestra de mercado conserva la separación entre unos pocos líderes con actividad y pequeños con pagos pero sin compradores horarios.

No se midieron personas únicas, control común de wallets, funding, wash trading, intención del receptor, cuánto vendió tras cobrar, rentabilidad neta del creador, todos los lotes ni permisos completos. Las etiquetas de infraestructura no se usaron para clasificar el resto como bots. La ausencia de liquidez en el JSON no se convirtió en cero. Las diferencias entre contadores quedaron abiertas; no se interpretaron como fraude.

**Decisión de lanzamiento:** ALL resuelve parte de la ejecución de reparto. Este estudio no muestra que proporcione una comunidad elegida por el nuevo concepto ni una ventaja de adquisición suficiente. Usarlo como canal seguiría requiriendo una propuesta con demanda y una medición independiente de qué receptores voluntariamente compran, participan o vuelven.
