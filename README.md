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
