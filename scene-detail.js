/* Deterministic, cached scenery. Detail is painted once per room/viewport;
   only a few water lines drift per frame. No downloaded textures or assets. */
const SceneDetail = (() => {
  const cache=new Map();
  let mistTexture;
  const mix=(a,b,t)=>a+(b-a)*t;
  function noise(x,y){
    const hash=(a,b)=>{const v=Math.sin(a*127.1+b*311.7)*43758.5453;return v-Math.floor(v);};
    const a=Math.floor(x),b=Math.floor(y),fx=x-a,fy=y-b,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
    return mix(mix(hash(a,b),hash(a+1,b),u),mix(hash(a,b+1),hash(a+1,b+1),u),v);
  }
  function field(x,y){return noise(x,y)*.57+noise(x*2.03,y*2.03)*.28+noise(x*4.1,y*4.1)*.15;}
  function mist(){
    if(mistTexture)return mistTexture;
    const cv=document.createElement('canvas');cv.width=384;cv.height=160;
    const c=cv.getContext('2d'),im=c.createImageData(cv.width,cv.height);
    for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++){
      const edge=Math.sin(y/cv.height*Math.PI)**2;
      // Cross-fade at the tile seam so an endless drift has no visible join.
      const n=mix(field(x/48,y/36),field((x-cv.width)/48,y/36),x/cv.width);
      const a=Math.max(0,n-.29)*edge;const i=(y*cv.width+x)*4;
      im.data[i]=167;im.data[i+1]=201;im.data[i+2]=193;im.data[i+3]=a*180;
    }
    c.putImageData(im,0,0);mistTexture=cv;return cv;
  }
  function rock(c,x,y,r,rnd,tint='moss'){
    c.save();c.translate(x,y);c.scale(1,.63);
    const palette=tint==='moss'?['#72856c','#354e44','#112a27']:['#58848b','#2b515e','#122f40'];
    const g=c.createLinearGradient(-r,-r,r,r);palette.forEach((v,i)=>g.addColorStop(i/2,v));c.fillStyle=g;
    c.beginPath();for(let i=0;i<11;i++){const a=i/10*Math.PI*2,rr=r*(.8+rnd()*.22);c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.closePath();c.fill();c.clip();
    for(let j=0;j<65;j++){const xx=(rnd()-.5)*r*2,yy=(rnd()-.5)*r*2;c.fillStyle=j%3?'#b0c6a61a':'#00142133';c.fillRect(xx,yy,1+rnd()*r*.12,.5+rnd()*r*.04);}
    c.strokeStyle='#a2bda43a';c.lineWidth=.7;c.beginPath();c.moveTo(-r*.6,-r*.2);c.lineTo(-r*.1,-r*.63);c.lineTo(r*.4,-r*.42);c.stroke();c.restore();
  }
  function coral(c,x,y,h,rnd){
    c.save();c.translate(x,y);c.strokeStyle='#4f999670';c.lineCap='round';
    function branch(x,y,a,len,depth){if(depth===0)return;const xx=x+Math.cos(a)*len,yy=y+Math.sin(a)*len;c.lineWidth=depth*.6;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+(xx-x)*.7,y+(yy-y)*.2,xx,yy);c.stroke();branch(xx,yy,a-.4-rnd()*.2,len*.66,depth-1);branch(xx,yy,a+.35+rnd()*.2,len*.68,depth-1);}
    branch(0,0,-Math.PI/2,h*.35,5);c.restore();
  }
  function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
  function glow(c,x,y,r,color){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
  function tree(c,x,y,h,tone,rnd){
    c.strokeStyle=tone;c.lineWidth=Math.max(.5,h*.022);c.beginPath();c.moveTo(x,y);c.lineTo(x,y-h);c.stroke();
    c.fillStyle=tone;
    for(let k=0;k<11;k++){
      const f=k/11,w=h*(.025+.21*f),top=y-h+h*f*.83;
      c.beginPath();c.moveTo(x,top);
      for(let j=1;j<=8;j++){const t=j/8;c.lineTo(x-w*t*(.8+rnd()*.3),top+h*(.15*t)+h*(rnd()-.5)*.026);}
      c.lineTo(x,top+h*.14);
      for(let j=8;j>=1;j--){const t=j/8;c.lineTo(x+w*t*(.8+rnd()*.3),top+h*(.15*t)+h*(rnd()-.5)*.026);}c.closePath();c.fill();
      c.lineWidth=Math.max(.3,h*.004);for(let j=0;j<5;j++){const dx=w*(j/5);c.beginPath();c.moveTo(x-dx,top+h*.10);c.lineTo(x-dx-w*.16,top+h*.16);c.moveTo(x+dx,top+h*.10);c.lineTo(x+dx+w*.16,top+h*.16);c.stroke();}
    }
  }
  function fern(c,x,y,h,lean,tone){
    c.save();c.translate(x,y);c.rotate(lean);c.strokeStyle=tone;c.fillStyle=tone;c.lineWidth=Math.max(.5,h*.009);
    c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(-h*.12,-h*.55,0,-h);c.stroke();
    for(let j=1;j<12;j++){const f=j/12,yy=-h*f,span=h*.24*Math.sin(f*Math.PI);for(const dir of [-1,1]){c.beginPath();c.moveTo(-h*.04,yy);c.quadraticCurveTo(dir*span*.45,yy-h*.14,dir*span,yy-h*.12);c.quadraticCurveTo(dir*span*.5,yy-h*.015,-h*.04,yy+2);c.fill();}}
    c.restore();
  }
  function build(kind,width,height){
    const canvas=document.createElement('canvas'),scale=Math.min(1.5,1600/width);
    canvas.width=Math.ceil(width*scale);canvas.height=Math.ceil(height*scale);
    const c=canvas.getContext('2d');c.scale(canvas.width/1000,canvas.height/700);
    const rnd=random({weather:831,garden:139,descent:471,resonance:933}[kind]);
    if(kind==='weather'){
      // Forest silhouettes and their broken reflection form a coherent far shore.
      for(let layer=0;layer<3;layer++){
        const tone=['#657f803b','#38575870','#1c3b3b99'][layer];
        for(let i=0;i<140;i++){const x=i*7.5+(rnd()-.5)*9,y=90+Math.sin(x*.008+layer)*12+layer*15;tree(c,x,y,8+rnd()*23+layer*3,tone,rnd);}
      }
      c.save();c.translate(0,295);c.scale(1,-.95);c.globalAlpha=.18;
      for(let i=0;i<100;i++){const x=i*10;tree(c,x,135+Math.sin(x*.008+2)*12,10+rnd()*25,'#254348',rnd);}c.restore();
      for(let i=0;i<380;i++){const y=160+rnd()*490,f=(y-160)/490,x=rnd()*1000;c.strokeStyle=`rgba(173,206,207,${.025+f*.025})`;c.lineWidth=.35+f*.5;c.beginPath();c.moveTo(x,y);c.lineTo(x+2+f*26,y);c.stroke();}
    }
    if(kind==='garden'){
      const sky=c.createLinearGradient(0,0,0,700);sky.addColorStop(0,'#0c1d25');sky.addColorStop(.5,'#172f30');sky.addColorStop(1,'#070f12');c.fillStyle=sky;c.fillRect(0,0,1000,700);
      glow(c,680,165,295,'#729a8758');glow(c,675,150,66,'#e6efd23c');
      // Moon shading and surface variation; correct for the viewport aspect.
      c.save();c.translate(675,150);c.scale(height/width*1000/700,1);
      const moon=c.createRadialGradient(-5,-5,0,0,0,17);moon.addColorStop(0,'#fff3d8');moon.addColorStop(.8,'#d2dec5');moon.addColorStop(1,'#9cad9b');c.fillStyle=moon;c.beginPath();c.arc(0,0,17,0,Math.PI*2);c.fill();c.clip();
      for(let i=0;i<18;i++){const x=(rnd()-.5)*30,y=(rnd()-.5)*30;glow(c,x,y,1+rnd()*4,'#697b6a25');}c.restore();
      for(let layer=0;layer<3;layer++){
        c.fillStyle=['#30454c','#334d50','#304b48'][layer];c.beginPath();c.moveTo(0,440);
        for(let x=0;x<=1010;x+=4)c.lineTo(x,310+layer*23-field(x*.008+layer*7,4)*115);
        c.lineTo(1000,440);c.closePath();c.fill();
      }
      c.save();c.globalAlpha=.35;c.drawImage(mist(),-200,215,1400,180);c.restore();
      for(let layer=0;layer<4;layer++){
        const base=350+layer*55;const tone=['#35514e','#28453e','#19382e','#0d251f'][layer];
        const ground=c.createLinearGradient(0,base-40,0,700);ground.addColorStop(0,tone);ground.addColorStop(1,"#081912");c.fillStyle=ground;c.beginPath();c.moveTo(0,700);for(let x=0;x<=1010;x+=10)c.lineTo(x,base+Math.sin(x*.005+layer*2)*36+Math.sin(x*.017)*9);c.lineTo(1000,700);c.fill();
        for(let i=0;i<24;i++){const x=rnd()*1000,y=base+Math.sin(x*.005+layer*2)*36+Math.sin(x*.017)*9+8;tree(c,x,y,35+rnd()*100,tone,rnd);}
        glow(c,460,base-10,450,'#9bc3a512');
        c.save();c.globalAlpha=.17;c.drawImage(mist(),-60,base-55,1120,100);c.restore();
      }
      // An illuminated path draws the eye into the scene without occupying the pacer.
      const path=c.createLinearGradient(0,380,0,700);path.addColorStop(0,'#aecbc661');path.addColorStop(.6,'#6b979778');path.addColorStop(1,'#283f4470');c.fillStyle=path;c.beginPath();c.moveTo(590,390);c.bezierCurveTo(350,490,720,560,480,700);c.lineTo(700,700);c.bezierCurveTo(830,540,420,470,590,390);c.fill();
      c.save();c.clip();
      for(let i=0;i<360;i++){const y=395+rnd()*310,f=(y-390)/310,x=380+rnd()*480;c.strokeStyle=`rgba(185,218,203,${.08+rnd()*.22})`;c.lineWidth=.4+f*.5;c.beginPath();c.moveTo(x,y);c.lineTo(x+2+rnd()*22*f,y);c.stroke();}c.restore();
      // Moss-covered stones and tiny flowers make the near bank tangible.
      for(let i=0;i<32;i++){const y=560+rnd()*150,x=i%2?250+rnd()*160:800+rnd()*190;rock(c,x,y,4+rnd()*18,rnd);}
      for(let i=0;i<95;i++){const x=rnd()*1000,y=535+rnd()*170;if(x>380&&x<760)continue;
        c.strokeStyle='#63846b80';c.lineWidth=.7;c.beginPath();c.moveTo(x,y);c.lineTo(x+2,y-5-rnd()*13);c.stroke();
        c.fillStyle=i%3?'#b0b9cc99':'#d9cbb4aa';for(let k=0;k<4;k++){c.beginPath();c.ellipse(x+2+Math.cos(k*Math.PI/2)*1.3,y-12+Math.sin(k*Math.PI/2)*1.3,1.4,.8,k,0,Math.PI*2);c.fill();}
      }
      // Tall trunks frame the view; their highlights face the moon.
      for(const side of [-1,1]){c.save();if(side===1){c.translate(1000,0);c.scale(-1,1);}
        const bark=c.createLinearGradient(0,0,70,0);bark.addColorStop(0,'#07171a');bark.addColorStop(.75,'#112a28');bark.addColorStop(1,'#315046');c.fillStyle=bark;c.beginPath();c.moveTo(-20,700);c.bezierCurveTo(65,470,20,220,35,-20);c.lineTo(70,-20);c.bezierCurveTo(50,230,105,480,65,700);c.fill();
        c.strokeStyle='#07191ae6';c.lineWidth=18;c.beginPath();c.moveTo(42,90);c.bezierCurveTo(100,150,190,85,230,40);c.stroke();c.lineWidth=7;c.beginPath();c.moveTo(140,110);c.quadraticCurveTo(160,60,205,0);c.stroke();
        for(let i=0;i<70;i++){const x=70+rnd()*200,y=rnd()*100;c.fillStyle=i%2?'#12332dba':'#0c2424cc';c.beginPath();c.ellipse(x,y,8+rnd()*20,4+rnd()*9,-.4,0,Math.PI*2);c.fill();}c.restore();}

      for(let i=0;i<210;i++){const x=rnd()*1000,y=450+rnd()*250;c.strokeStyle=`rgba(101,140,95,${.12+rnd()*.23})`;c.lineWidth=.7;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+8,y-12-rnd()*18,x+2,y-6-rnd()*35);c.stroke();}
      for(let i=0;i<27;i++){const x=i<14?rnd()*270:780+rnd()*220;fern(c,x,710+rnd()*20,70+rnd()*180,(rnd()-.5)*.8,i%3?'#162e25':'#284a35');}
      for(let i=0;i<65;i++){const x=rnd()*1000,y=435+rnd()*200;glow(c,x,y,2+rnd()*3,'#e4ddb447');}
    }
    if(kind==='descent'){
      // Mineral shelves recede toward the open water; transparent layers let
      // the existing depth-dependent water and light remain visible.
      for(let layer=0;layer<4;layer++){
        const base=430+layer*66;c.fillStyle=['#427a8030','#28585f60','#153c48a0','#0a2434ce'][layer];
        c.beginPath();c.moveTo(0,700);for(let x=0;x<=1010;x+=10){const ridge=Math.sin(x*.007+layer*2)*47+Math.sin(x*.027+layer)*12;c.lineTo(x,base+ridge);}c.lineTo(1000,700);c.fill();
      }
      // A distant stone arch opens onto lighter water.
      c.save();c.strokeStyle='#244d5b70';c.lineWidth=44;c.beginPath();c.moveTo(660,566);c.bezierCurveTo(600,250,930,240,920,565);c.stroke();c.strokeStyle='#5d919e28';c.lineWidth=4;c.beginPath();c.moveTo(648,515);c.bezierCurveTo(630,280,901,255,928,518);c.stroke();c.restore();
      for(let i=0;i<90;i++){const x=rnd()*1000,y=560+rnd()*160;rock(c,x,y,3+rnd()*25,rnd,'water');}
      for(let i=0;i<14;i++){const x=i<7?rnd()*260:800+rnd()*200;coral(c,x,650+rnd()*50,40+rnd()*100,rnd);}
      for(let i=0;i<20;i++)fern(c,i<10?rnd()*160:850+rnd()*150,730,100+rnd()*170,(rnd()-.5)*.6,'#123f43aa');
      for(let i=0;i<120;i++){const x=rnd()*1000,y=530+rnd()*170;c.fillStyle='#89c6c820';c.fillRect(x,y,1.5,.6);}
    }
    if(kind==='resonance'){
      for(let i=0;i<46;i++){
        const x=i*24,y=270+Math.sin(i*.095)*95;c.save();c.translate(x,y);c.rotate(-.45);
        glow(c,0,0,65+rnd()*70,i%2?'#709ed215':'#aa78a815');c.restore();
      }
      // Fine-scale stars sit behind the existing moving stars and breathing light.
      for(let i=0;i<70;i++){const x=i*16,y=340+Math.sin(i*.045)*100;glow(c,x,y,70+rnd()*140,i%2?'#5572aa0b':'#aa79970b');}
      for(let i=0;i<650;i++){const x=rnd()*1000,y=rnd()*700,r=.2+Math.pow(rnd(),5)*1.2;c.fillStyle=`rgba(199,216,238,${.12+rnd()*.36})`;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();if(r>1.1)glow(c,x,y,6,'#c6dbff19');}
      // Fine nested arcs lend the central light a sense of physical volume.
      c.strokeStyle='#c2d5f00a';c.lineWidth=.7;for(let i=0;i<12;i++){c.beginPath();c.ellipse(500,350,150+i*9,150+i*9,0,0,Math.PI*2);c.stroke();}
    }
    // Subtle, deterministic surface grain removes perfectly flat digital fills.
    if(kind!=="resonance")for(let i=0;i<16000;i++){
      const x=rnd()*1000,y=rnd()*700;
      c.fillStyle=i%2?'rgba(200,225,203,.026)':'rgba(0,9,16,.035)';c.fillRect(x,y,.35+rnd()*.8,.35+rnd()*.6);
    }
    return canvas;
  }
  function paint(ctx,kind,options={}){
    if(App.simple)return;
    const {W,H}=G,key=kind+':'+W+':'+H;
    if(!cache.has(key)){if(cache.size>4)cache.clear();cache.set(key,build(kind,W,H));}
    ctx.save();
    if(kind==='weather'){
      const y=options.horizon-H*.14;ctx.globalAlpha=.7;ctx.drawImage(cache.get(key),0,y,W,H*.75);
      ctx.globalAlpha=1;const time=REDUCED?0:G.t;
      for(let i=0;i<32;i++){const f=i/32,y=options.horizon+Math.pow(f,1.7)*(H-options.horizon);ctx.strokeStyle=`rgba(190,215,212,${.024+options.calm*.022})`;ctx.lineWidth=.5+f;ctx.beginPath();for(let x=0;x<=W+20;x+=25)ctx.lineTo(x,y+Math.sin(x*.014+time*.22+i*2)*f*2);ctx.stroke();}
    }else{
      ctx.globalAlpha=kind==='descent'?.75-options.depth*.25:1;ctx.drawImage(cache.get(key),0,0,W,H);
    }
    ctx.restore();
    atmosphere(ctx,kind,options);
  }
  function atmosphere(ctx,kind,options){
    const {W,H}=G,t=REDUCED?0:G.t;
    ctx.save();
    if(kind==='garden'||kind==='weather'){
      ctx.globalCompositeOperation='screen';
      const horizon=kind==='garden'?H*.55:options.horizon;
      for(let layer=0;layer<2;layer++){
        const tw=W*1.3,offset=(t*(layer?1.3:2.1))%tw;
        ctx.globalAlpha=kind==='garden'?.20-layer*.045:.12;
        for(let tile=0;tile<2;tile++)ctx.drawImage(mist(),-offset+tile*tw,horizon-H*(.13-layer*.08),tw,H*.24);
      }
      if(kind==='garden'){
        // Broad feathered shafts, without sharp triangular edges.
        ctx.globalAlpha=1;
        for(let j=0;j<4;j++){
          ctx.save();ctx.translate(W*.675,H*.214);ctx.rotate(-.18+j*.13+Math.sin(t*.025)*.015);
          const w=W*(.018+j*.003),g=ctx.createLinearGradient(-w,0,w,0);g.addColorStop(0,'#ccebd000');g.addColorStop(.5,'#ccebd009');g.addColorStop(1,'#ccebd000');ctx.fillStyle=g;ctx.fillRect(-w,0,w*2,H*.7);ctx.restore();
        }
      }
    }
    if(kind==='descent'){
      ctx.globalCompositeOperation='screen';
      // Intersecting light filaments imply caustics over the stone shelves.
      const n=Math.round(14*Math.max(.4,Math.min(1,G.quality)));
      ctx.strokeStyle=`rgba(135,221,222,${.04*(1-(options.depth||0)*.6)})`;ctx.lineWidth=.8;
      for(let j=0;j<n;j++){ctx.beginPath();for(let x=0;x<W+20;x+=18){const y=H*(.64+j*.022)+Math.sin(x*.012+j*1.2+t*.15)*9+Math.sin(x*.025-j+t*.09)*4;ctx.lineTo(x,y);}ctx.stroke();}
    }
    if(kind==='resonance'){
      ctx.globalCompositeOperation='screen';
      for(let layer=0;layer<2;layer++){
        ctx.save();ctx.translate(W*.5,H*.35);ctx.rotate(-.25+Math.sin(t*.012)*.035);ctx.globalAlpha=.11;
        ctx.drawImage(mist(),-W*.65,-H*.17+layer*H*.08,W*1.3,H*.38);ctx.restore();
      }
    }
    ctx.restore();
  }
  function rayGeometry(sunY,horizon,height,time=0){
    const rise=Math.max(0,Math.min(1,(horizon-sunY)/Math.max(1,height*.25)));
    const lift=rise*rise*(3-2*rise);
    return Array.from({length:16},(_,i)=>{
      const angle=i/16*Math.PI*2+.12+Math.sin(time*.018+i*1.7)*.012;
      const down=(Math.sin(angle)+1)/2;
      // Near the horizon light escapes upward; as the sun rises its downward
      // shafts become dominant. Never rotate a rigid fan through the scene.
      const weight=mix(1-down, .24+down*.76,lift);
      return {angle,weight,width:.016+.012*(.5+.5*Math.sin(i*2.71))};
    });
  }
  function sunRays(c,{sunX,sunY,horizon,width,height,strength,time=0}){
    const length=Math.max(width,height)*1.05;
    c.save();c.beginPath();c.rect(0,0,width,horizon);c.clip();c.globalCompositeOperation='screen';
    const fade=c.createRadialGradient(sunX,sunY,0,sunX,sunY,length);
    fade.addColorStop(0,'rgba(255,239,207,.19)');fade.addColorStop(.2,'rgba(255,230,185,.075)');fade.addColorStop(.65,'rgba(255,222,176,.022)');fade.addColorStop(1,'rgba(255,220,175,0)');c.fillStyle=fade;
    for(const ray of rayGeometry(sunY,horizon,height,time)){
      // Overlapping low-opacity wedges feather the angular edges.
      for(let pass=0;pass<5;pass++){
        const spread=ray.width*(1+pass*.48);c.globalAlpha=strength*ray.weight*.23;
        c.beginPath();c.moveTo(sunX,sunY);c.lineTo(sunX+Math.cos(ray.angle-spread)*length,sunY+Math.sin(ray.angle-spread)*length);c.lineTo(sunX+Math.cos(ray.angle+spread)*length,sunY+Math.sin(ray.angle+spread)*length);c.closePath();c.fill();
      }
    }
    c.restore();
  }
  return {paint,sunRays,rayGeometry};
})();
