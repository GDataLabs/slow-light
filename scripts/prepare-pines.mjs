// Authoring only: node scripts/prepare-pines.mjs /path/to/downloaded/gltf
import fs from 'node:fs';
import path from 'node:path';
import {MeshoptSimplifier as simplify} from 'meshoptimizer';
await simplify.ready;
const input=process.argv[2];if(!input)throw Error('Provide the source glTF path');
const source=JSON.parse(fs.readFileSync(input)),base=path.dirname(input),out='assets/trees';fs.mkdirSync(out,{recursive:true});
const buffers=source.buffers.map(b=>fs.readFileSync(path.join(base,b.uri))),parts=[],views=[],accessors=[];let offset=0;
function read(id){const a=source.accessors[id],v=source.bufferViews[a.bufferView],count={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],Type={5126:Float32Array,5125:Uint32Array,5123:Uint16Array}[a.componentType],result=new Type(a.count*count),buf=buffers[v.buffer];const stride=v.byteStride||count*Type.BYTES_PER_ELEMENT;
for(let i=0;i<a.count;i++)for(let k=0;k<count;k++){const at=(v.byteOffset||0)+(a.byteOffset||0)+i*stride+k*Type.BYTES_PER_ELEMENT;result[i*count+k]=a.componentType===5126?buf.readFloatLE(at):a.componentType===5125?buf.readUInt32LE(at):buf.readUInt16LE(at);}return result;}
function add(array,type,min,max){const b=Buffer.from(array.buffer,array.byteOffset,array.byteLength);views.push({buffer:0,byteOffset:offset,byteLength:b.length});parts.push(b);offset+=b.length;accessors.push({bufferView:views.length-1,componentType:array instanceof Float32Array?5126:5125,count:array.length/({SCALAR:1,VEC2:2,VEC3:3}[type]),type,...(min?{min,max}:{})});return accessors.length-1;}
let total=0;
const meshes=source.meshes.map(m=>({name:m.name,primitives:m.primitives.map(p=>{
 const pos=read(p.attributes.POSITION),indices=new Uint32Array(read(p.indices));const target=p.material===1?42000:4500;
 const [reduced]=simplify.simplifySloppy(indices,pos,3,null,Math.min(indices.length,target),.03);
 const map=new Map(),selected=[];const compact=Uint32Array.from(reduced,i=>{if(!map.has(i)){map.set(i,map.size);selected.push(i);}return map.get(i);});const attributes={};
 for(const [name,id] of Object.entries(p.attributes)){const original=read(id),n=original.length/source.accessors[id].count,values=new Float32Array(selected.length*n),min=Array(n).fill(Infinity),max=Array(n).fill(-Infinity);selected.forEach((v,i)=>{for(let k=0;k<n;k++){values[i*n+k]=original[v*n+k];min[k]=Math.min(min[k],values[i*n+k]);max[k]=Math.max(max[k],values[i*n+k]);}});attributes[name]=add(values,source.accessors[id].type,name==='POSITION'?min:null,max);}
 total+=compact.length/3;return {attributes,indices:add(compact,'SCALAR'),material:p.material};
})}));
const output={...source,meshes,buffers:[{uri:'pines.bin',byteLength:offset}],bufferViews:views,accessors};
for(const image of output.images){const dest=path.join(out,image.uri);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(base,image.uri),dest);}
fs.writeFileSync(path.join(out,'pines.bin'),Buffer.concat(parts));fs.writeFileSync(path.join(out,'pines.gltf'),JSON.stringify(output));console.log({triangles:total,geometryBytes:offset});
