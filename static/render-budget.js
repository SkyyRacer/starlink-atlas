/* Stable pixel density: frame pacing never silently degrades image sharpness. */
(function(root){
 function create({width=1280,height=720,devicePixelRatio=1,apply}){
  let dpr=Math.max(1,devicePixelRatio||1),ratio=Math.min(2,dpr),detailed=false,last=null,samples=[],frameMs=0;
  const publish=()=>apply({pixelRatio:ratio,resolutionScale:ratio/dpr});publish();
  return {
   setDetailed(value){value=!!value;if(value===detailed)return;detailed=value;this.reset();},
   reset(){last=null;samples.length=0;},
   resize(w,h,pixelRatio=dpr){const next=Math.max(1,pixelRatio||1),value=Math.min(2,next),changed=next!==dpr||value!==ratio;dpr=next;ratio=value;this.reset();if(changed)publish();},
   sample(time,continuous){
    if(!continuous||!Number.isFinite(time)){this.reset();return;}
    const previous=last;last=time;if(previous===null)return;
    const dt=time-previous;if(dt<3||dt>250){samples.length=0;return;}
    samples.push(dt);if(samples.length<20)return;
    const sorted=samples.slice().sort((a,b)=>a-b);frameMs=sorted[Math.floor(sorted.length*.75)];samples.length=0;
   },
   get stats(){return {pixelRatio:ratio,detailed,frameMs,estimatedFps:frameMs?1000/frameMs:null,changes:0};}
  };
 }
 const api={create};if(typeof module==='object'&&module.exports)module.exports=api;else root.AtlasRenderBudget=api;
})(typeof window==='undefined'?globalThis:window);
