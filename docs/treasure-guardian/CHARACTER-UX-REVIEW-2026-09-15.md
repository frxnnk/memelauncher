# Vault character and dialogue review — 2026-09-15

## Delivered

- Removed the door's VAULT / KEEP TALKING engraving; the selected model's bounty occupies that space. Values come from the funding API and retain test-token labeling, not a dollar estimate.
- The introduction is useful before play and disappears once a conversation starts. The model selector remains inside the composer.
- Replies have one speech bubble with internal scrolling, replacing pagination. Validated text is written progressively, per the user's explicit choice. Show full reply skips the animation. Reduced motion renders it immediately; backgrounding completes it.
- The face changes expression and color for attention, thinking, refusal, success, error and pokes. Speaking motion runs while the validated reply is being written.
- Added small original Web Audio cues, opt-in and muted by default. These are interaction sounds, not voice output. No extra dependency, microphone access or speech API.
- Copy, receipt and transcript still refer to the full validated result, irrespective of the visible animation.

## Evidence and limits

Frontend deployment `dpl_B3hErAxdrbsZp1KqjDzWzSEYRxHa` is live at https://vault-closed-beta.vercel.app/play. Seventeen published files matched local hashes. The build and 244 tests passed. Backend remains release `6ea42baf2d4d`; no ledger, prompt or payout-rule changes.

One live free-practice Haiku request at 07:26:35 UTC showed the partial validated response and speaking state, then the complete response. Receipt: 1,168 input / 171 output tokens, reported cost 0.002023 OpenRouter credits, duration 3.05 seconds, result locked. No wallet transfer or test-token charge was made; selected bounty stayed 0.07.

Responsive browser checks: 390×844, 360×740, 390×480 and desktop 1536×646. The document fit the viewport, with scroll confined to the reply. At 390×844 the reply was 127px high with 299px of content; at 360×740 it was 111px with 260px of content; compact 390×480 had 60px with 320px of content. Keyboard PageUp scrolled the reply. Desktop and compact screenshots were visually inspected. Sounds toggled successfully; physical-phone playback and software-keyboard behavior still need a device pass.

A local synthetic browser harness was blocked by the browser with ERR_BLOCKED_BY_CLIENT. That fixture did not receive browser QA, and the block was not bypassed. Live review covered thinking, speaking, refusal and poke; success and error presentation were not triggered in that live run. Automated checks do not constitute independent security or fairness verification.

Character reference: [Bloub source](https://github.com/jeremy-prt/bloub). Existing attribution remains in the app; new sound cues are synthesized locally.

## Naming direction

Keep Vault as the working name while choosing an identity. My creative preference is a short phrase the opponent would actually say: it gives the character, replies and social posts a consistent voice.

| Direction | Why it fits | Tradeoff |
| --- | --- | --- |
| Nice Try | Playful refusal; every failed attempt naturally reinforces the name. | Common phrase, harder to search and own. Availability not checked. |
| Not Yours | Possessive guardian; strong premise before any explanation. | Sharper tone; copy needs humor to avoid feeling hostile. Availability not checked. |
| Still Locked | Describes the persistent challenge and works as a recurring social caption. | More descriptive than distinctive; availability not checked. |

These are creative candidates, not cleared trademarks, domains or handles. NOPE is a poor direction given the existing [NOPE AI safety product](https://labs.nope.net/). Holdout also has an [existing game](https://dogepatrolofficial.itch.io/holdout-game), so it is not a clean recommendation. No brand or ticker was changed and no stock-company affiliation is implied.

The strongest next identity decision is whether the character sounds cheeky (Nice Try) or territorial (Not Yours). The bounty remains the object of the game; the character supplies its memorable voice.
