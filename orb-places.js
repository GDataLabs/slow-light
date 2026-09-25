/* Finds a literal place or image the visitor named ("up in the clouds", "by
   the ocean"), so the opening scene depicts THAT place instead of an invented
   metaphor. Shared by the page (window.OrbPlaces) and the server. */
(function(root){

  const ANCHORS = [
  { key: 'clouds',    re: /\bclouds?\b|\bcloudy\b|\bup in the sky\b|\bin the sky\b|\babove the sky\b/i, words: /cloud/i, phrase: 'Drifting slowly high above and through soft, luminous white clouds in open sky', soundscape: 'sky' },
  { key: 'sky',       re: /\bsky\b|\bfloat(?:ing|s)?\b|\bfly(?:ing)?\b|\bsoar(?:ing)?\b|\bweightless\b|\bairborne\b/i, words: /sky|cloud|air/i, phrase: 'Floating gently through open sky among soft drifting clouds', soundscape: 'sky' },
  { key: 'stars',     re: /\bstars?\b|\bstarry\b|\bgalax(?:y|ies)\b|\bcosmos\b|\bouter space\b/i, words: /star/i, phrase: 'A calm night sky full of softly glowing stars', soundscape: 'quiet' },
  { key: 'ocean',     re: /\bocean\b|\bsea\b|\bwaves?\b|\btide\b|\bunderwater\b/i, words: /ocean|sea|wave|water/i, phrase: 'A calm open ocean with slow, gentle waves', soundscape: 'shore' },
  { key: 'beach',     re: /\bbeach\b|\bshore\b|\bcoast\b|\bsand\b/i, words: /beach|shore|coast|sand/i, phrase: 'A quiet sandy shore where soft waves slide in and out', soundscape: 'shore' },
  { key: 'waterfall', re: /\bwaterfalls?\b/i, words: /waterfall/i, phrase: 'A gentle waterfall falling into a clear, calm pool', soundscape: 'forest' },
  { key: 'river',     re: /\brivers?\b|\bstreams?\b|\bcreek\b|\bbrook\b/i, words: /river|stream|creek|brook|water/i, phrase: 'A clear, slow river winding gently through the landscape', soundscape: 'forest' },
  { key: 'lake',      re: /\blakes?\b|\bpond\b/i, words: /lake|pond|water/i, phrase: 'A still, glassy lake with soft ripples', soundscape: 'shore' },
  { key: 'rain',      re: /\brain(?:y|ing|drops?)?\b|\bdrizzle\b/i, words: /rain/i, phrase: 'Soft, steady rain falling over a sheltered natural place', soundscape: 'rain' },
  { key: 'snow',      re: /\bsnow(?:y|ing|flakes?)?\b|\bwinter\b/i, words: /snow/i, phrase: 'Soft snow falling slowly over a quiet landscape', soundscape: 'quiet' },
  { key: 'mountain',  re: /\bmountains?\b|\bpeaks?\b|\bsummit\b/i, words: /mountain|peak|summit/i, phrase: 'Wide, quiet mountain peaks under a soft sky', soundscape: 'sky' },
  { key: 'forest',    re: /\bforests?\b|\bwoods\b|\btrees\b|\bjungle\b/i, words: /forest|wood|tree/i, phrase: 'A peaceful forest with tall trees and soft light between them', soundscape: 'forest' },
  { key: 'desert',    re: /\bdesert\b|\bdunes?\b/i, words: /desert|dune/i, phrase: 'Soft desert dunes under a gentle, warm sky', soundscape: 'quiet' },
  { key: 'garden',    re: /\bgardens?\b|\bflowers?\b|\bblossoms?\b/i, words: /garden|flower|blossom/i, phrase: 'A quiet garden of softly swaying flowers', soundscape: 'meadow' },
  { key: 'meadow',    re: /\bmeadows?\b|\bfields?\b|\bgrass(?:y|es)?\b/i, words: /meadow|field|grass/i, phrase: 'An open meadow of softly swaying grasses', soundscape: 'meadow' },
  { key: 'reef',      re: /\bcoral\b|\breefs?\b|\btide ?pools?\b/i, words: /coral|reef|tide ?pool/i, phrase: 'A calm, clear shallow reef where soft light ripples over coral and slow fish', soundscape: 'underwater' },
  { key: 'aurora',    re: /\baurora\b|\bnorthern lights\b/i, words: /aurora|northern lights/i, phrase: 'Soft green northern lights slowly rippling over a quiet snowy landscape', soundscape: 'quiet' },
  { key: 'canyon',    re: /\bcanyons?\b|\bred rocks?\b|\bmesa\b/i, words: /canyon|mesa|red rock/i, phrase: 'A wide, quiet canyon of warm red stone with a slow river far below', soundscape: 'sky' },
  { key: 'island',    re: /\bislands?\b|\blagoon\b/i, words: /island|lagoon/i, phrase: 'A small quiet island in a calm turquoise lagoon', soundscape: 'shore' },
  { key: 'bamboo',    re: /\bbamboo\b/i, words: /bamboo/i, phrase: 'A tall bamboo grove swaying gently with soft light between the stems', soundscape: 'forest' },
  { key: 'volcano',   re: /\bhot springs?\b|\bgeysers?\b/i, words: /spring|geyser/i, phrase: 'Steaming natural hot springs among smooth stones under a soft sky', soundscape: 'quiet' },
  { key: 'sunrise',   re: /\bsunrise\b|\bsunset\b|\bdawn\b|\bsunshine\b|\bsunlight\b/i, words: /sun|dawn/i, phrase: 'Warm, soft sunlight spreading slowly across a wide horizon', soundscape: 'dawn' }
];
function findImagery(...texts) {
  const text = texts.filter(t => typeof t === 'string').join(' ').slice(0, 900);
  if (!text.trim()) return null;
  // the earliest-named image wins, so "clouds over the ocean" opens in the clouds
  let best = null, at = Infinity;
  for (const a of ANCHORS) { const m = text.match(a.re); if (m && m.index < at) { best = a; at = m.index; } }
  return best ? { key: best.key, phrase: best.phrase, soundscape: best.soundscape, words: best.words } : null;
}
/* Guarantee: the opening prompt must visibly contain the named place. */
function anchorVisual(visual, imagery) {
  if (!imagery || typeof visual !== 'string') return visual;
  return imagery.words.test(visual) ? visual : imagery.phrase + '. ' + visual;
}
  const api = { findImagery, anchorVisual, ANCHORS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.OrbPlaces = api;
})(typeof window === 'undefined' ? globalThis : window);
