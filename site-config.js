/* Slow Light — public site configuration. This file IS committed and public:
   nothing secret belongs in it. The proxy carries ElevenLabs calls; the
   brain is the /api/orb function that writes the orb's lines with Claude.
   Keys for both live only in Vercel's Environment Variables
   (ELEVENLABS_KEY and ANTHROPIC_KEY). */
(function(){
  var vercel = "https://slow-light.vercel.app";
  var onVercel = /vercel\.app$/.test(location.hostname);
  window.SLOWLIGHT_PUBLIC = {
    // ElevenLabs proxy: same-site on Vercel; the GitHub Pages copy borrows Vercel's.
    proxy: /github\.io$/.test(location.hostname) ? vercel + "/api/eleven" : "/api/eleven",
    // The orb's mind: same-site on Vercel; everywhere else (github.io, localhost) borrows Vercel's.
    world: onVercel ? "/api/orb-world" : vercel + "/api/orb-world",
    video: onVercel ? "/api/orb-video" : vercel + "/api/orb-video",
    // Live voice uses a local function for local development; Pages borrows Vercel's.
    live: /github\.io$/.test(location.hostname) ? vercel + "/api/orb-live" : "/api/orb-live",
    brain: onVercel ? "/api/orb" : vercel + "/api/orb"
  };
})();
