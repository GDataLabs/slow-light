# Slow Light — Multi-Sensory Entrainment Platform

> A self-guided, science-backed multi-sensory entrainment experience for nervous system regulation, deceleration, and relaxation.

🔗 **Live Demo**: [https://gdatalabs.github.io/slow-light/](https://gdatalabs.github.io/slow-light/)

---

## 🌊 Design Spine & Scientific Pillars

1. **Iso Principle & Physiological Entrainment**
   - Meets your initial arousal level (via emotion check-in or real-time breath/camera sensors) and gradually guides your breathing toward **~5.5 breaths per minute** (the vagal resonance frequency maximizing Heart Rate Variability).
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
