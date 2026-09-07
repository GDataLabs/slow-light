const fs=require('node:fs');
const path=require('node:path');
const src=path.dirname(path.dirname(require.resolve('three')));
const copy=(a,b)=>{fs.mkdirSync(path.dirname(b),{recursive:true});fs.copyFileSync(path.join(src,a),b);};
copy('build/three.module.min.js','vendor/three/three.module.js');
copy('build/three.core.min.js','vendor/three/three.core.js');
const modulePath='vendor/three/three.module.js';fs.writeFileSync(modulePath,fs.readFileSync(modulePath,'utf8').replaceAll('three.core.min.js','three.core.js'));
for(const item of ['loaders/GLTFLoader.js','utils/BufferGeometryUtils.js','objects/Reflector.js'])copy('examples/jsm/'+item,'vendor/three/addons/'+item);
copy('LICENSE','vendor/three/LICENSE');
