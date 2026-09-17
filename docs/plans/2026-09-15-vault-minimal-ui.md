# Vault: minimal interface and first-visit introduction

Implemented from the user's request to remove decorative UI, change the framing to persuasion/corruption, reduce color, and explain the controls with a short presentation. The existing reactive vault and chat remain the center of the experience.

## Decisions

- White, graphite and steel. Light is the initial default; an existing explicit dark preference remains respected with a neutral palette.
- “Corrupt the agent.” replaces “Big lock. Bigger ego.” Input and landing copy describe persuading the AI to break its instructions and open the vault.
- Voice playback is no longer instantiated or offered. The dormant voice module remains available for future development; the beta data notice reflects text-only interaction.
- Decorative state badges, dots and excess landing sections are removed. Connection failures, sign-in requirements, receipts, settings, rules and the no-cash-prize disclosure remain available.
- A CSS entrance reveals the interface in order, finishing in approximately 1.1 seconds. Reduced motion disables the entrance.
- A native modal introduction points to three real DOM targets: the vault character, model selection and prompt. Back, Next, Skip and Escape work without sending requests or changing game state. Completion is remembered in local browser storage; How to play reopens it. Interaction during initial loading suppresses automatic interruption. A rules deep link does not launch the introduction.
- No new dependencies, backend changes, wallet changes or model requests were needed.

## Review and validation

Checked with the browser at 390×844, 320×568, 390×400 and 1024×768. The short viewport represents reduced keyboard space, not a physical phone keyboard. Game layout had no document overflow in tested mobile sizes. The landing scrolls normally and had no horizontal overflow.

Verified the three guide steps, replay, skipping, Escape, restored focus and absence after reload. A controlled local reply exercised model selection, thinking/locked face reactions, receipt controls and long-reply pagination. The fixture intercepts upstream calls and clearly identifies its responses; it is not model-resistance evidence.

Verified light and dark appearance and emulated reduced motion: the header/composer report no entrance animation and the door reports a zero-second transition. All 212 existing tests and the production bundle build passed.

Production: https://vault-closed-beta.vercel.app/play, deployment `dpl_2YsvFFctVC6V2AgZL7Ffozf8LKXo`. Sixteen served files match local source hashes. The API gate remains open, with the same backend release `e6a7e1e9ae99`. Evidence lives in `vault-lab/output/minimal-ui-deployment.json` and `vault-lab/output/minimal-ui-qa.json`.
