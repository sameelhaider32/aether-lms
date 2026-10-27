/* Original particle-torus scene inspired by GetLayers Vesper / Particle Forms.
   3D coordinates and rotations evaluated on the GPU; no remote assets. */
(() => {
  "use strict";
  const requestAnimationFrame=globalThis.AetherMotion?.request||window.requestAnimationFrame.bind(window);
  const cancelAnimationFrame=globalThis.AetherMotion?.cancel||window.cancelAnimationFrame.bind(window);
  const coarse=matchMedia('(pointer: coarse)');
  const tier=()=>{const low=coarse.matches||navigator.connection?.saveData||(navigator.deviceMemory||8)<=2;return low?{count:3200,dpr:1,interval:50}:innerWidth<1280?{count:7200,dpr:1.25,interval:31}:{count:14500,dpr:1.5,interval:15};};
  const VERT = `
    precision highp float;
    attribute vec3 aParticle;
    uniform vec2 uViewport;
    uniform vec2 uPointer;
    uniform float uTime;
    uniform float uHover;
    uniform float uStill;
    varying float vLight;
    varying float vStar;
    varying float vHover;
    varying vec3 vColor;
    const float TAU = 6.28318530718;
    void main() {
      float a = aParticle.x * TAU;
      float b = aParticle.y * TAU;
      float seed = aParticle.z;
      float t = uTime;
      float twist = .10 * sin(a*7.0+t*.62)+.07*sin(a*13.0-t*.38);
      float band = 1.10 + twist;
      float tube = .46 + .08*sin(a*3.0 + b*2.0+t*.31);
      float fold = b + a*.5;
      vec3 p = vec3((band+tube*cos(fold))*cos(a), (band+tube*cos(fold))*sin(a), tube*sin(fold)+.22*sin(a*3.0-t*.23));
      float rz = .25 + t*.10;
      mat2 r = mat2(cos(rz),-sin(rz),sin(rz),cos(rz));
      p.xy = r*p.xy;
      float rx = .84 + .08*sin(t*.31) - (uPointer.y-.5)*.25;
      p.yz = mat2(cos(rx),-sin(rx),sin(rx),cos(rx))*p.yz;
      float ry = .33 + (uPointer.x-.5)*.55;
      p.xz = mat2(cos(ry),sin(ry),-sin(ry),cos(ry))*p.xz;
      float perspective = 3.65 / (3.65 + p.z);
      p.xy *= perspective;
      float aspect = uViewport.x / max(1.,uViewport.y);
      vec2 ndc = vec2(.46 + p.x * .60 / aspect, p.y * .60);
      float dist = length(vec2((ndc.x-uPointer.x*2.+1.)*aspect, ndc.y-(1.-uPointer.y*2.)));
      float hit = uHover * exp(-pow(dist*4.1,2.0));
      ndc += normalize(ndc-vec2(uPointer.x*2.-1.,1.-uPointer.y*2.)+vec2(.0001)) * hit * .017;
      gl_Position = vec4(ndc, 0., 1.);
      float spec = pow(max(0., p.z*.34+.65),2.5);
      float flicker = .60 + .4*sin(seed*102. + t*2.0);
      vLight = .36 + .65*spec + .22*flicker;
      vStar = step(.977, seed);
      vHover = hit;
      vec3 sea = vec3(.01,.75,.84);
      vec3 ice = vec3(.76,.99,.94);
      vec3 warm = vec3(.61,.97,.84);
      vColor = mix(sea,ice,clamp(.30 + sin(a*2.0+b)*.26+spec*.36,0.,1.));
      vColor = mix(vColor,warm,step(.946,seed)*.54);
      vColor = mix(vColor,vec3(1.),hit*.84);
      gl_PointSize = min(10., (1.2 + 2.4*spec + 3.4*hit + vStar*1.5)*min(1.65,uViewport.y/420.));
    }`;
  const FRAG = `
    precision highp float;
    varying float vLight;
    varying float vStar;
    varying float vHover;
    varying vec3 vColor;
    void main() {
      vec2 c = gl_PointCoord - .5;
      float radius = length(c);
      float disc = 1.0 - smoothstep(.10,.49,radius);
      float glow = exp(-radius*radius*18.)*.35;
      float cross = exp(-abs(c.x)*41.)*exp(-abs(c.y)*5.) + exp(-abs(c.y)*41.)*exp(-abs(c.x)*5.);
      float shine = vStar*(cross*.28 + exp(-radius*radius*35.)*.8);
      float alpha = (disc*.84 + glow + shine)*(vLight + vHover*.65);
      gl_FragColor = vec4(vColor*(.84 + vStar*.25 + vHover*.8), min(.93,alpha));
    }`;

  function compile(gl, kind, code) {
    const shader = gl.createShader(kind);
    if (!shader) throw new Error("shader allocation failed");
    gl.shaderSource(shader, code); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader); gl.deleteShader(shader);
      throw new Error(error || "shader compile failed");
    }
    return shader;
  }
  function create2DFallback(canvas, opts = {}) {
    const ctx=canvas.getContext("2d",{alpha:true});
    if(!ctx)return {setMotion(){},dispose(){}};
    const parent=canvas.closest(".ae-hero, .ae-global-ambient");
    let active=false,disposed=false,raf=0,last=0,time=0,motion=opts.motion!==false;
    let pointer={x:.78,y:.5},hover=false;
    const N=opts.preview?720:tier().count>7200?2400:1000;
    const points=Array.from({length:N},(_,i)=>({
      a:(i+.13)/N*6.28318530718,
      b:((i*.61803398875)%1)*6.28318530718,
      sparkle:i%73===0
    }));
    function draw(now=0){
      if(disposed)return;
      const box=canvas.getBoundingClientRect();if(!box.width||!box.height)return;
      const ratio=Math.min(devicePixelRatio||1,1.4);
      const w=Math.round(box.width*ratio),h=Math.round(box.height*ratio);
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      const aspect=w/h;
      ctx.clearRect(0,0,w,h);ctx.globalCompositeOperation="lighter";
      const cx=w*.73,cy=h*.5,scale=h*.32;
      const rz=.25+time*.10,rx=.86+(pointer.y-.5)*-.23,ry=.33+(pointer.x-.5)*.60;
      const crz=Math.cos(rz),srz=Math.sin(rz),crx=Math.cos(rx),srx=Math.sin(rx),cry=Math.cos(ry),sry=Math.sin(ry);
      const projected=[];
      for(const p of points){
        const a=p.a,b=p.b;
        const ring=1.10+.1*Math.sin(a*7+time*.62)+.07*Math.sin(a*13-time*.38);
        const tube=.46+.08*Math.sin(a*3+b*2+time*.31),fold=b+a*.5;
        let x=(ring+tube*Math.cos(fold))*Math.cos(a);
        let y=(ring+tube*Math.cos(fold))*Math.sin(a);
        let z=tube*Math.sin(fold)+.22*Math.sin(a*3-time*.23);
        [x,y]=[crz*x-srz*y,srz*x+crz*y];
        [y,z]=[crx*y-srx*z,srx*y+crx*z];
        [x,z]=[cry*x+sry*z,-sry*x+cry*z];
        const depth=3.65/(3.65+z),sx=cx+x*scale*depth,sy=cy+y*scale*depth;
        const d=Math.hypot((sx/w-pointer.x)*aspect,sy/h-pointer.y);
        const hit=hover?Math.exp(-((d*11)**2)):0;
        projected.push({sx,sy,z,r:(.65+Math.max(0,z+1)*.85+hit*2.2)*ratio,hit,sparkle:p.sparkle});
      }
      // Far points first keeps the shape dimensional even without GPU blending.
      projected.sort((a,b)=>a.z-b.z);
      for(const p of projected){
        const light=Math.min(1,Math.max(.24,(p.z+1.6)/2.8));
        ctx.fillStyle=p.sparkle||p.hit>.25?`rgba(230,255,236,${Math.min(1,.45+light*.4+p.hit)})`
          :`rgba(${Math.round(43+85*light)},${Math.round(170+80*light)},${Math.round(139+65*light)},${.22+light*.5})`;
        ctx.beginPath();ctx.arc(p.sx,p.sy,p.r,0,6.2831853);ctx.fill();
        if((p.sparkle&&light>.5)||p.hit>.57){
          ctx.strokeStyle=`rgba(205,255,224,${.28+light*.32+p.hit*.28})`;ctx.lineWidth=.65*ratio;
          ctx.beginPath();ctx.moveTo(p.sx-p.r*4,p.sy);ctx.lineTo(p.sx+p.r*4,p.sy);ctx.moveTo(p.sx,p.sy-p.r*4);ctx.lineTo(p.sx,p.sy+p.r*4);ctx.stroke();
        }
      }
      ctx.globalCompositeOperation="source-over";
      if(!canvas.dataset.aeRendered)canvas.dataset.aeRendered='2d';
    }
    function tick(now){raf=0;if(!active||disposed)return;if(now-last>=40){time+=(last?Math.min((now-last)/1000,.08):0);last=now;draw(now);}raf=requestAnimationFrame(tick);}
    let visible=true;
    function update(){const run=motion&&visible&&!document.hidden&&!disposed;if(run&&!active){active=true;last=0;raf=requestAnimationFrame(tick);}else if(!run&&active){active=false;cancelAnimationFrame(raf);draw();}}
    function move(e){if(!motion||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const r=canvas.getBoundingClientRect();pointer={x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};hover=true;if(!active)draw();}
    function leave(){hover=false;if(!active)draw();}
    const ro=typeof ResizeObserver!=="undefined"?new ResizeObserver(()=>{if(!active)draw();}):null;ro?.observe(canvas);
    const io=typeof IntersectionObserver!=='undefined'?new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;update();}):null;io?.observe(canvas);
    parent?.addEventListener("pointermove",move,{passive:true});parent?.addEventListener("pointerleave",leave,{passive:true});
    document.addEventListener("visibilitychange",update);
    draw();update();
    return {setMotion(v){motion=!!v;update();},dispose(){disposed=true;active=false;cancelAnimationFrame(raf);ro?.disconnect();io?.disconnect();document.removeEventListener("visibilitychange",update);parent?.removeEventListener("pointermove",move);parent?.removeEventListener("pointerleave",leave);}};
  }

  function create(canvas, opts = {}) {
    let disposed = false, active = false, visible = true, motion = opts.motion !== false;
    let raf = 0, last = 0, elapsed = 0, lastElapsed = 0;
    let hover = 0, hoverTarget = 0;
    let pointer = { x: .78, y: .54 };
    const fallback = { setMotion() {}, dispose() {} };
    let gl, program, buffer, ro, io;
    try {
      gl = canvas.getContext("webgl", {alpha:true, antialias:false, preserveDrawingBuffer:false, powerPreference:"low-power"});
      if (!gl) return create2DFallback(canvas,opts);
      const vs = compile(gl,gl.VERTEX_SHADER,VERT), fs = compile(gl,gl.FRAGMENT_SHADER,FRAG);
      program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
      gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
      let seed=7331;
      const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
      const count=tier().count;const particles=new Float32Array(count*3);
      for(let i=0;i<count;i++){
        particles[3*i]=(i+.32*rnd())/count;
        particles[3*i+1]=(i*.61803398875+rnd()*.03)%1;
        particles[3*i+2]=rnd();
      }
      buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,particles,gl.STATIC_DRAW);
      gl.useProgram(program);
      const attr=gl.getAttribLocation(program,"aParticle");
      gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,3,gl.FLOAT,false,0,0);
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
      const uniforms={viewport:gl.getUniformLocation(program,"uViewport"),pointer:gl.getUniformLocation(program,"uPointer"),time:gl.getUniformLocation(program,"uTime"),hover:gl.getUniformLocation(program,"uHover")};
      function resize() {
        if(disposed)return;
        const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;
        const ratio=Math.min(devicePixelRatio||1,tier().dpr);
        const scale=Math.min(1,1180/(r.width*ratio));
        const w=Math.max(1,Math.round(r.width*ratio*scale));
        const h=Math.max(1,Math.round(r.height*ratio*scale));
        if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
        gl.viewport(0,0,w,h);
      }
      function render(now) {
        raf=0;if(disposed||!active||gl.isContextLost())return;
        if(now-last<tier().interval){raf=requestAnimationFrame(render);return;}
        elapsed+=last?Math.min((now-last)/1000,.08):0;last=now;
        hover+=(hoverTarget-hover)*.17;
        resize();gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(uniforms.viewport,canvas.width,canvas.height);
        gl.uniform2f(uniforms.pointer,pointer.x,pointer.y);
        gl.uniform1f(uniforms.time,elapsed);
        gl.uniform1f(uniforms.hover,hover);
        gl.drawArrays(gl.POINTS,0,Math.min(count,tier().count));
        raf=requestAnimationFrame(render);
      }
      function drawStill(){if(disposed||gl.isContextLost())return;resize();gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.uniform2f(uniforms.viewport,canvas.width,canvas.height);gl.uniform2f(uniforms.pointer,pointer.x,pointer.y);gl.uniform1f(uniforms.time,elapsed);gl.uniform1f(uniforms.hover,0);gl.drawArrays(gl.POINTS,0,Math.min(count,tier().count));if(!canvas.dataset.aeRendered)canvas.dataset.aeRendered='webgl';}
      function schedule(){const next=motion&&visible&&!document.hidden&&!disposed&&!gl.isContextLost();if(next&&!active){active=true;last=0;raf=requestAnimationFrame(render);} else if(!next&&active){active=false;cancelAnimationFrame(raf);raf=0;drawStill();}}
      const hero=canvas.closest(".ae-hero, .ae-global-ambient");
      function onPointer(e){if(!motion||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const r=canvas.getBoundingClientRect();pointer={x:Math.min(1,Math.max(0,(e.clientX-r.left)/Math.max(1,r.width))),y:Math.min(1,Math.max(0,(e.clientY-r.top)/Math.max(1,r.height)))};hoverTarget=1;if(!active)drawStill();}
      function leave(){hoverTarget=0;}
      const onVisible=()=>schedule();
      let portable=null;
      const onContextLost=e=>{e.preventDefault();active=false;cancelAnimationFrame(raf);if(portable)return;const replacement=document.createElement('canvas');replacement.className=canvas.className;replacement.setAttribute('aria-hidden','true');canvas.after(replacement);canvas.style.visibility='hidden';const alt=create2DFallback(replacement,{motion});portable={setMotion:v=>alt.setMotion(v),dispose(){alt.dispose();replacement.remove();canvas.style.removeProperty('visibility');}};};
      canvas.addEventListener("webglcontextlost",onContextLost);
      hero?.addEventListener("pointermove",onPointer,{passive:true});hero?.addEventListener("pointerleave",leave,{passive:true});
      document.addEventListener("visibilitychange",onVisible);
      io=typeof IntersectionObserver!=="undefined"?new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;schedule();},{threshold:.03}):null;
      io?.observe(canvas);
      ro=typeof ResizeObserver!=="undefined"?new ResizeObserver(()=>{if(!active)drawStill();}):null;
      ro?.observe(canvas);
      drawStill();schedule();
      return {
        setMotion(v){motion=Boolean(v);if(portable)portable.setMotion(v);else schedule();},
        dispose(){if(disposed)return;disposed=true;active=false;cancelAnimationFrame(raf);portable?.dispose();ro?.disconnect();io?.disconnect();document.removeEventListener("visibilitychange",onVisible);hero?.removeEventListener("pointermove",onPointer);hero?.removeEventListener("pointerleave",leave);canvas.removeEventListener("webglcontextlost",onContextLost);gl.deleteBuffer(buffer);gl.deleteProgram(program);}
      };
    } catch(err) {
      console.warn("Aether: using portable canvas particle scene",err.message);
      if(gl&&buffer)gl.deleteBuffer(buffer);
      if(gl&&program)gl.deleteProgram(program);
      // Once a WebGL context exists, browsers won't allow a 2D context on the
      // same canvas. Attach a lightweight 2D substitute in that case.
      const substitute=document.createElement("canvas");
      substitute.className=canvas.className;
      substitute.setAttribute("aria-hidden","true");
      canvas.after(substitute);
      canvas.style.visibility="hidden";
      const alternative=create2DFallback(substitute,opts);
      return {setMotion:v=>alternative.setMotion(v),dispose(){alternative.dispose();substitute.remove();canvas.style.removeProperty("visibility");}};
    }
  }
  function prime(canvas){
    const preview=document.createElement('canvas');preview.className=canvas.className+' ae-scene-first-frame';preview.setAttribute('aria-hidden','true');canvas.before(preview);
    const still=create2DFallback(preview,{motion:false,preview:true});
    return {dispose(){still.dispose();preview.remove();}};
  }
  globalThis.AetherLivingScene={create,prime};
})();
