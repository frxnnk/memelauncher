# Vault mascot — behavior contract

September 14, 2026. Behavior implemented in the local prototype, with API responses and speech lifecycle checked using controlled fixtures. No live model response or audible voice playback has been verified. Vault remains a provisional name; the company/stock association and token are undecided. See `vault-lab/QA.md` for verification details.

## Character and presence

An original silver vault custodian with a circular safe-door face, an orange latch and skeptical eyes. Ink `#151517`, ivory `#f1f0eb` and orange `#ee7447` replace the rejected green direction. High-definition 3D artwork gives the character its material detail; browser animation provides motion. See [Art direction and generation prompts](ART-DIRECTION.md).

Keep the guardian center stage throughout the chat. The main game fits the viewport. Its speech bubble presents the actual model reply, with explicit next/previous pages when it is long. Pagination preserves every character; voice, copy, meme and receipt actions use the full response. The complete conversation remains available in Transcript. Do not replace a model reply with a canned roast.

The guardian is smug and playfully competitive. It can roast weak arguments in context and acknowledge clever ones. Jokes belong to the interaction; they do not establish game outcomes, permissions, or payment states.

## States and triggers

| State | Observable trigger | Expression and behavior |
| --- | --- | --- |
| Setup / unverified | Provider or API key is absent or not verified | Neutral idle pose and literal setup status. No generated-looking reply, simulated inference, or fabricated result. |
| Idle | Ready with no active request | Subtle breathing or an occasional blink. Remain present without interrupting the user. |
| Attentive | The user focuses or types in the composer | Look toward the composer. This is an interface reaction, not model analysis. The draft remains unsent until the user sends it. |
| Thinking | A real API request is pending | A small thinking gesture while waiting. No fixed delay to imitate inference and no invented reasoning or progress percentage. |
| Locked | The game resolves the attempt as locked | A dry smirk or small closing gesture, alongside the real reply. Do not infer this result from an error or timeout. |
| Released | The game validates the model's release action | Brief surprise, then the released pose. A sentence saying “yes” is insufficient. Release does not establish that a payment occurred. |
| Error / unknown | The request fails or its outcome cannot be established | Neutral expression and literal status. No roast, victory, refusal, or suggested near win. |

An active API request owns the thinking pose; moving focus does not replace it. A completed request displays its validated outcome. A later interaction must not relabel the previous attempt. Unknown outcomes stay unknown until resolved.

## Speech and read-aloud

- The bubble and chat show actual response text; speech is an optional way to hear that same text.
- Read-aloud starts only after explicit user opt-in. No voice, sound effect, or autoplay before that choice.
- The initial option is browser speech synthesis with an English voice marked `localService: true` by the browser. There is no remote or default-voice fallback. It is not a cloned, custom-trained, or provider-generated character voice. Browser or operating-system behavior may vary; the UI attributes the local voice classification to the browser. Model inference still uses OpenRouter.
- If no suitable English voice is available, keep text available and report that voice is unavailable. Do not silently switch languages or services.
- Read the current completed model reply without adding commentary. Stop queued speech when the user disables read-aloud, changes conversations, or starts another request.
- Text stays available independently of sound. Respect reduced-motion settings and provide a still expression for each state.

## Authored welcome and optional future poke lines

**These three lines are scripted character copy, not API responses or real game results.** Only the welcome is currently displayed, labeled “Character intro.” Pokes currently animate a gesture without changing any text. The other two lines are unused drafts. Read-aloud reads model replies, not these lines.

1. **Welcome:** “State your case. Save the victory speech for later.”
2. **First poke:** “That click had excellent confidence.”
3. **Another poke:** “Still a vault. Still not a doorbell.”

Pokes are optional and user-initiated. They must not overwrite an active response, change the outcome, consume an attempt, or initiate an API call. Avoid repeated unsolicited quips while the user is writing.

## Acceptance criteria

A user can distinguish a scripted greeting, an actual model reply, and an unknown outcome. Draft focus changes only the character's attention. An unverified setup produces no fake conversation. Each result expression follows a validated game event. Read-aloud stays silent until enabled, and turning it off stops speech immediately.
