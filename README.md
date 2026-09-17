# Slow Light — Multi-Sensory Entrainment Platform

> A self-guided space for emotional check-ins, grounding, and sensory relaxation. Slow Light is a wellbeing tool, not a diagnostic tool or treatment.

🔗 **Live Demo**: [https://gdatalabs.github.io/slow-light/](https://gdatalabs.github.io/slow-light/)

---

## 🌊 Design Spine & Scientific Pillars

1. **Iso Principle & Physiological Entrainment**
   - Meets your initial arousal level (via emotion check-in or real-time breath/camera sensors) and offers a customizable, gradually slowing breathing rhythm. The default has no breath holds. Pacer values describe the animation, not measured breathing or clinical outcomes.
2. **Attention Restoration Theory (ART)**
   - Soft fascination through four living generative procedural environments:
     - **Room 1 · Weathering**: Procedural skies and rain that weather from storm to golden calm as breathing slows.
     - **Room 2 · The Slow Garden**: An interactive particle field that blooms only with gentle, deliberate touch.
     - **Room 3 · The Descent**: 5-4-3-2-1 somatic grounding and cognitive defusion ("setting down a thought").
     - **Room 4 · The Resonance Room**: Synesthetic light pulsing, mandalas, and theta-wave binaural beat soundscapes.
3. **Visceral Emotion Constellation & Color Wheel**
   - 2D circumplex map of affect (Valence $\times$ Arousal) supporting multi-feeling selection and blended atmospheric synthesis.
4. **Local & Private Biofeedback**
   - Microphone audio envelope detection + camera optical chest motion & rPPG pulse estimation. All processing runs 100% locally in your browser.

---

## 🚀 Running Locally

Because microphone, camera, and Web Audio APIs require a secure origin (`localhost` or `https://`), serve the file over a local server:

```bash
# Using Python (macOS / Linux / Windows)
python3 -m http.server 8000

# Open in your browser:
# http://localhost:8000
```

---

## 📄 License
MIT License

## Arrival and grounding experience

The entry page now offers a personal sensory journey (3, 6, 10, or 16 minutes) and a separate, self-paced 5–4–3–2–1 grounding practice. A person can begin without naming an emotion. Distress is self-reported, never inferred from the emotion wheel. The guidance changes with the selected feelings and reported intensity; it is a simple local rule, not an AI assessment.

Sound defaults off. Sensor and rhythm controls sit in “Make this space yours.” The grounding path has no timer, network calls, or saved record, and each sense can be skipped. It ends with an optional check-in and a concrete next step. Human support is available from the entry and closing screens.

“Privacy & your data” controls future local session and goal saving. Existing reflections can be cleared from the history page. Notes render as text. The optional Orb is a separate experience and may send inputs to external AI and voice services; these privacy controls apply to the main sensory journey. Google Fonts remains an external page dependency.

### Verification

Run `npm test` with Node.js. Regression tests cover duration stability, unanswered results, saving preferences, unnamed feelings, malformed history containers, note escaping, and script syntax. Browser checks cover desktop and 390px phone layouts, emotion selection, the complete grounding path, session controls, and privacy settings. Camera, microphone, and paid AI/voice integrations require separate device and deployment checks.

### Practice references

Grounding is adapted from [NHS Inform grounding exercises](https://www.nhsinform.scot/healthy-living/mental-wellbeing/breathing-and-relaxation-exercises/grounding-exercises/). Comfortable, unforced breathing follows [NHS breathing exercise guidance](https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/). US human-support links use the [988 Lifeline](https://988lifeline.org/). These sources inform the exercises; they do not establish clinical effectiveness for this app.

## Breathing flow and scene detail

Use **Breathing** in the session toolbar, or **Set my breathing flow** under the arrival preferences. Set inhale, hold, exhale, and rest independently; zero skips a hold or rest. Three presets provide starting points. Exact timing is the default. Turn it off for a gradual approach. During a session, Apply queues the change until the next cycle, including when paused. Preferences persist in this browser. Sensor observations do not override an exact rhythm.

`scene-detail.js` adds cached procedural forest, fern, shoreline, seabed, and star-field layers to the four sensory rooms. Weather cloud textures have twice the previous linear resolution. New water motion respects reduced-motion preferences; Just the breath skips the added layers. These are richer 2D canvas environments, not a 3D engine. The separate Orb scenes are unchanged in this update.

The atmospheric pass adds layered drifting mist, shaded moon detail, distant ridges, a reflective garden stream, mossy rocks, flowers and foreground canopy. Underwater shelves now include branching coral and a distant stone arch; the resonance room includes diffuse nebula wisps. Added motion freezes when reduced motion is enabled. Sunrise rays use the sun’s height above the horizon to shift their directional emphasis, with feathered edges instead of a fixed upward fan.

## 3D environments

The Slow Garden now defaults to a Three.js scene with imported CC0 mossy-rock
and fern models, instanced woodland, textured ground, cast shadows, and a
512px reflection of the actual scene on the water. The existing breathing light,
pause, rhythm editor, and gentle bloom interaction stay in the session canvas.
Weathering uses a reflective mountain lake with a rising sun, textured terrain, and weather intensity linked to the check-in. The Descent adds a rocky seabed, swaying kelp, translucent jellyfish, and light shafts. Resonance uses a 3D star field, nebula clouds, and gently breathing nebula light. The original room timing, grounding prompts, and audio remain in control.

The renderer and assets are served locally with the app. The dependency version
is pinned; run `npm ci` and `npm run vendor:three` to reproduce the committed
vendor files. Static hosting still works without a build step. See
[asset credits](assets/garden/CREDITS.md) and the included Three.js MIT license.

3D begins loading when a journey starts, during Weathering. The three additional rooms share one renderer and reuse the bundled rock models; their other geometry is procedural. Illustrated scenery
remains available while loading, if a model fails to load, if WebGL2 is unavailable,
or if the context is lost. Turn off **Detailed 3D scenery** under **Make this space
yours** to choose the illustrated version. **Just the breath** skips loading 3D.
The additional natural assets total about 3.1 MB, with 1K JPG/PNG textures. Shared
geometry, a capped pixel ratio, and adaptive resolution limit drawing cost.
Reduced motion fixes the camera, water animation, and motes. Physical mobile-device
performance still needs testing before a broad release; the desktop browser's
phone viewport is a layout check, not a device benchmark.

The lakeside trees use three optimized Poly Haven pine variants; see
[tree credits](assets/trees/CREDITS.md). Their original source geometry stays out
of the runtime bundle. `scripts/prepare-pines.mjs` reproduces the geometry from
the source glTF using the pinned meshoptimizer authoring dependency. Underwater
plants use curved fronds with gentle vertex motion that freezes under reduced
motion. The breathing light and high-contrast phase label now appear in every
room, including Resonance.

## Orb living visualizations

The Orb opening screen now offers optional living visuals. After the person
chooses a destination, and after each release response, Claude can supply an
abstract nature metaphor based on the conversation. Only that generated prompt
goes to fal's `minimax/h3-max/text-to-video`; the fal key stays on the server.
These prompts can still reflect personal information, so the opening explains
the external processing and requires a separate opt-in each session.

Set `FAL_KEY` alongside the existing `ANTHROPIC_KEY` in the Vercel environment,
and deploy `api/orb.js`, `api/orb-video.js`, `lib/orb-visual.js`, `orb-visual.js`,
`orb.html`, and `site-config.js` together. For GitHub Pages, include the exact
Pages origin in `ALLOWED_ORIGINS`. A plain static localhost server cannot run
these functions; `site-config.js` currently points local Orb calls to Vercel.
No key belongs in the public config. No deployment or paid generation was
performed as part of implementation.

Playback uses muted, five-second 480P clips, preloads the next clip, and fades
between two video layers. Existing scenery remains while loading; the last
ready clip holds its final frame while waiting, so the path never loops backward.
A ready continuation starts after the previous clip finishes with a brief fade. This is buffered clip playback, not a continuous
Director/WebRTC session or a promise of three-second latency. The opening clip uses text-to-video. Subsequent clips use image-to-video with a JPEG of the previous clip’s last
decoded frame as the starting image. A separate browser decoder extracts it
without seeking the visible player. The original prompt remains the location anchor. The original
scene description stays fixed; new answers only steer small atmospheric changes.
Reference conditioning reduces drift but does not guarantee frame-exact joins.
Each new scene request generates one clip; its final frame stays visible between
answers without generating additional clips. The session limit is 24 attempts
and is displayed when reached. Finishing the conversation lets a requested clip
complete without starting another. Pause, stop, hidden tabs, reduced motion and
care support halt work; in-flight cancellation is best effort and already running
jobs may still be billed. A provider error ends generation for
that session while the Orb continues.

The endpoint accepts signed, expiring prompts from the Orb and signed job URLs.
Its IP throttle is per server process, not a durable account-wide spending cap.
Configure provider spending controls before enabling a public deployment;
shared rate limiting/authentication is needed for stronger abuse protection.
The current tests mock provider requests and check ticket validation, fixed
parameters, origin rejection, failure handling and script compilation. Real
fal latency, clip quality, crossfades and mobile playback still need an enabled
deployment/device check.

Continuity advances only after a clip is displayed. An answer arriving during
generation steers the next clip without discarding the one currently in flight.
Pause/resume keeps the last displayed reference; stop clears it. Invalid or
expired continuity fails without falling back to a newly invented scene.
Reference-video output quality and seam behavior still require live validation.

Starting feelings now travel from the main check-in to the Orb through a
one-use, tab-scoped sessionStorage handoff, expiring after 15 minutes. It contains
only selected feeling keys, relative weights and explicitly answered intensity;
it never reads reflection history. The Orb keeps its initial spoken/typed
feeling answer in memory as well. Both accompany every visual prompt request
when living visuals are enabled. With visuals off, those additional fields are
excluded from the AI context. A direct Orb visit still uses its own check-in.
The person can describe changed feelings during the conversation.

The visual instructions blend the starting feelings into composition, texture,
contrast and gentle motion, while keeping the original place and video
references. They do not infer improvement or treat intensity as a diagnosis.
Deploy `orb-checkin.js` with the app and API changes; it is also used by the
server to validate incoming check-in data. Tests cover one-use handoff, expiry,
unknown intensity, opt-out and retained context across later visual requests.

Orb microphone fixes: browser recognition now delivers a valid result before
cancelling that listening session, and stale callbacks cannot stop the next
question. Audio contexts explicitly resume; realtime connection failures fall
back to recorded transcription. Recording waits for its final audio chunk.
Permission, connection and no-speech states now offer a visible retry message.
Real microphone permissions and provider availability require a device check.

When a living video is displayed, its colors and brightness are unfiltered.
The large 3D Orb, stars and procedural scenery are excluded from that render;
interactive exercise lights remain. A small Orb indicator sits in the controls,
and caption contrast is local to its text panel. Stopping video restores the
procedural view. The opening Orb is smaller to avoid overlapping the question.

Final-frame continuation replaces whole-video referencing. New answers update
the prompt for the next undispatched clip; there is no three-clips-per-answer
cutoff. Legacy backdrop videos no longer loop or compete with living video.
The final-frame JPEG is sent to fal along with the latest signed direction.
If browser cross-origin media restrictions prevent reading the frame, generation
stops with a visible message instead of falling back to independent clips.
Mocked tests validate frame seeking, cleanup, route selection and frame validation.
Real CDN access, visual seams and generation speed still need deployment testing;
this is chained clip generation and can hold between segments, not guaranteed
uninterrupted streaming.

### Orb clip duration and session limit

Living visuals now allow up to 24 generation requests per session. The Orb
chooses 5, 10, or 15 seconds with each visual direction: a short responsive
change, a gradual transition, or a sustained quiet observation. If the model
omits duration, opening defaults to 5 seconds, release to 10, and closing to 15.
Subsequent clips use the latest direction's duration until another answer updates
it. Duration is signed with the prompt and validated on the video server.
Existing tickets without duration retain the 5-second default.

The controls show clip count and requested seconds during generation. Playback
waits for the actual clip length and still chains from the final frame. The
24-clip cap counts attempts; pause, stop and session completion can end earlier.
The per-process IP throttle is 48 submissions per ten minutes, allowing room
for a previous session without immediately blocking a new 24-clip session.
Longer clips and a higher limit increase generated seconds and usage. Maximum
output at 24 × 15 seconds is six minutes, excluding generation waits. No paid
video generation was performed to validate this update.

### Familiar conversation, varied wording and visible motion

The Orb now rotates among three phrasing styles between visits and varies the
scripted questions and invitations when AI is unavailable. Only the style index
is saved locally, and only when saving is enabled; no spoken responses are saved
for this feature. The current session's recent AI lines still discourage repeats.
The breathing and scene-settling invitations now use the same stage-based AI
flow. Conversation order, optional choices and care handling are unchanged.
Generated language can still repeat; this is variation, not a uniqueness guarantee.

Video prompts now request visible slow natural movement and a continuous, very
slow forward camera glide, keeping heading and scene landmarks consistent.
The last-frame handoff remains in place. No turns, roll, zoom or sudden camera
motion are requested. Reduced motion continues to disable generated video, and
pause/stop remain available. Prompt behavior and actual camera motion still need
live visual verification. Deploy `orb-language.js` with the Orb page and APIs.

### Step into this place — World Labs

The living video controls include a 3D section. Create captures the currently
visible frame, pauses the video, and sends the image plus the latest signed Orb
scene prompt to World Labs. This prompt already incorporates the conversation's
feelings and direction; raw transcripts are not added to this request. Generation
runs asynchronously. Enter opens the generated 100k (or 500k fallback) SPZ world
inside the page. The user chooses when to transition and can return at any time.

Set `WORLDLABS_KEY` in Vercel, alongside `FAL_KEY`. Optional `WORLDLABS_MODEL`
defaults to `marble-1.1`. Deploy `api/orb-world.js`, `orb-world.js`,
`orb-world-viewer.js`, `orb.html`, `orb-visual.js`, and `site-config.js`. The browser
loads Spark 2.1.0 from sparkjs.dev on entry, using the bundled Three.js 0.180.0.
Worlds are requested private. Provider asset URLs are sent only to the requesting
browser, and the app does not save the world locally. World Labs retains the
created world in the provider account. Closing the page does not cancel an
already submitted paid generation. The gateway uses signed operation tickets
and a best-effort two-worlds-per-hour per-process IP throttle, not durable billing
protection. There are no paid calls in the automated tests.

Controls: WASD or arrow keys translate; drag with mouse or touch to look; hold
on-screen arrows on mobile. Movement speed is 0.65 scene units/second, bounded
to three units from the initial viewpoint. Return to start resets orientation
and position. Escape or Back returns to the Orb. These are bounded exploration
controls, not collision-aware walking: splat geometry can be crossed. Collider
integration, source-to-world camera alignment, real asset CORS, visual matching,
mobile GPU performance and generated-world quality still need live validation.
A single image cannot determine the unseen environment, so exact visual matching
is not guaranteed. Loading failure returns to the video; no fake procedural
world is substituted for a failed World Labs generation.

### Continuation lifecycle fixes

Completing the conversation no longer cancels the video producer. Living visuals
continue until pause/stop, the 24-attempt budget, an error, reduced-motion, or page
exit. There is no extra delay before dispatching the next clip after playback
starts. A failed status check is retried twice against the same provider job;
submission is not automatically retried, avoiding duplicate paid jobs after an
ambiguous response. Failures now identify the step and offer Retry continuation,
which starts another request from the last displayed endpoint. The legacy
ElevenLabs scenery setting is labeled Single video clip and displays a notice;
it is separate from the opt-in evolving video sequence.

Sequence tests simulate three successive clips, changed direction, conversation
completion and a transient polling failure. They verify the chain and scheduling,
not actual provider speed, output continuity, or gap-free playback.

### Explicit scene direction

Shape this scene accepts typed or spoken requests between guided questions.
Requests are processed through the Orb's safety-constrained scene_update stage;
accepted directions stay in session context for subsequent visual prompts.
The receipt says a direction is queued, not that the generated result already
matches it. In-flight clips finish before the new direction can be generated.
Non-numeric speech at the intensity slider is routed to this scene request path
when living visuals have started; it does not invent an intensity answer.

Continuity now preserves terrain and landmarks while allowing explicit changes
to time of day, light and weather. An old night-scene anchor must not override a
new sunrise request. Scene-update prompts describe a visible sun rising where
the viewpoint permits, rather than just a vague warming of light. Model adherence
still requires live evaluation; the tests verify request delivery and removal
of the conflicting prompt constraints, not that every generated sun will rise.

### Guided scene conversation cadence

With living visuals enabled, the middle of the session is now a scene-guidance
cycle instead of the release exercise and slow-lights game: one explicit
question, the person's answer, confirmation/correction, generation, a checkpoint
for the matching displayed clip, and an explicit Ready action before the next
question. It asks what would match the person's present feelings, what would
move toward their desired feeling, and what they would keep or change. Saying
done proceeds to the closing check-in. The procedural-only path retains its
exercises, with a fresh question before each additional release answer.

A scene checkpoint waits for the exact prompt ticket to reach playback, never
just for any new clip. It offers Continue without waiting and a bounded wait
with an honest pending/failure message. Seeing the generated clip is not proof
that the model fulfilled the instruction; the person is asked to assess it.
Question controls state the expected input. Slider speech that isn't a number
now asks for clarification instead of silently routing it elsewhere. The slider
has a microphone retry button. Listening is cancelled before a caption is spoken.
# Optional live Orb check-in

The Orb now includes an opt-in GPT-Live 1 opening conversation. It supports
interruptions, captions, microphone pause, and an editable review before the
usual journey continues. Live voice ends before the quiet exercises.

Run `npm run dev` for the local site and API. Enable the trial with the
server-only `OPENAI_API_KEY` and `ORB_LIVE_ENABLED=true` settings described in
[DEPLOY.md](DEPLOY.md#GPT-Live-opening-check-in-optional-prototype). Without them,
the usual voice remains available. Automated tests cover the connection lifecycle,
late responses, transcript handling, review, and recovery; live voice quality and
account access still require a real microphone session.

## Visualization conversation and matching ambience

The guided questions now invite sensory imagination instead of asking visitors to
design scenes. Visual responses include an allowlisted soundscape, which switches
when that response’s clip starts playing. Water stops when a sky clip begins; stale
sound requests cannot replace newer ambience. Mute and listening volume persist
across changes. If replacement audio is unavailable, the previous environment
does not keep playing.

The voice indicator distinguishes connecting, confirmed GPT-Live connection,
ended live voice, and the guided voice used after the opening check-in. Vercel
environment settings apply to the hosted site, not the localhost preview.

## Continuous video handoffs

Video journeys skip the legacy black arrival veil. Incoming clips preload in
parallel with final-frame extraction, and playback waits for a decoded video
frame before revealing the new layer. The outgoing layer remains underneath
the fade; inactive video elements are reused only after their fade has finished.
A still final frame fills generation delays without replaying the clip or
jumping backward. New generation can still take longer than a clip’s duration,
so uninterrupted movement is not guaranteed.
