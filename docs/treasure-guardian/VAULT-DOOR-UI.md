# Vault door: mobile UI delivery

15 September 2026 UTC. [Live game](https://vault-closed-beta.vercel.app/play). Frontend deployment `dpl_tGMXtqyEnKL37E3uHF4cWkcAS8ye`; the existing Node API, authentication, invitations and request limits remain in place.

## Design and behavior

The standalone robot is replaced by a mechanical vault door with a reactive SVG face in its center. The framing, hinges, metal finish, dial and opening are CSS, retaining sharp definition at different sizes. The face uses the framework-free [Bloub engine](https://github.com/jeremy-prt/bloub), pinned at `b4bb3c1b5f93c7b87a2e8d620f667c4093d97749`. MIT attribution ships with the code and is linked in Transparency. No Vue runtime or npm dependency was added; the bundled face renderer is about 24 KB uncompressed.

State comes from the existing UI and confirmed server result: gaze while drafting, thinking while awaiting inference, skeptical after a locked result, confused on an error and surprised when released. The door only opens for the existing validated `released` outcome. Poking it animates a wink; it never sends a message or changes a game result. An idle face sleeps after 24 seconds and wakes when engaged. Voice remains optional browser speech.

The model selector now lives inside the chat composer. It opens as a sheet on mobile and keeps keyboard focus out of the search input until requested. Model changes still require a new conversation when one is in progress. Small screens simplify the reply controls while retaining receipts and full transcript access. The composer uses the visual viewport to remain above a keyboard; text fields use a 16 px font on phones to avoid focus zoom. Touch keyboards retain Enter for a new line; the send button submits. Desktop Enter behavior stays available.

The landing and exported meme card use the same vault identity. The public game stays in English. Existing light/dark appearance, rules, settings and private receipt access are preserved.

## Verification and limits

- Full suite: 212 passing tests, successful face and Privy builds. UI fixtures did not call OpenRouter.
- Local UI: watching/thinking/locked/error/released states observed; released closes submission, moves the door and offers a new conversation. Reduced motion freezes the face and removes animated transitions.
- 390×844 and 320×568 layouts: no document overflow. At 320×568, after a long reply, the door remains 117 px tall; responses paginate instead of pushing the composer off screen.
- 390×400: simulated keyboard-height layout keeps the face beside the reply, pagination and composer visible. This is viewport emulation, not a hardware Safari keyboard test.
- Published UI: Privy session restored; Haiku chosen from inside the editor; a real reply and `keep_locked` received. Receipt `1bfa2a1e-689c-4ab7-9388-f05dd50e0fb9`, USD 0.001496. No new award claim or payment behavior.
- Share image: preview generated with the new vault mark. No social post was sent.
- Captured browser warnings came from Phantom/Bitwarden extensions; no application error was observed in the successful published flow.

Evidence: [published hashes](../../vault-lab/output/vault-door-deployment.json), [UI checks](../../vault-lab/output/vault-door-ui-qa.json), [real server receipt projection](../../vault-lab/output/vault-door-web-check.json). The three-request activation backup remains historical; the additional UI smoke did not run a new backup/restore. API source comparison confirms no backend edits. The deployed frontend is separate from the backend archive and latest prepared local package.
