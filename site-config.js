/* Slow Light — public site configuration. This file IS committed and public:
   nothing secret belongs in it.

   On Vercel, the proxy function in this repo (api/eleven/) gives visitors
   the full ElevenLabs experience — voice, listening, scenery — while the
   key lives only in Vercel's Environment Variables (ELEVENLABS_KEY).

   On GitHub Pages there is no function runtime, so the proxy is left unset
   there and the orb quietly runs with the browser voice instead. To give
   Pages the full experience too, replace the "" below with your full Vercel
   URL, e.g. "https://slow-light.vercel.app/api/eleven", and add the Pages
   origin to the function's ALLOWED_ORIGINS environment variable. */
window.SLOWLIGHT_PUBLIC = {
  // On Vercel, use this site's own function; on GitHub Pages, borrow Vercel's.
  proxy: /github\.io$/.test(location.hostname)
    ? "https://slow-light.vercel.app/api/eleven"
    : "/api/eleven"
};
