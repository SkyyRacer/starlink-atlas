/* Cache short, locally centred line buffers. The active buffer contains only
   past positions: future vertices must never reach the clipping/raster stage. */
(function(root){
 function opacity(C,primitive,alpha){const line=primitive.atlasLine;if(!line||line.alpha===alpha)return;line.alpha=alpha;const value=C.ColorGeometryInstanceAttribute.toValue(C.Color.fromAlpha(line.color,alpha));line.instance.attributes.color.value.set(value);if(primitive.ready){const attributes=primitive.getGeometryInstanceAttributes(line.instance.id);if(attributes)attributes.color=value;}}
 function trail(C,viewer,rows,color='#75ffcd'){
  if(rows.length<2)return null;
  const size=256,chunks=[],tint=C.Color.fromCssColorString(color);let partial=null,partialAt=null,currentOpacity=1;
  function make(points){
   const anchor=new C.Cartesian3(...points[0].position.map(v=>v*1000)),values=new Float64Array(points.length*3),indices=C.IndexDatatype.createTypedArray(points.length,(points.length-1)*2);
   for(let i=0;i<points.length;i++){for(let j=0;j<3;j++)values[3*i+j]=(points[i].position[j]-points[0].position[j])*1000;if(i){indices[2*(i-1)]=i-1;indices[2*(i-1)+1]=i;}}
   const geometry=new C.Geometry({attributes:{position:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.DOUBLE,componentsPerAttribute:3,values})},indices,primitiveType:C.PrimitiveType.LINES,boundingSphere:C.BoundingSphere.fromVertices(values)});
   const instance=new C.GeometryInstance({id:{atlasTrail:true},geometry,attributes:{color:C.ColorGeometryInstanceAttribute.fromColor(tint)}}),primitive=viewer.scene.primitives.add(new C.Primitive({geometryInstances:instance,appearance:new C.PerInstanceColorAppearance({flat:true,translucent:true}),asynchronous:false,compressVertices:false}));primitive.atlasLine={instance,color:tint};
   return {primitive,anchor,first:points[0].time,last:points.at(-1).time};
  }
  function place(chunk,matrix,visible){chunk.primitive.show=visible;if(visible){opacity(C,chunk.primitive,currentOpacity);chunk.primitive.modelMatrix=C.Matrix4.multiplyByTranslation(matrix,chunk.anchor,new C.Matrix4());}}
  function remove(chunk){if(chunk)viewer.scene.primitives.remove(chunk.primitive);}
  return {update(at,matrix,visible=true,alpha=1){currentOpacity=alpha;
   if(!visible){for(const chunk of chunks)if(chunk)chunk.primitive.show=false;if(partial)partial.primitive.show=false;return;}
   let lo=0,hi=rows.length;while(lo<hi){const mid=(lo+hi)>>>1;if(rows[mid].time<=at)lo=mid+1;else hi=mid;}const last=lo-1,block=last<0?-1:Math.floor(last/size);
   for(let b=0;b<Math.ceil((rows.length-1)/size);b++){const end=Math.min((b+1)*size,rows.length-1),complete=end<=last;if(complete&&!chunks[b])chunks[b]=make(rows.slice(b*size,end+1));if(chunks[b])place(chunks[b],matrix,complete);}
   const begin=block*size,needsPartial=last>=0&&begin<rows.length-1&&last<Math.min(begin+size,rows.length-1);
   if(at!==partialAt){remove(partial);partial=null;partialAt=at;if(needsPartial){const points=rows.slice(begin,last+1);if(last+1<rows.length&&at>rows[last].time){const a=rows[last],b=rows[last+1],u=(at-a.time)/(b.time-a.time);points.push({time:at,position:a.position.map((v,i)=>v+(b.position[i]-v)*u)});}if(points.length>1)partial=make(points);}}
   if(partial)place(partial,matrix,needsPartial);
  },destroy(){for(const chunk of chunks)remove(chunk);remove(partial);partial=null;chunks.length=0;}};
 }
 root.AtlasMissionFilmScene={trail,opacity};
})(typeof window==='undefined'?globalThis:window);
