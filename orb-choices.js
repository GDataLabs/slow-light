/* Fast explicit choices plus contextual interpretation through the Orb’s mind. */
(function(root) {
  'use strict';
  const normalize = text => String(text).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const aliases = {
    'yes thats close': ['yes', 'yeah', 'yep', 'correct', 'thats right', 'thats correct', 'that is correct', 'that feels right', 'yes thats right'],
    'let me change that': ['no', 'nope', 'not quite', 'thats not right', 'that is not correct', 'change that', 'change it', 'no thats not right'],
    'lets stay here': ['stay', 'stay here', 'lets stay', 'not yet'],
    'im ready to continue': ['ready', 'im ready', 'continue', 'lets continue', 'go ahead'],
    'retry my video': ['retry', 'try again', 'retry the video'],
    'continue without video': ['continue', 'go ahead', 'skip the video', 'no video'],
    'continue without waiting': ['continue', 'continue now', 'dont wait'],
    'wait for my scene': ['wait', 'keep waiting', 'wait for it'],
    'continue with this view': ['continue', 'continue now', 'use this view']
  };
  root.OrbChoices = {
    async interpret(text, choices, context = {}, signal) {
      const exact = this.match(text, choices);
      if (exact >= 0) return {choice:exact,revisedAnswer:null};
      const response = await fetch(root.SLOWLIGHT_PUBLIC?.brain || '/api/orb', {
        method:'POST', headers:{'Content-Type':'application/json'},
        signal: signal ? AbortSignal.any([signal,AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
        body:JSON.stringify({stage:'choice_intent',reply:text.slice(0,2000),choices,...context})
      });
      if(!response.ok)throw new Error('Choice interpretation unavailable');
      const result=await response.json();
      return {choice:Number.isInteger(result.choice)&&result.choice>=0&&result.choice<choices.length?result.choice:null,
        crisis:result.crisis===true,revisedAnswer:typeof result.revisedAnswer==='string'?result.revisedAnswer.slice(0,300):null};
    },
    match(text, choices) {
    const words = normalize(text).replace(/ please$/, '');
    const matches = choices.map((choice, index) => ({index, key: normalize(choice)}))
      .filter(({key}) => key === words || (aliases[key] || []).includes(words));
    return matches.length === 1 ? matches[0].index : -1;
  }};
})(typeof window === 'undefined' ? globalThis : window);
