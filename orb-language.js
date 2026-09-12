/* Familiar stage intentions with rotating wording; no personal text is saved. */
(function(root){
  const variants = {
    greet:['Welcome. There is room to arrive just as you are.','Hello. Let this be a small pause in your day.','You are here. We can take this one moment at a time.'],
    breathe:['If it feels comfortable, let one breath come and go. Nothing to get right.','Notice one easy breath. Let your shoulders rest if they want to.','Take a breath at your own pace. We have time.'],
    ask_feelings:['What feelings have come with you today? A word or two is enough.','As you pause here, what do you notice inside?','How are things feeling for you right now? You can tell me in your own words.'],
    ask_grip:['How much space is that feeling taking up, from zero to ten?','On this scale, how strong does it feel right now?','Where would you place the feeling on this zero-to-ten scale?'],
    ask_destination:['What would you like a little more of here: calm, steadiness, or lightness?','How would you like this place to feel for you?','What would feel welcome now—something quieter, steadier, or softer?'],
    settle:['Let the place come into view. You can keep your eyes open or rest them for a moment.','Stay with an easy breath while the scene settles around you.','There is no need to hurry into this place. Look around when you are ready.'],
    arrive:['Take a moment to look around. You do not need to do anything yet.','Here we are. Let your attention settle wherever it feels comfortable.','Notice one small detail in this place. It can be enough for now.'],
    release_invite:['Is there one thought you would like to set down for a moment? You can also say done.','Name something you are carrying, if you would like. We can give it a little space.','What could rest here for a while? A word is enough, or you can skip this.'],
    release_response:['Let it move a little farther away. You can simply watch.','It can rest here for this moment. Nothing else is asked of you.','Notice the space around it. You do not have to work out an answer now.'],
    ask_now:['Where is the feeling on the same scale now? Any answer is welcome.','Take another look inside. What number fits now, from zero to ten?','Using the same scale, how much space does that feeling take up now?']
  };
  function create(storage, random=Math.random){
    let index=Math.floor(random()*3);
    try { if(storage && storage.getItem('slowlight.remember')!=='false') {
      const old=storage.getItem('slowlight.orbLanguage');
      if(old!==null && /^[0-2]$/.test(old)) index=(Number(old)+1)%3;
      storage.setItem('slowlight.orbLanguage',String(index));
    }} catch {}
    const used={};
    return {variation:index, line(stage,fallback){
      const choices=variants[stage]; if(!choices) return fallback;
      const n=used[stage]||0;used[stage]=n+1;
      return choices[(index+n)%choices.length];
    }};
  }
  if(typeof module!=='undefined' && module.exports) module.exports={create};
  else {let storage;try{storage=root.localStorage;}catch{} root.OrbLanguage=create(storage);}
})(globalThis);
