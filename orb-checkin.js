/* One-use check-in handoff between pages; never read session history. */
(function(root) {
  const KEY = 'slowlight.orbCheckIn';
  const moods = ['wired','tense','overwhelmed','fearful','heavy','sad','numb','frustrated','hopeful','joyful','excited','neutral'];
  function clean(value) {
    if (!value || typeof value !== 'object') return null;
    const feelings = Array.isArray(value.feelings) ? value.feelings
      .filter(f => f && moods.includes(f.key)).slice(0, 12)
      .map(f => ({ key: f.key, weight: typeof f.weight === 'number' && Number.isFinite(f.weight) ? Math.max(0, Math.min(1, f.weight)) : null })) : [];
    const intensity = typeof value.intensity === 'number' && Number.isFinite(value.intensity) ? Math.max(0, Math.min(10, value.intensity)) : null;
    return feelings.length || intensity !== null ? { feelings, intensity } : null;
  }
  function save(storage, value, now = Date.now()) {
    try {
      storage.removeItem(KEY);
      const checkIn = clean(value);
      if (checkIn) storage.setItem(KEY, JSON.stringify({at: now, checkIn}));
    } catch {} // Private browsing must not prevent navigation.
  }
  function take(storage, now = Date.now()) {
    try {
      const raw = storage.getItem(KEY); storage.removeItem(KEY);
      const value = JSON.parse(raw);
      if (!value || typeof value.at !== 'number' || now < value.at || now - value.at > 15 * 60000) return null;
      return clean(value.checkIn);
    } catch { return null; }
  }
  const api = { clean, save, take };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OrbCheckIn = api;
})(globalThis);
