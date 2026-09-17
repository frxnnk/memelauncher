# Nota de la mañana — 17 sep 2026

Franco: la beta paga **sigue bloqueada** hasta que una wallet Phantom linkeada tenga ≥5 AMZN y vos firmes el Top up. No bajé el piso de 5. No marqué el goal. No inventé crédito.

## Qué se publicó de noche

Top up → **Pay from** ahora lista el **saldo AMZN de cada wallet ethereum linkeada** (RPC 46630, token `0x5884…9e02`). Si alguna distinta de `0x686c…2f79` ya tiene ≥5, esa queda seleccionada. Si ninguna llega a 5, sigue el copy del faucet.

Live: https://vault-closed-beta.vercel.app (`dpl_AdRaYHouTeapyD4CobjBc2zVKv1Q`, Node cutover). `/funding-client.js` y `/funding.js` coinciden con este árbol. Precio **5 AMZN**. `paidConfigured: true`.

## Qué hacer vos (Brave + Phantom)

1. Hard refresh `/play` (`Ctrl+Shift+R`).
2. **Top up & bounty**.
3. En **Pay from**, mirá los saldos. Elegí la cuenta que muestre **≥5 AMZN** (si ya está seleccionada, no toques `…2f79` con 2.9).
4. **Review top-up** (5 AMZN) → **Send with Phantom**. FROM esa wallet TO tesoro `0xbec4`, **5 AMZN**.
5. Si **todas** muestran menos de 5: faucet `https://faucet.testnet.chain.robinhood.com` a una cuenta Phantom que puedas elegir en Pay from, después volvé a abrir Top up.

No bajes el precio a 1 AMZN. No uses `0xf670` / `0xbec4` / `0xf282` para mandar top-ups.
