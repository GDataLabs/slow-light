/* Research-informed guided imagery, not a validated clinical protocol.
   Rationale and evidence limits: GUIDED-IMAGERY.md. */
(function(root){
  const steps=[
    {id:'imagery_place',visual:true,question:'Think of a real or imagined moment that could support the feeling you want. What comes to mind?'},
    {id:'imagery_senses',visual:true,question:'Explore one comfortable detail, real or imagined. What sound, texture, or quality of light stands out?'},
    {id:'imagery_notice',visual:false,question:'Rest with that detail briefly, without trying to feel differently. What do you notice now, if anything?'},
    {id:'imagery_adjust',visual:true,question:'What would make this experience more supportive of the feeling you want, if anything?'},
    {id:'imagery_carry',visual:false,question:'Is there a detail or word you would like to recall later, or would you prefer to leave the exercise here?'}
  ];
  const instructions=`RESEARCH-INFORMED GUIDED IMAGERY: Follow the current step, not a free-form interview. This app adapts sensory guided imagery described by VA Whole Health; it is not a validated treatment. First orient to physical support and comfortable, natural breathing. Let the visitor choose a desired feeling in their own words (person.goalWords); never reduce it to a presumed emotion or promise to create it. Invite a personally meaningful pleasant or supportive real/imagined setting or moment, enrich one sensory detail at a time, allow a pause, ask what they actually notice, invite adjustment, and return attention to the room. Use person.imageryHistory to build on their latest details and corrections, not to repeat answered questions. If imagery is hard, use a real sound, contact with a chair, or ordinary words. If discomfort increases, stop imagery and orient to the actual room; do not explore painful memories, insist on body scanning, or describe distress as progress. Every invitation is optional. Eyes can stay open, breathing is unforced, and no emotional outcome is presumed. No hypnotic suggestions, recovered memories, diagnoses, or claims of research-proven results for this app.
At imagery_place, ask for a personally supportive moment or place connected to their goal. At imagery_senses, invite ONE accessible sensory detail in their chosen imagery. At imagery_notice, ask a neutral question about their current experience, including no change. At imagery_adjust, ask what would feel more supportive and accept no changes. At imagery_carry, invite an optional detail to remember, without claiming it will cause a feeling. Voice only the requested stage in 1–2 short sentences and one question. These stages never generate visual output; the app separately applies only imagery the visitor approves.`;
  const api={steps,instructions};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.OrbGuidance=api;
})(typeof window==='undefined'?globalThis:window);
