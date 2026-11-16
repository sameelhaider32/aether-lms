/* Page-wide starfield, cursor-lit sparkles and quiet computational contours. */
(() => {
 'use strict';
 globalThis.AetherAmbient={create(canvas,{motion=true}={}){
  const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)return {setMotion(){},dispose(){}};
  const engine=globalThis.AetherMotion,reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let stop=null,disposed=false,width=0,height=0,time=0,pointer={x:.5,y:.5},target={x:.5,y:.5},hover=0,hoverTarget=0;
  const low=matchMedia('(pointer: coarse)').matches||navigator.connection?.saveData||(navigator.deviceMemory||8)<=2;
  let points=[];
  // Bake the halo once instead of allocating gradients for every star/frame.
  const halo=document.createElement('canvas');halo.width=halo.height=64;
  const haloCtx=halo.getContext('2d');
  if(haloCtx){const light=haloCtx.createRadialGradient(32,32,0,32,32,32);light.addColorStop(0,'rgba(215,255,247,.95)');light.addColorStop(.12,'rgba(157,248,214,.55)');light.addColorStop(.38,'rgba(2,210,227,.18)');light.addColorStop(1,'rgba(2,210,227,0)');haloCtx.fillStyle=light;haloCtx.fillRect(0,0,64,64);}
  const cols=low?30:54;let rows=20,values=new Float32Array(1);
  const segments=[[],[[3,2]],[[2,1]],[[3,1]],[[0,1]],[[3,0],[2,1]],[[0,2]],[[3,0]],[[3,0]],[[0,2]],[[3,2],[0,1]],[[0,1]],[[3,1]],[[2,1]],[[3,2]],[]];
  function contours(){
   const stepX=width/cols,stepY=height/rows,aspect=width/Math.max(1,height),t=time*.12;
   for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const x=(i/cols*2-1)*aspect*3.8,y=(j/rows*2-1)*3.8,near=Math.exp(-((i/cols-pointer.x)**2+(j/rows-pointer.y)**2)*24);
    values[j*(cols+1)+i]=(.5+Math.sin(x+t)*.25+Math.sin(y*.85-t*.7)*.225+Math.sin((x+y)*.65+t*.5)*.175+Math.sin((x-y)*.95-t*.8)*.125+near*.12)*4;
   }
   ctx.beginPath();ctx.lineWidth=.65;ctx.strokeStyle='rgba(111,184,190,.18)';
   for(let level=.5;level<4;level++)for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const a=values[j*(cols+1)+i],b=values[j*(cols+1)+i+1],c=values[(j+1)*(cols+1)+i+1],d=values[(j+1)*(cols+1)+i];
    const index=(a>level?8:0)|(b>level?4:0)|(c>level?2:0)|(d>level?1:0);if(!segments[index].length)continue;
    const x=i*stepX,y=j*stepY,lerp=(u,v)=>Math.abs(v-u)>1e-9?Math.max(0,Math.min(1,(level-u)/(v-u))):.5;
    const edges=[[x+stepX*lerp(a,b),y],[x+stepX,y+stepY*lerp(b,c)],[x+stepX*lerp(d,c),y+stepY],[x,y+stepY*lerp(a,d)]];
    for(const [p,q]of segments[index]){ctx.moveTo(...edges[p]);ctx.lineTo(...edges[q]);}
   }ctx.stroke();
  }
  function draw(){if(disposed)return;ctx.clearRect(0,0,width,height);contours();
   for(let i=0;i<points.length;i++){
    const p=points[i],x=(p.x*width+(pointer.x-.5)*20*p.z+Math.sin(time*.13+i)*4+width)%width,y=(p.y*height+(pointer.y-.5)*16*p.z+Math.cos(time*.1+i)*4+height)%height;
    const proximity=Math.max(0,1-Math.hypot(x-pointer.x*width,y-pointer.y*height)/(145+p.z*65));
    const near=proximity*proximity*hover,twinkle=.86+.14*Math.sin(time*(.48+p.z*.3)+i*1.73);
    const alpha=Math.min(1,(.34+p.z*.39+near*.5)*twinkle),r=.65+p.z*.8+near*1.4;
    if(haloCtx&&(i%4===0||near>.05)){
      const size=(i%13===0?30:18)+p.z*14+near*42;
      ctx.globalAlpha=Math.min(.9,(.22+p.z*.17+near*.65)*twinkle);
      ctx.drawImage(halo,x-size/2,y-size/2,size,size);ctx.globalAlpha=1;
    }
    ctx.fillStyle=`rgba(193,255,237,${alpha})`;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
    if(i%13===0||near>.5){
      const arm=4+p.z*3+near*7;ctx.strokeStyle=`rgba(220,255,249,${Math.min(.95,alpha*.7+near*.25)})`;ctx.lineWidth=.7;
      ctx.beginPath();ctx.moveTo(x-arm,y);ctx.lineTo(x+arm,y);ctx.moveTo(x,y-arm);ctx.lineTo(x,y+arm);ctx.stroke();
    }
   }
   if(!canvas.dataset.aeRendered)canvas.dataset.aeRendered='2d';
  }
  function resize(){width=innerWidth;height=innerHeight;rows=Math.max(8,Math.round(cols*height/Math.max(1,width)));values=new Float32Array((cols+1)*(rows+1));
   const count=Math.round(Math.max(low?60:140,Math.min(low?120:360,width*height/(low?7500:5200))));
   points=Array.from({length:count},(_,i)=>({x:(i*.61803398875+.13)%1,y:(i*.754877666+.27)%1,z:.2+(i%7)/9}));
   const dpr=Math.min(devicePixelRatio||1,low?1:1.25);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw();}
  function schedule(){stop?.();stop=null;if(!motion||reduced.matches)hover=hoverTarget=0;draw();if(!motion||reduced.matches||document.hidden||disposed)return;stop=engine.subscribe((now,dt)=>{time+=dt/1000;pointer.x+=(target.x-pointer.x)*.13;pointer.y+=(target.y-pointer.y)*.13;hover+=(hoverTarget-hover)*.13;draw();},low?120:66);}
  function move(e){if(!motion||reduced.matches||low)return;target={x:e.clientX/Math.max(1,width),y:e.clientY/Math.max(1,height)};hoverTarget=1;}
  function leave(){hoverTarget=0;}
  function frameMove(e){if(e.origin!==location.origin||e.data?.type!=='aether-pointer-v051'||!motion||reduced.matches||low)return;const {x,y}=e.data;if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1||y<0||y>1)return;
   function find(win){for(const f of win.document.querySelectorAll('iframe')){try{if(f.contentWindow===e.source)return f;const nested=find(f.contentWindow);if(nested)return nested;}catch{}}}const f=find(window);if(!f)return;
   let px=x*f.clientWidth,py=y*f.clientHeight,node=f;while(node){const r=node.getBoundingClientRect();px+=r.left+node.clientLeft;py+=r.top+node.clientTop;const owner=node.ownerDocument.defaultView;if(owner===window)break;node=owner.frameElement;}target={x:px/width,y:py/height};hoverTarget=1;
  }
  document.addEventListener('pointermove',move,{passive:true});document.addEventListener('pointerleave',leave,{passive:true});window.addEventListener('message',frameMove);window.addEventListener('resize',resize);document.addEventListener('visibilitychange',schedule);reduced.addEventListener('change',schedule);resize();schedule();
  return {setMotion(v){motion=!!v;schedule();},dispose(){disposed=true;stop?.();document.removeEventListener('pointermove',move);document.removeEventListener('pointerleave',leave);window.removeEventListener('message',frameMove);window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',schedule);reduced.removeEventListener('change',schedule);ctx.clearRect(0,0,width,height);halo.width=halo.height=0;}};
 }};
})();
