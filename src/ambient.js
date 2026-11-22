/* Page-wide starfield, cursor-lit sparkles and quiet computational contours.
   Every star is a pre-rendered sprite (no per-frame paths, gradients or colour strings), the
   contour field is rebuilt a few times a second into its own layer, and the pointer is eased in
   real time so parallax stays smooth at display rate. */
(() => {
 'use strict';
 globalThis.AetherAmbient={create(canvas,{motion=true}={}){
  const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)return {setMotion(){},dispose(){}};
  const engine=globalThis.AetherMotion,reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let stop=null,disposed=false,width=0,height=0,dpr=1,time=0,pointer={x:.5,y:.5},target={x:.5,y:.5},hover=0,hoverTarget=0;
  let lastPaint=0,contourAge=Infinity,contourPointer={x:-1,y:-1},resizeFrame=0;
  const low=matchMedia('(pointer: coarse)').matches||navigator.connection?.saveData||(navigator.deviceMemory||8)<=2;
  let points=[];
  const sprite=(size,paint)=>{const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');if(g)paint(g,size);return c;};
  // Halo, core and cross are each baked once; a star is two or three drawImage calls.
  const halo=sprite(64,(g,s)=>{const l=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);l.addColorStop(0,'rgba(215,255,247,.95)');l.addColorStop(.12,'rgba(157,248,214,.55)');l.addColorStop(.38,'rgba(2,210,227,.18)');l.addColorStop(1,'rgba(2,210,227,0)');g.fillStyle=l;g.fillRect(0,0,s,s);});
  const core=sprite(16,(g,s)=>{const l=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);l.addColorStop(0,'rgba(193,255,237,1)');l.addColorStop(.55,'rgba(193,255,237,.95)');l.addColorStop(1,'rgba(193,255,237,0)');g.fillStyle=l;g.fillRect(0,0,s,s);});
  const cross=sprite(64,(g,s)=>{g.strokeStyle='rgba(220,255,249,1)';g.lineWidth=3.2;g.lineCap='round';g.beginPath();g.moveTo(4,s/2);g.lineTo(s-4,s/2);g.moveTo(s/2,4);g.lineTo(s/2,s-4);g.stroke();});
  const layer=document.createElement('canvas'),layerCtx=layer.getContext('2d',{alpha:true});
  const cols=low?30:54;let rows=20,values=new Float32Array(1);
  const segments=[[],[[3,2]],[[2,1]],[[3,1]],[[0,1]],[[3,0],[2,1]],[[0,2]],[[3,0]],[[3,0]],[[0,2]],[[3,2],[0,1]],[[0,1]],[[3,1]],[[2,1]],[[3,2]],[]];
  function contours(){
   if(!layerCtx)return;
   const g=layerCtx,stepX=width/cols,stepY=height/rows,aspect=width/Math.max(1,height),t=time*.12;
   for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const x=(i/cols*2-1)*aspect*3.8,y=(j/rows*2-1)*3.8,near=Math.exp(-((i/cols-pointer.x)**2+(j/rows-pointer.y)**2)*24);
    values[j*(cols+1)+i]=(.5+Math.sin(x+t)*.25+Math.sin(y*.85-t*.7)*.225+Math.sin((x+y)*.65+t*.5)*.175+Math.sin((x-y)*.95-t*.8)*.125+near*.12)*4;
   }
   g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,width,height);
   g.beginPath();g.lineWidth=.65;g.strokeStyle='rgba(111,184,190,.18)';
   for(let level=.5;level<4;level++)for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const a=values[j*(cols+1)+i],b=values[j*(cols+1)+i+1],c=values[(j+1)*(cols+1)+i+1],d=values[(j+1)*(cols+1)+i];
    const index=(a>level?8:0)|(b>level?4:0)|(c>level?2:0)|(d>level?1:0);if(!segments[index].length)continue;
    const x=i*stepX,y=j*stepY,lerp=(u,v)=>Math.abs(v-u)>1e-9?Math.max(0,Math.min(1,(level-u)/(v-u))):.5;
    const edges=[[x+stepX*lerp(a,b),y],[x+stepX,y+stepY*lerp(b,c)],[x+stepX*lerp(d,c),y+stepY],[x,y+stepY*lerp(a,d)]];
    for(const [p,q]of segments[index]){g.moveTo(edges[p][0],edges[p][1]);g.lineTo(edges[q][0],edges[q][1]);}
   }g.stroke();
   contourAge=0;contourPointer={x:pointer.x,y:pointer.y};
  }
  function draw(){if(disposed||!width)return;
   // The field drifts at .12 rad/s, so rebuilding it ~6 times a second is visually continuous.
   if(contourAge>.16||Math.abs(contourPointer.x-pointer.x)+Math.abs(contourPointer.y-pointer.y)>.04)contours();
   ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
   if(layerCtx)ctx.drawImage(layer,0,0);
   ctx.setTransform(dpr,0,0,dpr,0,0);
   const px=pointer.x*width,py=pointer.y*height,ox=(pointer.x-.5)*20,oy=(pointer.y-.5)*16;
   for(let i=0;i<points.length;i++){
    const p=points[i],x=(p.x*width+ox*p.z+Math.sin(time*.13+i)*4+width)%width,y=(p.y*height+oy*p.z+Math.cos(time*.1+i)*4+height)%height;
    const dx=x-px,dy=y-py,reach=145+p.z*65;
    let near=0;if(hover>.001&&dx*dx+dy*dy<reach*reach){const proximity=1-Math.sqrt(dx*dx+dy*dy)/reach;near=proximity*proximity*hover;}
    const twinkle=.86+.14*Math.sin(time*(.48+p.z*.3)+i*1.73);
    if(i%4===0||near>.05){
      const size=(i%13===0?30:18)+p.z*14+near*42;
      ctx.globalAlpha=Math.min(.9,(.22+p.z*.17+near*.65)*twinkle);
      ctx.drawImage(halo,x-size/2,y-size/2,size,size);
    }
    const r=(.65+p.z*.8+near*1.4)*2.1;
    ctx.globalAlpha=Math.min(1,(.34+p.z*.39+near*.5)*twinkle);
    ctx.drawImage(core,x-r/2,y-r/2,r,r);
    if(i%13===0||near>.5){
      const arm=(4+p.z*3+near*7)*2.3;
      ctx.globalAlpha=Math.min(.95,ctx.globalAlpha*.7+near*.25);
      ctx.drawImage(cross,x-arm/2,y-arm/2,arm,arm);
    }
   }
   ctx.globalAlpha=1;
   if(!canvas.dataset.aeRendered)canvas.dataset.aeRendered='2d';
  }
  function resize(){resizeFrame=0;width=innerWidth;height=innerHeight;rows=Math.max(8,Math.round(cols*height/Math.max(1,width)));values=new Float32Array((cols+1)*(rows+1));
   const count=Math.round(Math.max(low?60:140,Math.min(low?120:360,width*height/(low?7500:5200))));
   points=Array.from({length:count},(_,i)=>({x:(i*.61803398875+.13)%1,y:(i*.754877666+.27)%1,z:.2+(i%7)/9}));
   dpr=Math.min(devicePixelRatio||1,low?1:1.25);canvas.width=layer.width=Math.round(width*dpr);canvas.height=layer.height=Math.round(height*dpr);contourAge=Infinity;draw();}
  function queueResize(){if(!resizeFrame)resizeFrame=requestAnimationFrame(resize);}
  function schedule(){stop?.();stop=null;if(!motion||reduced.matches){hover=hoverTarget=0;pointer={...target};}contourAge=Infinity;draw();if(!motion||reduced.matches||document.hidden||disposed)return;
   lastPaint=0;
   stop=engine.subscribe((now,dt)=>{
    const s=dt/1000,ease=1-Math.exp(-Math.max(s,.008)*9);
    time+=s;contourAge+=s;
    pointer.x+=(target.x-pointer.x)*ease;pointer.y+=(target.y-pointer.y)*ease;hover+=(hoverTarget-hover)*ease;
    // Display rate while the pointer is settling; 30fps is enough for an idle twinkle.
    const settling=Math.abs(target.x-pointer.x)+Math.abs(target.y-pointer.y)>.0008||Math.abs(hoverTarget-hover)>.004;
    if(!settling&&now-lastPaint<(low?100:32))return;
    lastPaint=now;draw();
   },low?50:8);}
  function move(e){if(!motion||reduced.matches||low)return;target={x:e.clientX/Math.max(1,width),y:e.clientY/Math.max(1,height)};hoverTarget=1;}
  function leave(){hoverTarget=0;}
  function frameMove(e){if(e.origin!==location.origin||e.data?.type!=='aether-pointer-v051'||!motion||reduced.matches||low)return;const {x,y}=e.data;if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1||y<0||y>1)return;
   function find(win){for(const f of win.document.querySelectorAll('iframe')){try{if(f.contentWindow===e.source)return f;const nested=find(f.contentWindow);if(nested)return nested;}catch{}}}const f=find(window);if(!f)return;
   let px=x*f.clientWidth,py=y*f.clientHeight,node=f;while(node){const r=node.getBoundingClientRect();px+=r.left+node.clientLeft;py+=r.top+node.clientTop;const owner=node.ownerDocument.defaultView;if(owner===window)break;node=owner.frameElement;}target={x:px/width,y:py/height};hoverTarget=1;
  }
  document.addEventListener('pointermove',move,{passive:true});document.addEventListener('pointerleave',leave,{passive:true});window.addEventListener('message',frameMove);window.addEventListener('resize',queueResize);document.addEventListener('visibilitychange',schedule);reduced.addEventListener('change',schedule);resize();schedule();
  return {setMotion(v){motion=!!v;schedule();},dispose(){disposed=true;stop?.();cancelAnimationFrame(resizeFrame);document.removeEventListener('pointermove',move);document.removeEventListener('pointerleave',leave);window.removeEventListener('message',frameMove);window.removeEventListener('resize',queueResize);document.removeEventListener('visibilitychange',schedule);reduced.removeEventListener('change',schedule);ctx.clearRect(0,0,canvas.width,canvas.height);for(const c of [halo,core,cross,layer])c.width=c.height=0;}};
 }};
})();
