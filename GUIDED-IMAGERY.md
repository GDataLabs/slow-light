# The Orb’s guided imagery approach

This is a research-informed wellness exercise, not a validated clinical protocol.
The Orb supports exploration of a visitor’s preferred feeling; it cannot promise
to produce that feeling or infer improvement from their imagery or interactions.

## Foundation

[VA Whole Health’s guided imagery guidance](https://www.va.gov/WHOLEHEALTHLIBRARY/tools/Guided-Imagery.asp)
describes settling first, developing personally meaningful imagery, engaging the
senses, noticing emotions, and retaining control over the experience. These are
the foundation for the Orb’s prompts, rather than a fixed mapping from an emotion
to a landscape.

[A randomized study of 60 healthy undergraduates](https://pubmed.ncbi.nlm.nih.gov/34306146/)
compared 20-minute audio-guided imagery, muscle relaxation, breathing, and a control
condition. Guided imagery improved measured relaxation relative to control. This
small, specific study does not validate an AI-generated exercise, a shorter session,
clinical treatment, or reliably creating any desired emotion.

[NCCIH’s overview](https://www.nccih.nih.gov/health/relaxation-techniques-what-you-need-to-know)
notes that research quality and findings vary, and relaxation can sometimes increase
anxiety or intrusive thoughts. The Orb therefore accepts unchanged or uncomfortable
responses, allows stopping, and redirects attention to the actual room when needed.
It does not explore trauma or explain worsening feelings as a sign of progress.

## App sequence

1. **Orient:** support beneath the body, optional natural breathing, eyes open if preferred.
2. **Choose a direction:** retain the visitor’s desired feeling in their own words.
3. **Recognize the desired feeling inwardly:** invite the visitor to describe how they would recognize it in their sensations, thoughts or emotions.
4. **Develop an image:** invite an image, texture or movement associated with that inward observation; use ordinary words if imagery is difficult.
5. **Observe:** invite an honest report without assuming change.
6. **Adjust:** ask what would be more supportive, retaining their corrections.
7. **Carry and return:** optionally recall a detail, then attend to the room and move gently.

The sequence runs with or without generated scenery. `orb-guidance.js` supplies
shared stage intentions and fallback questions; the brain personalizes each stage
using the visitor’s goal and recent answers. Only approved imagery steps update
video. Observation and carry-forward answers do not generate scenery.

## Conversational feedback

At confirmation prompts, exact short answers can be handled immediately. Other
replies go to the existing Orb brain with the offered choices, current question,
proposed imagery, and desired feeling. The interpretation can select only an offered
choice. Mixed approval with a concrete change routes to change. A revised description
retains the correction and is reflected for confirmation; a bare rejection invites
clarification. Uncertain replies remain pending. Typed feedback uses the same route.
Late responses are ignored after a button choice or a new question.

The feature requires the existing server `ANTHROPIC_KEY`; it does not rely on OpenAI
Live credits. These short feedback replies now go to the Orb’s AI service as well
as the configured speech recognition service when spoken. No new browser persistence
is added for feedback, goals or imagery history.

## Live voice wording

The introduction says “Start with a live voice conversation.” The provider handles
a conversation of up to three minutes; after reviewing their words, the visitor
continues with guided visualization and can still answer by voice. This wording
does not imply that GPT/Gemini live transport remains active through the full journey.

## Verification and limits

Automated checks cover bounded semantic routing, malformed responses, retained
corrections, ambiguous replies, stale-response cancellation, and the shared sequence.
Browser checks exercise typed conversational feedback and button fallback with a
mocked interpretation service. Real model interpretation quality and the exercise’s
emotional effects require separate user evaluation; passing these tests establishes
neither clinical efficacy nor perfect understanding of every utterance.

### Waiting for video versus reflecting

Video preparation is a separate state from a reflection question. The Orb does not
announce that a generated place is present before playback has been confirmed.
Progress appears beside the conversation, and failures offer retry or continuation
without video. The visitor can still say continue while waiting. Once the requested
video is displayed, the guide proceeds to reflection without an extra readiness
question. The brain replaces a prose-only response at an imagery question stage
with the corresponding fallback question, preserving crisis responses.
