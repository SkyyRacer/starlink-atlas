const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]||'public');
(async()=>{
 const edition=JSON.parse(fs.readFileSync(path.join(root,'edition.json'))),bundle=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,edition.bundle))));
 const {instance}=await WebAssembly.instantiate(fs.readFileSync(path.join(root,'atlas_web_core.wasm')),{}),e=instance.exports;
 function call(value){const bytes=Buffer.from(JSON.stringify(value)),p=e.atlas_alloc(bytes.length);new Uint8Array(e.memory.buffer,p,bytes.length).set(bytes);const out=e.atlas_call(p,bytes.length);e.atlas_free(p,bytes.length);const n=new DataView(e.memory.buffer).getUint32(out,true);const result=JSON.parse(Buffer.from(new Uint8Array(e.memory.buffer,out+4,n)));e.atlas_free(out,n+4);if(result.error)throw new Error(result.error);return result.data;}
 call({op:'init',data:bundle});const now=new Date().toISOString(),live=call({op:'positions',at:now,now});assert.ok(live.points.length>1000);assert.ok(live.points.every(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&p.altitude_km>0));
 const id=live.points[0].id;const tracked=call({op:'positions',at:now,now,id});assert.ok(tracked.track.length);assert.deepEqual(tracked.track_3d.at(-1),tracked.future_track_3d[0]);assert.deepEqual(tracked.future_track_3d[0],(()=>{const p=tracked.points.find(p=>p.id===id);return [p.lat,p.lon,p.altitude_km];})());
 const fixture={OBJECT_NAME:'STARLINK-WASM-TEST',OBJECT_ID:'2020-001A',EPOCH:'2020-01-02T00:00:00',MEAN_MOTION:15.1,ECCENTRICITY:.001,INCLINATION:53,RA_OF_ASC_NODE:80,ARG_OF_PERICENTER:20,MEAN_ANOMALY:30,EPHEMERIS_TYPE:0,CLASSIFICATION_TYPE:'U',NORAD_CAT_ID:100123,ELEMENT_SET_NO:999,REV_AT_EPOCH:1,BSTAR:.00001,MEAN_MOTION_DOT:0,MEAN_MOTION_DDOT:0};
 call({op:'init',data:{orbits:[{elements:fixture,source:'CelesTrak SupGP / SpaceX'}],raw_catalog:[{...fixture,LAUNCH_DATE:'2020-01-01',DECAY_DATE:'2020-01-03'}],gcat:{}}});
 const query=at=>call({op:'positions',at,now:'2020-01-03T00:00:00Z',id:100123});
 assert.equal(query('2020-01-01T23:59:59Z').points.length,0,'SupGP must not propagate before its epoch');const p=query('2020-01-02T01:00:00Z').points[0];assert.ok(p.altitude_km>400&&p.altitude_km<800);assert.equal(p.source,'CelesTrak SupGP / SpaceX');assert.equal(query('2020-01-03T00:00:00Z').points.length,0,'decayed object is hidden');
 assert.throws(()=>call({op:'positions',at:'2099-01-01T00:00:00Z',now,id}),/futur/);
 call({op:'init',data:bundle});const start=performance.now();for(let i=0;i<50;i++)call({op:'positions',at:now,now});
 console.log(JSON.stringify({wasm:'OK',live_points:live.points.length,frames:50,mean_frame_ms:Math.round((performance.now()-start)/50)}));
})().catch(e=>{console.error(e);process.exitCode=1;});
