import * as THREE from './vendor/three/three.module.js';
import { frameAt, projectTrack, poseAt, TRACK } from './track.js';

export function bevelBox(width,height,depth,radius=.12) {
  const r=Math.min(radius,width/3,height/3,depth/3),x=-width/2+r,y=-height/2+r;
  const shape=new THREE.Shape();shape.moveTo(x,y);shape.lineTo(x+width-2*r,y);shape.lineTo(x+width-2*r,y+height-2*r);shape.lineTo(x,y+height-2*r);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:depth-2*r,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:r,bevelThickness:r,curveSegments:4});
  geometry.translate(0,0,-depth/2+r);geometry.computeVertexNormals();return geometry;
}
export function contactShadow() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,4,32,32,31);
  gradient.addColorStop(0,'rgba(0,16,30,.7)');gradient.addColorStop(.5,'rgba(0,16,30,.42)');gradient.addColorStop(1,'rgba(0,16,30,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  return new THREE.CanvasTexture(canvas);
}
export function addLandscape(scene,renderer,grassMaterial) {
  const standard=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.8,...extra});
  const mesh=(geometry,material,parent=scene)=>{const m=new THREE.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  const sky=new THREE.Mesh(new THREE.SphereGeometry(650,24,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,toneMapped:false,uniforms:{zenith:{value:new THREE.Color('#3299de')},horizon:{value:new THREE.Color('#bfe8fa')}},vertexShader:'varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 zenith; uniform vec3 horizon; varying vec3 direction; void main(){float h=clamp(normalize(direction).y,0.,1.);gl_FragColor=vec4(mix(horizon,zenith,pow(h,.32)),1.); #include <tonemapping_fragment>\n #include <colorspace_fragment>\n }'}));
  sky.material.fragmentShader=sky.material.fragmentShader.replace('; #include',';\n#include').replace(' }','\n}');sky.frustumCulled=false;scene.add(sky);
  // The embankment meets the ground, so hills and ramps have solid terrain.
  const vertices=[],indices=[],uv=[],rows=512,columns=13;
  for(let i=0;i<=rows;i++){
    const f=frameAt(i/rows);
    for(let j=0;j<columns;j++){
      const offset=-25+j*50/(columns-1),falloff=1-THREE.MathUtils.smoothstep(Math.abs(offset),10,25);
      const p=f.p.clone().addScaledVector(f.right,offset);
      p.y=-1.68+(p.y+1.55)*falloff;
      vertices.push(p.x,p.y,p.z);uv.push(p.x/30,p.z/30);
      if(i<rows&&j<columns-1){const a=i*columns+j;indices.push(a,a+1,a+columns,a+1,a+columns+1,a+columns);}
    }
  }
  const terrain=new THREE.BufferGeometry();terrain.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));terrain.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));terrain.setIndex(indices);terrain.computeVertexNormals();const banks=mesh(terrain,grassMaterial);banks.castShadow=false;

  const lake=mesh(new THREE.CircleGeometry(30,64),standard('#29bfd1',{roughness:.26,metalness:.25}));lake.rotation.x=-Math.PI/2;lake.position.set(0,-1.60,4);lake.scale.set(1,.70,1);lake.castShadow=false;
  const island=mesh(new THREE.SphereGeometry(1,24,12),standard('#8bc44b'));island.position.set(10,-2.7,3);island.scale.set(10,2.5,8);island.castShadow=false;
  const windmill=new THREE.Group();windmill.position.set(10,-.3,3);
  const tower=mesh(new THREE.CylinderGeometry(1.1,1.7,8,12),standard('#fff1c6'),windmill);tower.position.y=4;
  const roof=mesh(new THREE.ConeGeometry(2,2.3,12),standard('#f8795c'),windmill);roof.position.y=9;
  const rotor=new THREE.Group();rotor.position.set(0,7,-1.2);windmill.add(rotor);
  const blades=standard('#fff7dc');for(let i=0;i<4;i++){const blade=mesh(bevelBox(.8,4.5,.12,.05),blades,rotor);const a=i*Math.PI/2;blade.position.set(Math.sin(a)*2.25,Math.cos(a)*2.25,0);blade.rotation.z=-a;}
  mesh(new THREE.SphereGeometry(.35,12,8),standard('#bd674b'),rotor);scene.add(windmill);

  // Batch small scenery, with a road-clearance check at generation time.
  const dummy=new THREE.Object3D();
  const blossomMaterials=['#ffcb49','#ff8eaf','#fff0dc'].map(c=>standard(c));
  const blossoms=blossomMaterials.map(m=>new THREE.InstancedMesh(new THREE.SphereGeometry(.18,6,4),m,180));
  for(let i=0;i<180;i++){
    const f=frameAt(i/180),side=i%2?1:-1,offset=11+Math.random()*7,p=f.p.clone().addScaledVector(f.right,offset*side);
    const surface=projectTrack(p,0,true);if(Math.abs(surface.offset)<10){dummy.scale.setScalar(0);}else{dummy.scale.setScalar(.8+Math.random()*.6);}
    p.y=-1.68+(p.y+1.55)*(1-THREE.MathUtils.smoothstep(offset,10,25));
    for(let j=0;j<3;j++){dummy.position.set(p.x+j*.22,p.y+.15,p.z+j*.35);dummy.updateMatrix();blossoms[j].setMatrixAt(i,dummy.matrix);}
  }
  for(const b of blossoms){b.instanceMatrix.needsUpdate=true;scene.add(b);}

  const labels=[['TURBO TRAIL','#f97a52'],['KEEP IT SUNNY','#438ed9'],['FULL THROTTLE','#8866d9'],['DRIFT CLUB','#29b79d']];
  for(let i=0;i<8;i++){
    const f=frameAt(.045+i*.12),g=new THREE.Group(),offset=(i%2?1:-1)*12;
    g.position.copy(f.p).addScaledVector(f.right,offset);g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.right,f.up,f.tangent.clone().negate()));
    const [text,color]=labels[i%4],c=document.createElement('canvas');c.width=512;c.height=160;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,512,160);ctx.strokeStyle='#ffffff';ctx.lineWidth=8;ctx.strokeRect(8,8,496,144);ctx.fillStyle='#ffffff';ctx.font='900 45px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,82);
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    const board=mesh(bevelBox(6,1.85,.25,.08),standard('#fff7e5'),g);board.position.y=2.1;
    for(const z of [-.14,.14]){const face=mesh(new THREE.PlaneGeometry(5.9,1.78),new THREE.MeshBasicMaterial({map:tex}),g);face.position.set(0,2.1,z);if(z>0)face.rotation.y=Math.PI;face.castShadow=false;}
    for(const x of [-2.2,2.2]){const post=mesh(new THREE.CylinderGeometry(.10,.10,2.2,6),standard('#f6ebd3'),g);post.position.set(x,1,0);}
    scene.add(g);
  }
  // Grandstands and a colorful canopy along the home straight.
  for(const side of [-1,1]){
    const f=frameAt(.025),g=new THREE.Group();g.position.copy(f.p).addScaledVector(f.right,side*17);g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.right,f.up,f.tangent.clone().negate()));
    const seats=standard(side>0?'#ff8361':'#6abfea');
    for(let row=0;row<4;row++){const bench=mesh(bevelBox(1.0,.38,14,.1),seats,g);bench.position.set(side*row*1.05,.6+row*.6,0);}
    const canopy=mesh(bevelBox(6,.25,16,.1),standard('#fff3d4'),g);canopy.position.set(side*1.5,4.9,0);
    for(const z of [-7,7]){const post=mesh(new THREE.CylinderGeometry(.12,.12,5,8),standard('#789aaf'),g);post.position.set(side*3,2.4,z);}
    scene.add(g);
  }
  // Balloons and flags give the circuit a playful, authored silhouette.
  const balloons=[];
  for(let i=0;i<7;i++){
    const a=i*Math.PI*2/7,g=new THREE.Group();g.position.set(Math.cos(a)*150,20+(i%3)*5,Math.sin(a)*150);
    const balloon=mesh(new THREE.SphereGeometry(2,20,16),standard(['#ff8c6a','#ffe281','#83ccec'][i%3]),g);balloon.scale.y=1.25;
    const basket=mesh(bevelBox(.9,.65,.9,.12),standard('#c08c5e'),g);basket.position.y=-3.5;
    for(const x of [-.35,.35]){const rope=mesh(new THREE.CylinderGeometry(.025,.025,1.2,4),standard('#eee8cd'),g);rope.position.set(x,-2.65,0);}
    scene.add(g);balloons.push(g);
  }
  return {rotor,balloons};
}
