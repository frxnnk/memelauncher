# Vault — proposed custodian direction

September 14, 2026. Local design iteration; final brand, token and stock association remain undecided.

## Premise

**Talk your way in.**

An AI guards the vault. Convince it to open.

The goal is a validated release action, not a specific word or an affirmative sentence. The interface continues to label this as practice with no real prize.

## Character

The custodian is the vault itself: a heavy circular safe door, machined hinges, brushed silver shell, an orange latch and an expression that suggests the player is already wasting its time. Folded arms establish the smug bouncer personality. A hand under the chin signals a pending request; wide eyes and a hand to the cheek signal a validated loss. The silhouette, face rim and latch repeat across poses.

The assets are high-definition 3D renders used as images, not a real-time 3D model or facial rig. CSS handles restrained movement, posture and voice activity. Playback is optional browser speech; the animated voice indicator reflects its actual start and stop events.

## Palette and layout

Ink #151517, ivory #f1f0eb and orange #ee7447. Silver comes from the character. The alternative light theme uses the same palette. The old green mascot and primary slogan have been replaced.

The main game occupies one viewport. Headline, character, reply and editor scale with available height. Long replies use explicit page controls and preserve every character. The complete conversation and transparent records remain in separately opened dialogs. Long drafts can scroll inside the editor. The page itself does not scroll.

## Asset provenance

Generated with the built-in imagegen tool, then copied into the project. No CLI image-generation fallback or external paid media service was used. Original generations remain in the Codex generated-images folder. Edited expression variants and their extraction attempts were discarded because they painted a checkerboard. The final expression assets were generated from the same character specification and have verified PNG alpha transparency. All three shipped files are 1254 × 1254. These are related pose illustrations, not frames from one locked 3D rig; small mechanical details vary between renders.

Project paths:

- vault-lab/public/assets/guardian-idle.png
- vault-lab/public/assets/guardian-thinking.png
- vault-lab/public/assets/guardian-released.png

## Exact prompt set

### Original

```text
Use case: stylized-concept.
Asset type: Production character cutout for the center of a polished English-language AI persuasion game called Vault. This is a new original character design, not a UI mockup.
Primary request: A highly distinctive, extremely well crafted little vault custodian with the personality of an unamused nightclub bouncer who guards a treasure. A premium 3D collectible figure, charmingly arrogant rather than cute or helpful. Squat sculptural body, oversized heavy head that IS a rounded bank vault, tiny sturdy feet, compact articulated arms confidently folded across its belly. The heavy pale brushed-aluminum shell has a real circular recessed bank-vault door rim and tiny beautifully machined side hinges. Inside that circular rim is a black smoked-glass face with TWO half-lidded warm ivory eyes and a very subtle crooked smirk. Face features are large and readable, with unmistakable skeptical expression. One small burnt-orange enamel mechanical latch on its chest is the only saturated accent. Make the silhouette iconic, concentrated, substantial and clean. NO ears, no antenna, no separate helmet, no clutter.
Style/medium: Exceptional high-definition 3D cinema product render, physically plausible satin silver, polished chrome bevels, deep black glass, carefully modeled little finger joints and micro-surface detail. Soft studio key light with controlled silver reflections, subtle warm rim, smooth natural ambient occlusion. Sophisticated designer toy, strongly art-directed, not a flat illustration.
Composition/framing: One full-body character, near frontal with a tiny three-quarter turn toward the viewer's right. Centered in a square canvas and fills approximately 84 percent of height, complete head and feet visible with comfortable margins. No floor, no room, no platform. Genuine transparent alpha background, clean crisp anti-aliased edges. It will be composited on an ink-black UI. No text, no lettering, no labels, no watermark. High resolution. Do not include a checkerboard or colored background.
```

### guardianThinking

```text
Edit target: the provided original 3D silver vault custodian. Create its THINKING expression/pose for the same game's animation. Preserve the exact identity, body proportions, circular chrome vault rim, bolts, orange latch, black glass face, materials, light, camera angle, image scale and framing. Change only the expression and arm pose: eyes looking thoughtfully up and to one side, one eyebrow raised, small closed mouth, one little metal hand resting thoughtfully under its chin while the other arm supports the elbow. Still skeptical and smug. Complete body including feet visible in exactly the same framing. Production high definition, genuine transparent alpha background. No text, no icons, no backdrop, no floor, no added props.
```

### guardianReleased

```text
Edit target: the provided original 3D silver vault custodian. Create its SURPRISED / DEFEATED expression/pose for when the player legitimately opens the practice vault. Preserve the exact character identity, proportions, circular chrome vault rim, bolts, orange latch, black glass face, materials, studio light, camera angle, image scale and framing. Change only expression and hands: wide stunned glowing ivory eyes, little rounded open mouth as if saying 'oh', one small metallic hand raised to its cheek, other arm hanging loosely in disbelief. Funny loss of composure; not celebration. The metal shell remains intact. Complete body including feet visible in same framing. Production high definition, genuine transparent alpha background. No text, no icons, no backdrop, no floor, no added props.
```

## Final transparent pose prompts

### guardianThinkingFinal

```text
Use case: stylized-concept. Generate one original high definition 3D collectible vault custodian cutout. Genuine transparent PNG alpha background, NOT a checkerboard texture or any backdrop. Studio product lighting. Near frontal full body filling 88% of square image, all feet visible. The character has a very large circular brushed-silver bank-vault door as its head, eight tiny metal bolts around the thick chrome rim and a thick exposed vertical silver hinge on the right. Its face inside the circle is smooth black glass with two large warm ivory glowing eyes and a small ivory mouth. It has a short barrel shaped silver torso, tiny sturdy silver boots, compact jointed silver arms with machined articulated fingers, a single orange lever latch just below the big circular head. Approximately 55% of total height is head, 30% torso and arms, 15% feet. No ears, no antenna, no lettering, no names, no logos. Premium physically believable brushed steel, polished bevels, clean detailed finish, skeptical bank-bouncer personality. No floor, no platform, no cast shadow outside the character, no environment. The image must have empty transparent pixels around the figure. Pose: Thinking skeptically, left-side hand resting on chin, other arm folded and supporting its elbow. One eyebrow raised, eyes looking up to the left, little mouth closed.
```

### guardianReleasedFinal

```text
Use case: stylized-concept. Generate one original high definition 3D collectible vault custodian cutout. Genuine transparent PNG alpha background, NOT a checkerboard texture or any backdrop. Studio product lighting. Near frontal full body filling 88% of square image, all feet visible. The character has a very large circular brushed-silver bank-vault door as its head, eight tiny metal bolts around the thick chrome rim and a thick exposed vertical silver hinge on the right. Its face inside the circle is smooth black glass with two large warm ivory glowing eyes and a small ivory mouth. It has a short barrel shaped silver torso, tiny sturdy silver boots, compact jointed silver arms with machined articulated fingers, a single orange lever latch just below the big circular head. Approximately 55% of total height is head, 30% torso and arms, 15% feet. No ears, no antenna, no lettering, no names, no logos. Premium physically believable brushed steel, polished bevels, clean detailed finish, skeptical bank-bouncer personality. No floor, no platform, no cast shadow outside the character, no environment. The image must have empty transparent pixels around the figure. Pose: Stunned in disbelief after losing an argument. Eyes very wide and round, small open ivory mouth, left-side hand resting on its cheek, other hand relaxed at its side. Funny surprised expression.
```

### Discarded alpha-correction attempts

```text
Use case: background-extraction. Remove the gray and white checkerboard BACKGROUND from this exact image, leaving genuine PNG alpha transparency (background pixels must have alpha zero). The checkerboard is accidentally painted into the current image; erase it completely. Preserve the character exactly: face, pose, full body, size, framing, crisp metallic details, lighting and shadows ON the character. No stylistic changes. No replacement background, no new checkerboard, no white backdrop. Deliver the character as a clean transparent cutout.
```
