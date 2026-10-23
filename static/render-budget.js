/* Keep frame pacing separate from orbital data and the original 3D geometry. */
(function(root){
 function create({width=1280,height=720,devicePixelRatio=1,apply}){
  let dpr=Math.max(.5,devicePixelRatio||1),maximum=Math.min(1.5,dpr),minimum=Math.min(.55,maximum);
  let ratio=Math.max(minimum,Math.min(maximum,1,Math.sqrt(2400000/Math.max(1,width*height))));
  let last=null,samples=[],lastChange=0,good=0,frameMs=0,changes=0,area=width*height;
  const publish=()=>apply({pixelRatio:ratio,resolutionScale:ratio/dpr});publish();
  return {
   reset(){last=null;samples.length=0;good=0;},
   resize(w,h,pixelRatio=dpr){const next=Math.max(.5,pixelRatio||1),newArea=Math.max(1,w*h);maximum=Math.min(1.5,next);minimum=Math.min(.55,maximum);let value=Math.max(minimum,Math.min(maximum,ratio));if(newArea>area*1.25)value=Math.min(value,Math.max(minimum,Math.sqrt(2400000/newArea)));const changed=next!==dpr||value!==ratio;dpr=next;ratio=value;area=newArea;this.reset();if(changed)publish();},
   sample(time,continuous){
    if(!continuous||!Number.isFinite(time)){last=null;samples.length=0;return;}
    const previous=last;last=time;if(previous===null)return;
    const dt=time-previous;if(dt<3||dt>250){samples.length=0;return;}
    samples.push(dt);if(samples.length<20||time-lastChange<650)return;
    const sorted=samples.slice().sort((a,b)=>a-b);frameMs=sorted[Math.floor(sorted.length*.75)];samples.length=0;lastChange=time;
    let next=ratio;
    if(frameMs>19.5){good=0;next=Math.max(minimum,ratio*(frameMs>29?.75:.87));}
    else if(frameMs<17.8){if(++good>=5){next=Math.min(maximum,ratio+.08);good=0;}}
    else good=0;
    if(Math.abs(next-ratio)>.005){ratio=next;changes++;publish();}
   },
   get stats(){return {pixelRatio:ratio,frameMs,estimatedFps:frameMs?1000/frameMs:null,changes};}
  };
 }
 const api={create};if(typeof module==='object'&&module.exports)module.exports=api;else root.AtlasRenderBudget=api;
})(typeof window==='undefined'?globalThis:window);
