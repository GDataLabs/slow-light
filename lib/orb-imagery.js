/* Finds a literal place or image the visitor already named in their first
   answer ("up in the clouds", "by the ocean"), so the opening scene depicts
   THAT place instead of an invented metaphor. Pure and deterministic. */
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
module.exports = { findImagery, anchorVisual, ANCHORS };
