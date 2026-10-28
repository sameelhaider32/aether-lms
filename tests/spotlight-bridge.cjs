/* Focused keyboard regression: legacy/synthetic Sakai events may omit key. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const handlers=new Map(),focus={},state={enabled:true,editing:false,assessment:false,modal:false,opens:0};
const document={activeElement:focus,designMode:'off',documentElement:{classList:{contains:()=>state.enabled}},addEventListener:(name,fn)=>handlers.set(name,fn),querySelector:s=>s==='.header-tool-title'?{textContent:state.assessment?'Quiz':'Resources'}:null,querySelectorAll:()=>state.modal?[{id:'native-modal',getClientRects:()=>[{}]}]:[]};
const window={location:{origin:'https://lms.lums.edu.pk',pathname:'//portal'},document,addEventListener(){},AetherSpotlight:{open:({trigger})=>{assert.equal(trigger,focus);state.opens++;return true;}}};
const box={window,top:window,document,getComputedStyle:()=>({visibility:'visible'})};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/spotlight-bridge.js'),'utf8'),box);
const send=extra=>{const event={key:'k',ctrlKey:true,target:{closest:()=>state.editing},preventDefault(){this.defaultPrevented=true;},...extra};handlers.get('keydown')(event);return event;};
for(const key of [undefined,null,75,{},''])assert.doesNotThrow(()=>send({key,keyCode:75,which:75}));
assert.equal(state.opens,0,'Missing/non-string keys must not trigger shortcuts');
assert.equal(send({key:'K'}).defaultPrevented,true);assert.equal(state.opens,1);
assert.equal(send({ctrlKey:false,metaKey:true}).defaultPrevented,true);
assert.equal(send({ctrlKey:false,altKey:true,shiftKey:true}).defaultPrevented,true);
const before=state.opens;
for(const extra of [{repeat:true},{defaultPrevented:true},{shiftKey:true},{ctrlKey:false},{key:'a'}])send(extra);
for(const flag of ['editing','assessment','modal']){state[flag]=true;send({});state[flag]=false;}
state.enabled=false;send({});assert.equal(state.opens,before);
console.log('PASS missing/non-string key events, supported chords, repeat/prevented/typing/assessment/modal/OFF guards');
