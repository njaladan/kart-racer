import * as THREE from 'three';
import { bevelBox, contactShadow, addLandscape } from './visuals.js';
import { advanceRacer, botInput } from './simulation.js';
import { FIXED_DT, MAX_SPEED, resetMotion, drive, wallContact, verticalMotion, chargeDrift } from './physics.js';
import { ranking, finishRacer, lapNumber } from './race.js';
import { TRACK, WORLD_PER_UNIT, wrap01, rampHeight, bankAt, routePoint, frameAt, trackT, laneWidth, poseAt, yawFor, projectTrack } from './track.js';

(() => {
  const canvas=document.querySelector('#game'), radar=document.querySelector('#radar'), rctx=radar.getContext('2d');
  const $=id=>document.getElementById(id), ui={title:$('title-screen'),finish:$('finish-screen'),pause:$('pause-screen'),hud:$('race-hud'),count:$('countdown'),place:$('place'),lap:$('lap'),lapFill:$('lap-fill'),driftFill:$('drift-fill'),speed:$('speed'),timer:$('timer'),item:$('item-box'),itemIcon:document.querySelector('.item-icon'),itemLabel:document.querySelector('.item-label'),toast:$('toast')};
  const TOTAL_LAPS=3, TAU=Math.PI*2;
  let w=innerWidth,h=innerHeight,dpr=1,last=performance.now(),elapsed=0,raceTime=0,running=false,paused=false,started=false,finished=false,countdown=0,toastLeft=0,shake=0,radarRect=null;
  let testAutodrive=false,testFrameStats={frames:0,total:0,max:0};
  const testMode=new URLSearchParams(location.search).has('test');
  const keys=Object.create(null), tempObj=new THREE.Object3D();
  const scene=new THREE.Scene();scene.background=new THREE.Color('#8ed5e8');scene.fog=new THREE.Fog('#c3e4e5',165,480);
  const camera=new THREE.PerspectiveCamera(63,innerWidth/innerHeight,.1,750);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.setSize(innerWidth,innerHeight,false);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
  scene.add(new THREE.HemisphereLight('#c6edff','#8c9b60',1.55));
  const sun=new THREE.DirectionalLight('#fff0d0',2.5);sun.position.set(-75,130,75);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-48;sun.shadow.camera.right=48;sun.shadow.camera.top=48;sun.shadow.camera.bottom=-48;sun.shadow.camera.near=1;sun.shadow.camera.far=220;sun.shadow.normalBias=.035;sun.shadow.bias=-.00025;scene.add(sun);scene.add(sun.target);
  const mat=(color,roughness=.74,extra={})=>new THREE.MeshStandardMaterial({color,roughness,...extra});
  function speckleTexture(base,colors,count,repeat){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle=base;x.fillRect(0,0,256,256);for(let i=0;i<count;i++){x.fillStyle=colors[Math.floor(Math.random()*colors.length)];const size=.5+Math.random()*2.2;x.fillRect(Math.random()*256,Math.random()*256,size,size);}const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(repeat,repeat);tex.anisotropy=renderer.capabilities.getMaxAnisotropy();return tex;}
  const grassTexture=speckleTexture('#79b547',['#85be50','#72ab42','#90c655','#79b149'],2600,1),asphaltTexture=speckleTexture('#667180',['#6e7a86','#5f6c7c','#7a8490','#627180'],2400,1);
  const mats={grass:mat('#ffffff',.96,{map:grassTexture}),road:mat('#ffffff',.96,{map:asphaltTexture}),roadside:mat('#9ba89d'),white:mat('#fff4d4',.65),red:mat('#fa634f'),rail:mat('#e7e5d9',.4,{metalness:.22}),pine:mat('#238451'),pine2:mat('#4aa650'),trunk:mat('#795540'),gold:mat('#f7d65b',.3,{metalness:.32,emissive:'#aa771b',emissiveIntensity:.35}),neon:mat('#50f8dd',.27,{emissive:'#0af5cd',emissiveIntensity:2.4}),pad:mat('#193b49',.3,{metalness:.5,emissive:'#0a878b',emissiveIntensity:.7}),black:mat('#17202a'),tire:mat('#11151a',.9),glass:mat('#9aeaff',.18,{metalness:.25,emissive:'#194955',emissiveIntensity:.22})};

  function wrapAngle(a){return Math.atan2(Math.sin(a),Math.cos(a));}
  function addMesh(geometry,material,parent=scene,position=null){const m=new THREE.Mesh(geometry,material);if(position)m.position.copy(position);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}

  function ribbon(inner,outer,material,segments=500,alternating=false,lift=.025){const pos=[],uv=[],idx=[];for(let i=0;i<=segments;i++){const t=i/segments,f=frameAt(t);for(const [j,side] of [inner,outer].entries()){const p=f.p.clone().addScaledVector(f.right,side).addScaledVector(f.up,lift);pos.push(p.x,p.y,p.z);uv.push(j*4,t*180);}}
    for(let i=0;i<segments;i++){let a=i*2,b=a+1,c=a+2,d=a+3;idx.push(a,b,c,c,b,d);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();const m=new THREE.Mesh(g,material);m.receiveShadow=true;scene.add(m);if(alternating){for(let i=0;i<segments;i++)g.addGroup(i*6,6,i%2);}return m;}
  function makeWorld(){
    const ground=addMesh(new THREE.PlaneGeometry(1500,1500,1,1),mats.grass);ground.rotation.x=-Math.PI/2;ground.position.y=-1.7;ground.receiveShadow=true;ground.castShadow=false;grassTexture.repeat.set(1,1);ground.geometry.attributes.uv.array.forEach((v,i,a)=>{a[i]=v*100;});
    ribbon(-9.15,9.15,mats.roadside,500,false,-.045);ribbon(-8.1,8.1,mats.road,500,false,.045);ribbon(8.1,9.05,[mats.red,mats.white],520,true,.085);ribbon(-9.05,-8.1,[mats.white,mats.red],520,true,.085);
    // Intermittent lane ticks make the racing line legible at speed.
    const dash=new THREE.InstancedMesh(new THREE.BoxGeometry(.13,.025,2.4),mats.white,54);for(let i=0;i<54;i++){let f=frameAt(i/54),p=f.p.clone().addScaledVector(f.up,.08);tempObj.position.copy(p);tempObj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.right,f.up,f.tangent.clone().negate()));tempObj.updateMatrix();dash.setMatrixAt(i,tempObj.matrix);}dash.instanceMatrix.needsUpdate=true;scene.add(dash);
    // Low-poly pine forest in instanced batches keeps the scene light enough for a browser.
    const count=320, trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.16,.24,1.5,8),mats.trunk,count), lower=new THREE.InstancedMesh(new THREE.ConeGeometry(1,1.7,10),mats.pine,count), upper=new THREE.InstancedMesh(new THREE.ConeGeometry(.76,1.55,10),mats.pine2,count);
    for(let i=0;i<count;i++){let t=Math.random(),f=frameAt(t),side=Math.random()<.5?-1:1,dist=14+Math.random()*48,p=f.p.clone().addScaledVector(f.right,side*dist);const clear=projectTrack(p,0,true).distance>12;let scale=clear?.75+Math.random()*1.45:0,rot=Math.random()*TAU;tempObj.position.set(p.x,-.7+scale*.72,p.z);tempObj.rotation.set(0,rot,0);tempObj.scale.set(scale,scale,scale);tempObj.updateMatrix();trunk.setMatrixAt(i,tempObj.matrix);tempObj.position.set(p.x,-.7+scale*1.55,p.z);tempObj.scale.set(scale*1.35,scale*1.5,scale*1.35);tempObj.updateMatrix();lower.setMatrixAt(i,tempObj.matrix);tempObj.position.set(p.x,-.7+scale*2.42,p.z);tempObj.scale.set(scale,scale*1.3,scale);tempObj.updateMatrix();upper.setMatrixAt(i,tempObj.matrix);}
    for(const m of [trunk,lower,upper]){m.instanceMatrix.needsUpdate=true;m.castShadow=true;scene.add(m);}
    // A few distant rounded hills and drifting clouds establish depth beyond the circuit.
    for(let i=0;i<20;i++){const a=TAU*i/20,r=235+Math.random()*45,geo=new THREE.SphereGeometry(1,24,16),hill=addMesh(geo,mat(i%2?'#75a688':'#8abb9d'));hill.position.set(Math.cos(a)*r,-15+Math.random()*5,Math.sin(a)*r);hill.scale.set(28+Math.random()*36,17+Math.random()*18,30+Math.random()*36);hill.castShadow=false;}
    const cloudMat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1});for(let i=0;i<17;i++){const g=new THREE.Group();for(let j=0;j<4;j++){const puff=addMesh(new THREE.SphereGeometry(1,16,12),cloudMat,g);puff.position.set(j*2.4,Math.sin(j*1.6)*.45,0);puff.scale.set(2.4,1.25,1.2);puff.castShadow=false;}g.position.set(-140+Math.random()*280,34+Math.random()*25,-130+Math.random()*260);g.userData.drift=.4+Math.random()*.6;scene.add(g);clouds.push(g);}
    // Banked roadside guardrails, spaced enough to leave the landscape visible.
    const railGeom=new THREE.BoxGeometry(.24,.85,7.2),railCount=290,railMesh=new THREE.InstancedMesh(railGeom,mats.rail,railCount);for(let i=0;i<railCount;i++){const f=frameAt(i/railCount),side=i%2?1:-1,p=f.p.clone().addScaledVector(f.right,side*9.6).addScaledVector(f.up,.6);tempObj.position.copy(p);tempObj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.right,f.up,f.tangent.clone().negate()));tempObj.scale.set(1,1,1);tempObj.updateMatrix();railMesh.setMatrixAt(i,tempObj.matrix);}railMesh.instanceMatrix.needsUpdate=true;scene.add(railMesh);
    landscape=addLandscape(scene,renderer,mats.grass);addFinishArch();addPads();addItemBoxes();
  }
  const clouds=[],pads=[],boxes=[];let landscape=null;const shadowTexture=contactShadow();
  function alignGroup(group,f){group.position.copy(f.p);const z=f.tangent.clone().negate();const basis=new THREE.Matrix4().makeBasis(f.right,f.up,z);group.quaternion.setFromRotationMatrix(basis);}
  function addFinishArch(){const g=new THREE.Group(),post=mat('#f7f0d5',.36),accent=mat('#f76150',.5),beam=mat('#fa7654',.4);for(const x of [-9,9]){const p=addMesh(new THREE.BoxGeometry(.72,5.3,.8),post,g);p.position.set(x,2.6,0);const a=addMesh(new THREE.BoxGeometry(.9,.75,1),accent,g);a.position.set(x,4.8,0);}const top=addMesh(new THREE.BoxGeometry(19,.75,.9),beam,g);top.position.set(0,5.1,0);for(let i=0;i<12;i++){const tile=addMesh(new THREE.BoxGeometry(1.5,.16,.95),i%2?mats.white:mats.black,g);tile.position.set(-8.25+i*1.5,4.64,0);}alignGroup(g,frameAt(0));scene.add(g);
    const f=frameAt(0),center=f.p.clone().addScaledVector(f.up,.13);for(let row=0;row<2;row++)for(let j=0;j<20;j++){const x=-7.7+j*.81,z=-.18+row*.36,p=center.clone().addScaledVector(f.right,x).addScaledVector(f.tangent,z),tile=addMesh(new THREE.BoxGeometry(.82,.045,.38),((row+j)%2)?mats.white:mats.black);tile.position.copy(p);tile.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.right,f.up,f.tangent.clone().negate()));tile.castShadow=false;}
  }
  function addPads(){for(const t of [.115,.385,.665,.89]){const f=frameAt(t),g=new THREE.Group(),base=addMesh(new THREE.BoxGeometry(4.5,.18,6.8),mats.pad,g);base.position.y=.11;for(let i=-1;i<=1;i++){const strip=addMesh(new THREE.BoxGeometry(.18,.07,5.8),mats.neon,g);strip.position.set(i*1.32,.23,0);}alignGroup(g,f);scene.add(g);pads.push({g,t,phase:Math.random()*TAU});}}
  function itemCubeMaterial(){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle='#4debd2';x.fillRect(0,0,128,128);x.strokeStyle='#eaffff';x.lineWidth=9;x.strokeRect(7,7,114,114);x.fillStyle='#052c3b';x.font='900 94px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('?',64,67);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return new THREE.MeshStandardMaterial({map:texture,roughness:.22,metalness:.22,emissive:'#0e9e8b',emissiveMap:texture,emissiveIntensity:.65});}
  const boxMaterial=itemCubeMaterial();
  function addItemBoxes(){for(let i=0;i<18;i++){let s=90+i*130,group=new THREE.Group(),cube=addMesh(new THREE.BoxGeometry(1.65,1.65,1.65),boxMaterial,group);cube.castShadow=true;const wire=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.72,1.72,1.72)),new THREE.LineBasicMaterial({color:'#eaffff'}));group.add(wire);const b={s,x:[-.58,0,.58][i%3],group,cube,active:true,respawn:0,phase:Math.random()*TAU};scene.add(group);boxes.push(b);}}

  const karts=[],projectiles=[],bananas=[],particles=[];
  function buildKart(color,name,isPlayer=false){const root=new THREE.Group();root.name=name;const paint=mat(color,.34,{metalness:.2}),highlight=mat(new THREE.Color(color).lerp(new THREE.Color('#ffffff'),.42),.32,{metalness:.25}),dark=mat('#18242e',.48),rubber=mat('#11161a',.92),skin=mat('#e4ad7c',.8),helmet=mat(color,.25,{metalness:.25});
    const body=addMesh(bevelBox(1.6,.48,2.22),paint,root);body.position.y=.73;const nose=addMesh(bevelBox(1.08,.23,.75),highlight,root);nose.position.set(0,.82,-1.12);const sideL=addMesh(bevelBox(.18,.27,1.5),paint,root);sideL.position.set(-.84,.53,-.05);const sideR=sideL.clone();sideR.position.x=.84;root.add(sideR);
    const bumper=addMesh(bevelBox(1.83,.18,.28),dark,root);bumper.position.set(0,.5,-1.28);const spoilerPost=addMesh(bevelBox(.12,.65,.14),dark,root);spoilerPost.position.set(0,1.05,.88);const spoiler=addMesh(bevelBox(1.45,.16,.42),highlight,root);spoiler.position.set(0,1.37,.9);
    const driver=addMesh(new THREE.SphereGeometry(.49,24,16),dark,root);driver.position.set(0,1.22,.18);driver.scale.set(.83,1.05,.76);const head=addMesh(new THREE.SphereGeometry(.35,24,16),skin,root);head.position.set(0,1.78,-.08);const helmetTop=addMesh(new THREE.SphereGeometry(.39,24,16,0,TAU,0,Math.PI*.62),helmet,root);helmetTop.position.set(0,1.88,-.08);const visor=addMesh(bevelBox(.52,.13,.12),mat('#10252f',.2,{metalness:.55}),root);visor.position.set(0,1.81,-.43);const eyeL=addMesh(new THREE.SphereGeometry(.035,6,5),mats.white,root);eyeL.position.set(-.12,1.83,-.49);const eyeR=eyeL.clone();eyeR.position.x=.12;root.add(eyeR);
    const limb=(start,end,r,material)=>{const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),delta=b.clone().sub(a),mesh=addMesh(new THREE.CylinderGeometry(r*.8,r,delta.length(),7),material,root);mesh.position.copy(a.add(b).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return mesh;};for(const side of [-1,1]){limb([side*.31,1.47,.02],[side*.34,1.17,-.48],.14,highlight);const glove=addMesh(new THREE.SphereGeometry(.14,7,6),dark,root);glove.position.set(side*.34,1.16,-.5);}
    const steering=addMesh(new THREE.TorusGeometry(.34,.055,7,18),dark,root);steering.position.set(0,1.23,-.57);steering.rotation.x=1.18;const dashBoard=addMesh(bevelBox(.82,.13,.31),dark,root);dashBoard.position.set(0,1.06,-.46);const badge=addMesh(bevelBox(.31,.035,.035),mats.gold,root);badge.position.set(0,.94,-1.02);
    const wheelGeo=new THREE.CylinderGeometry(.42,.42,.32,20),wheels=[];for(const z of [-.68,.76])for(const x of [-.82,.82]){const pivot=new THREE.Group();pivot.position.set(x,.42,z);const spin=new THREE.Group();pivot.add(spin);const tire=addMesh(wheelGeo,rubber,spin);tire.rotation.z=Math.PI/2;const hub=addMesh(new THREE.CylinderGeometry(.23,.23,.34,16),highlight,spin);hub.rotation.z=Math.PI/2;const cap=addMesh(new THREE.CylinderGeometry(.09,.09,.36,12),dark,spin);cap.rotation.z=Math.PI/2;root.add(pivot);wheels.push({pivot,spin,front:z<0});}
    const exhaustMat=mat('#ff9b49',.28,{emissive:'#ff5018',emissiveIntensity:0}),flame=addMesh(new THREE.ConeGeometry(.15,.8,7),exhaustMat,root);flame.position.set(0,.66,1.48);flame.rotation.x=-Math.PI/2;
    const aura=new THREE.Group();const ring=addMesh(new THREE.TorusGeometry(1.45,.07,7,36),new THREE.MeshBasicMaterial({color:'#e9f562'}),aura);ring.rotation.x=Math.PI/2;for(let i=0;i<5;i++){const star=addMesh(new THREE.OctahedronGeometry(.23),new THREE.MeshBasicMaterial({color:['#fc6adf','#56f2ec','#fff263','#ff9851','#9f83ff'][i]}),aura);star.userData.a=i*TAU/5;star.userData.r=1.7;}aura.position.y=1.35;root.add(aura);aura.visible=false;
    const bodyGroup=new THREE.Group();for(const child of [...root.children])if(!wheels.some(w=>w.pivot===child))bodyGroup.add(child);root.add(bodyGroup);
    const seat=addMesh(bevelBox(.78,.85,.32),dark,bodyGroup);seat.position.set(0,1.22,.57);seat.rotation.x=-.12;
    for(const x of [-.68,.68]){const pipe=addMesh(new THREE.CylinderGeometry(.11,.11,.65,12),mat('#dde7e6',.28,{metalness:.75}),bodyGroup);pipe.position.set(x,.65,1.15);pipe.rotation.x=Math.PI/2;}
    const shadow=new THREE.Mesh(new THREE.PlaneGeometry(3.2,3.8),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,opacity:.27,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));scene.add(shadow);
    scene.add(root);const kart={root,bodyGroup,shadow,wheels,flame,exhaustMat,aura,paint,helmet,name,isPlayer,color};karts.push(kart);return kart;}

  const player={s:0,x:0,speed:0,yaw:0,worldPos:new THREE.Vector3(),lap:0,boost:0,star:0,spin:0,drift:0,driftTier:0,item:null,itemCount:0,air:0,jumpCooldown:0,padCooldown:0,finished:false,prevS:0};
  const bots=[
    {name:'MISO',color:'#fa6551',s:-18,x:-.35,speed:163,skill:.91},{name:'PIP',color:'#edc748',s:-30,x:.32,speed:158,skill:.86},{name:'BOLT',color:'#9e83ff',s:-43,x:-.12,speed:153,skill:.81},{name:'NOVA',color:'#42d7b4',s:-55,x:.43,speed:148,skill:.77},{name:'BEANS',color:'#ff8bbc',s:-70,x:-.42,speed:144,skill:.72}
  ];
  resetMotion(player);bots.forEach(b=>{resetMotion(b);b.worldPos=poseAt(b.s,laneWidth(b.x),.065).p;b.yaw=yawFor(frameAt(trackT(b.s)).tangent);});
  const playerKart=buildKart('#38d9ca','YOU',true);bots.forEach(b=>{b.kart=buildKart(b.color,b.name);b.item=null;b.itemCount=0;b.cooldown=5+Math.random()*5;b.spin=0;b.boost=0;b.finished=false;b.prevS=b.s;});

  function nearestDelta(a,b){let d=modTrack(a-b);if(d>TRACK/2)d-=TRACK;return d;}
  function modTrack(s){return ((s%TRACK)+TRACK)%TRACK;}
  function place(){return ranking([player,...bots]).indexOf(player)+1;}
  function ordinal(n){return `${n}${n===1?'ST':n===2?'ND':n===3?'RD':'TH'}`;}
  function formatTime(t){let m=Math.floor(t/60),s=Math.floor(t%60),cs=Math.floor(t%1*100);return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;}
  function notify(text){ui.toast.textContent=text;toastLeft=1.65;}
  let audio=null,engineGain=null,engineOsc=null,engineFilter=null;
  function startAudio(){if(audio)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;audio=new AC();const master=audio.createGain();master.gain.value=.23;master.connect(audio.destination);engineFilter=audio.createBiquadFilter();engineFilter.type='lowpass';engineFilter.frequency.value=460;engineGain=audio.createGain();engineGain.gain.value=.025;engineOsc=audio.createOscillator();engineOsc.type='sawtooth';engineOsc.frequency.value=62;engineOsc.connect(engineFilter);engineFilter.connect(engineGain);engineGain.connect(master);engineOsc.start();const harmonic=audio.createOscillator(),hg=audio.createGain();harmonic.type='triangle';harmonic.frequency.value=124;hg.gain.value=.009;harmonic.connect(hg);hg.connect(master);harmonic.start();audio.master=master;audio.harmonic=harmonic;audio.harmonicGain=hg;}
  function tone(freq=440,duration=.13,type='triangle',volume=.13,slide=0){if(!audio)return;const osc=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;osc.type=type;osc.frequency.setValueAtTime(freq,now);if(slide)osc.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),now+duration);gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.001,now+duration);osc.connect(gain);gain.connect(audio.master);osc.start(now);osc.stop(now+duration+.02);}
  function sfx(kind){if(kind==='pickup'){tone(660,.1,'sine',.12,280);setTimeout(()=>tone(990,.12,'sine',.09,180),65);}else if(kind==='boost'){tone(180,.35,'sawtooth',.17,650);}else if(kind==='shell'){tone(360,.25,'square',.12,-230);}else if(kind==='jump'){tone(240,.38,'triangle',.12,570);}else if(kind==='hit'){tone(115,.24,'sawtooth',.18,-60);}else if(kind==='star'){tone(540,.35,'triangle',.08,900);}}
  function syncItem(){const i=player.item,labels={mushroom:`MUSHROOM ×${player.itemCount}`,green:'GREEN SHELL',red:'RED SHELL',banana:'BANANA PEEL',star:'RAINBOW STAR'};ui.itemIcon.textContent=({mushroom:'🍄',green:'●',red:'◉',banana:'⌁',star:'✦'})[i]||'?';ui.itemLabel.textContent=labels[i]||'ITEM';ui.item.style.opacity=i?'1':'.65';}
  function setItem(who,type){who.item=type;who.itemCount=type==='mushroom'?3:1;if(who===player)syncItem();}
  function collect(box,who){if(who.item||who.finished||!who.grounded)return;box.active=false;box.group.visible=false;box.respawn=10+Math.random()*4;const pool=['mushroom','green','red','banana','star'];setItem(who,pool[Math.floor(Math.random()*pool.length)]);if(who===player){notify(`${({mushroom:'TRIPLE MUSHROOMS',green:'GREEN SHELL',red:'HOMING RED SHELL',banana:'BANANA PEELS',star:'RAINBOW STAR'})[who.item]}!`);sfx('pickup');}}

  function spawnParticle(pos,color,life=.6,size=.2,velocity=null){if(particles.length>95){disposeEffect(particles[0].mesh);particles.shift();}const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(size,0),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.95}));mesh.position.copy(pos);scene.add(mesh);particles.push({mesh,life,max:life,velocity:velocity||new THREE.Vector3((Math.random()-.5)*2,Math.random()*2,(Math.random()-.5)*2)});}
  function getItemModel(kind){let g=new THREE.Group();if(kind==='banana'){const body=addMesh(new THREE.TorusGeometry(.43,.17,6,8,Math.PI*1.45),mat('#f6d33f',.42,{emissive:'#80631a',emissiveIntensity:.25}),g);body.rotation.z=-.15;for(const side of [-1,1]){const tip=addMesh(new THREE.ConeGeometry(.17,.3,6),mat('#66b36c'),g);tip.position.set(side*.39,.27,0);tip.rotation.z=side*.75;}}else{const red=kind==='red',shellMat=mat(red?'#eb4e4b':'#6acb4a',.29,{metalness:.12,emissive:red?'#76201d':'#244d1c',emissiveIntensity:.32});const shell=addMesh(new THREE.SphereGeometry(.58,9,7),shellMat,g);shell.scale.set(1,1.05,1);const cap=addMesh(new THREE.ConeGeometry(.52,.45,8),mat(red?'#ff8172':'#b8ed69'),g);cap.position.y=.35;const stripe=addMesh(new THREE.TorusGeometry(.54,.075,5,12),mats.white,g);stripe.rotation.x=Math.PI/2;}return g;}
  function fireItem(who){if(!who.item||who.finished||who.spin>0)return;const type=who.item,isPlayer=who===player,kart=who===player?playerKart:who.kart,from=who.s,lane=who.x;who.itemCount--;if(type==='mushroom'){who.boost=Math.max(who.boost,.95);if(!who.itemCount)who.item=null;if(isPlayer){notify(who.itemCount?`TURBO! ${who.itemCount} LEFT`:'MUSHROOM BOOST!');sfx('boost');}for(let n=0;n<17;n++){const p=poseAt(from,laneWidth(lane),1);spawnParticle(p.p,'#ff9c4d',.5,.15);}}
    else if(type==='star'){who.star=6.2;who.boost=3.3;who.item=null;if(isPlayer){notify('RAINBOW STAR!');sfx('star');}}
    else if(type==='banana'){for(let n=0;n<3;n++){const s=from-14-n*8,b={s,x:lane+(n-1)*.08,mesh:getItemModel('banana'),life:18,owner:who,grace:.6};scene.add(b.mesh);bananas.push(b);}who.item=null;if(isPlayer){notify('BANANAS AWAY!');sfx('shell');}}
    else if(type==='green'||type==='red'){let target=null;if(type==='red'){const rivals=isPlayer?bots.filter(b=>!b.finished&&b.s>who.s):[player].filter(p=>p.s>who.s);target=rivals.sort((a,b)=>Math.abs(nearestDelta(a.s,who.s))-Math.abs(nearestDelta(b.s,who.s)))[0]||null;}
      const q={type,s:from+5,x:lane,target,owner:who,mesh:getItemModel(type),life:5.4,speed:type==='red'?160:170};scene.add(q.mesh);projectiles.push(q);if(isPlayer){notify(type==='red'?'HOMING RED SHELL!':'GREEN SHELL!');sfx('shell');}}
    if(isPlayer)syncItem();}
  function reset(){
    player.s=0;player.x=0;player.speed=0;player.yaw=yawFor(frameAt(0).tangent);player.worldPos.copy(poseAt(0,0,.065).p);player.lap=0;player.boost=0;player.star=0;player.spin=0;player.drift=0;player.driftTier=0;player.item=null;player.itemCount=0;player.air=0;player.jumpCooldown=0;player.padCooldown=0;player.finished=false;player.prevS=0;player.finishTime=Infinity;player.finishDelay=0;resetMotion(player);clearInput();
    bots.forEach((b,i)=>{b.s=-46-Math.floor(i/2)*60-(i%2)*5;b.prevS=b.s;b.x=[-.4,.4,-.4,.4,-.4][i];b.speed=0;resetMotion(b);b.worldPos=poseAt(b.s,laneWidth(b.x),.065).p;b.yaw=yawFor(frameAt(trackT(b.s)).tangent);b.lap=0;b.padCooldown=0;b.finishTime=Infinity;b.spin=0;b.boost=0;b.star=0;b.item=null;b.itemCount=0;b.cooldown=4+i*1.5;b.finished=false;});
    boxes.forEach(b=>{b.active=true;b.group.visible=true;b.respawn=0;});projectiles.splice(0).forEach(p=>disposeEffect(p.mesh));bananas.splice(0).forEach(b=>disposeEffect(b.mesh));particles.splice(0).forEach(p=>disposeEffect(p.mesh));
    elapsed=0;raceTime=0;running=false;paused=false;finished=false;toastLeft=0;shake=0;ui.toast.textContent='';syncItem();updateVehicle(player,playerKart,0,true);
  }
  function begin(){reset();startAudio();if(audio?.state==='suspended')audio.resume();started=true;document.querySelector('#game-shell').classList.add('racing');document.querySelector('#game-shell').classList.remove('paused');karts.forEach(k=>{k.root.visible=true;k.shadow.visible=true;});boxes.forEach(b=>b.group.visible=true);ui.title.classList.add('hidden');ui.finish.classList.add('hidden');ui.pause.classList.add('hidden');ui.hud.classList.remove('hidden');radar.classList.add('active');countdown=3.45;ui.count.classList.remove('hidden');tone(420,.18,'square',.08);}
  function finish(){finished=true;running=false;let p=place();$('final-place').textContent=ordinal(p);$('final-time').textContent=formatTime(raceTime);$('finish-title').textContent=p===1?'WHAT A RACE!':p<=3?'PODIUM FINISH!':'RACE COMPLETE!';$('finish-copy').textContent=p===1?'You left the whole pack in your dust.':'Every turn counts. There’s always the next race.';ui.finish.classList.remove('hidden');document.querySelector('#game-shell').classList.remove('racing');engineGain?.gain.setTargetAtTime(0,audio.currentTime,.1);}
  function clearInput(){for(const key of Object.keys(keys))delete keys[key];pointer.down=false;pointer.steer=0;}
  function setPaused(value){
    if(!started||finished)return;
    paused=value;clearInput();ui.pause.classList.toggle('hidden',!paused);
    document.querySelector('#game-shell').classList.toggle('paused',paused);
    if(paused)audio?.suspend();else audio?.resume();last=performance.now();accumulator=0;
  }
  $('start-button').addEventListener('click',begin);$('again-button').addEventListener('click',begin);$('resume-button').addEventListener('click',()=>setPaused(false));
  window.addEventListener('keydown',e=>{
    const k=e.key.toLowerCase();
    if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
    if(k==='escape'&&!e.repeat){setPaused(!paused);return;}
    if(paused)return;keys[k]=true;
    if((k==='e'||k==='enter')&&!e.repeat&&running)fireItem(player);
    if(k==='r'&&!e.repeat&&running&&player.speed<12){recoverPlayer();}
  });
  window.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
  window.addEventListener('blur',()=>{clearInput();if(started&&!finished)setPaused(true);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(started&&!finished)setPaused(true);}});
  document.querySelectorAll('#touch-controls [data-key]').forEach(button=>{
    const key=button.dataset.key;
    button.addEventListener('pointerdown',e=>{e.preventDefault();if(!paused&&running){button.setPointerCapture(e.pointerId);keys[key]=true;}});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>{keys[key]=false;});
  });
  document.querySelector('[data-action="pause"]').addEventListener('click',()=>setPaused(!paused));
  document.querySelector('[data-action="recover"]').addEventListener('click',()=>{if(running&&!paused&&player.speed<12)recoverPlayer();});
  document.querySelector('[data-action="item"]').addEventListener('pointerdown',e=>{e.preventDefault();if(running&&!paused)fireItem(player);});
  const pointer={down:false,x:0,steer:0};
  canvas.addEventListener('pointerdown',e=>{if(running&&!paused){pointer.down=true;pointer.x=e.clientX;canvas.setPointerCapture(e.pointerId);}});
  canvas.addEventListener('pointermove',e=>{if(pointer.down)pointer.steer=clamp((e.clientX-pointer.x)/85,-1,1);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{pointer.down=false;pointer.steer=0;});
  function recoverPlayer(){
    const f=poseAt(player.s,0,.065);player.worldPos.copy(f.p);player.yaw=yawFor(f.tangent);player.x=0;resetMotion(player);player.spin=0;player.drift=0;player.invulnerable=1.5;notify('BACK ON TRACK');
  }
  window.addEventListener('resize',()=>{w=innerWidth;h=innerHeight;dpr=Math.min(devicePixelRatio||1,1.6);renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();});

  const kartUp=new THREE.Vector3(0,1,0),kartForward=new THREE.Vector3(),kartRight=new THREE.Vector3(),kartBasis=new THREE.Matrix4();
  function updateVehicle(state,kart,dt){
    const f=frameAt(trackT(state.s));kart.root.position.copy(state.worldPos);
    kartUp.copy(state.grounded?f.up:new THREE.Vector3(0,1,0));
    kartForward.set(Math.sin(state.yaw),0,Math.cos(state.yaw));
    kartForward.addScaledVector(kartUp,-kartForward.dot(kartUp)).normalize();
    kartRight.crossVectors(kartUp,kartForward).normalize();kartBasis.makeBasis(kartRight,kartUp,kartForward);
    kart.root.quaternion.slerp(new THREE.Quaternion().setFromRotationMatrix(kartBasis),dt?1-Math.exp(-14*dt):1);
    kart.bodyGroup.rotation.z=state.grounded?state.steering*state.speed/MAX_SPEED*.065:0;
    kart.bodyGroup.position.y=Math.sin(elapsed*22)*Math.min(.025,state.speed*.0003);
    for(const wheel of kart.wheels){wheel.spin.rotation.x-=state.longitudinalSpeed*dt/.42;wheel.pivot.rotation.y=wheel.front?-state.steering*.32:0;}
    kart.flame.visible=state.boost>0; kart.flame.scale.setScalar(.8+Math.sin(elapsed*40)*.18);
    kart.exhaustMat.emissiveIntensity=state.boost>0?3:0;kart.aura.visible=state.star>0;
    if(state.star>0){kart.aura.rotation.y+=dt*3;for(const star of kart.aura.children.slice(1)){star.position.set(Math.cos(star.userData.a+elapsed*2)*star.userData.r,.2+Math.sin(elapsed*4+star.userData.a)*.2,Math.sin(star.userData.a+elapsed*2)*star.userData.r);star.rotation.x+=dt*3;}}
    kart.shadow.position.copy(poseAt(state.s,laneWidth(state.x),.08).p);
    kart.shadow.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),f.up);
    const altitude=Math.max(0,state.worldPos.y-kart.shadow.position.y);kart.shadow.material.opacity=.27/(1+altitude*.25);kart.shadow.scale.setScalar(1+altitude*.08);
  }
  function disposeEffect(mesh){scene.remove(mesh);mesh.traverse(m=>{if(m.geometry)m.geometry.dispose();if(m.material){const materials=Array.isArray(m.material)?m.material:[m.material];for(const material of materials)if(!Object.values(mats).includes(material))material.dispose();}});}
  function hitRacer(state,seconds=1.1){if(state.invulnerable>0||state.star>0||state.finished)return false;state.spin=seconds;state.invulnerable=seconds+1;state.vx*=.55;state.vz*=.55;state.drift=0;if(state===player){shake=.22;sfx('hit');}return true;}
  function moveRacer(state,input,dt){
    const events=advanceRacer(state,input,dt,raceTime);
    const sliding=events.sliding;
    if(events.wallImpact&&state.contactCooldown===0){state.contactCooldown=.45;if(state===player){shake=.1;sfx('hit');}}
    if(events.launched&&state===player){notify('AIR TIME!');sfx('jump');}
    if(events.landed&&state===player){shake=.09;notify('SMOOTH LANDING');}
    if(events.turboTier&&state===player){notify(events.turboTier===2?'ORANGE MINI-TURBO!':'BLUE MINI-TURBO!');sfx('boost');}
    if(sliding&&state===player&&Math.random()<dt*35){spawnParticle(state.worldPos.clone().add(new THREE.Vector3(0,.35,0)),state.driftTier===2?'#ff984c':state.driftTier===1?'#43e6ff':'#bbc8cc',.35,.1);}
    if(state.grounded&&state.padCooldown===0){for(const pad of pads){if(Math.abs(nearestDelta(state.s,pad.t*TRACK))<13&&Math.abs(state.x)<.36){state.boost=1.45;state.padCooldown=1.5;if(state===player){notify('NEON BOOST!');sfx('boost');}break;}}}
    state.speed=Math.hypot(state.vx,state.vz)*3.6;
    if(!Number.isFinite(state.worldPos.y)||state.worldPos.y < -12){if(state===player)recoverPlayer();else{state.worldPos.copy(poseAt(state.s,0,.065).p);resetMotion(state);}}
    if(events.newLap&&state===player){notify(`LAP ${state.lap+1} — KEEP IT UP!`);tone(520,.22,'square',.1,300);}
    if(events.finished&&state===player)state.finishDelay=.35;
    return sliding;
  }
  function step(dt){
    if(paused)return;
    elapsed+=dt;
    if(countdown>0){const previous=Math.ceil(countdown-.45);countdown-=dt;ui.count.textContent=countdown>2.45?'3':countdown>1.45?'2':countdown>.45?'1':'GO!';if(Math.ceil(countdown-.45)<previous)tone(countdown>.45?420:840,.15,'square',.08);if(countdown<=0){ui.count.classList.add('hidden');running=true;}return;}
    if(!running||finished)return;raceTime+=dt;
    if(!player.finished){moveRacer(player,testAutodrive?botInput(player,0,elapsed,[player,...bots]):{throttle:keys.arrowup||keys.w,brake:keys.arrowdown||keys.s,steer:((keys.arrowright||keys.d?1:0)-(keys.arrowleft||keys.a?1:0))||pointer.steer,drift:keys[' ']||keys.shift},dt);}
    else{player.finishDelay-=dt;if(player.finishDelay<=0){finish();return;}}
    bots.forEach((b,i)=>{
      if(b.finished)return;
      moveRacer(b,botInput(b,i,elapsed,[player,...bots]),dt);
      b.cooldown-=dt;
      if(b.item&&b.cooldown<=0){fireItem(b);b.cooldown=5+Math.random()*6;}
    });
    // Separate overlapping bodies once and apply an impulse, with a cooldown.
    for(let i=0;i<karts.length;i++)for(let j=i+1;j<karts.length;j++){
      const a=i===0?player:bots[i-1],b=j===0?player:bots[j-1];if(a.finished||b.finished||Math.abs(a.worldPos.y-b.worldPos.y)>1.5)continue;
      let dx=a.worldPos.x-b.worldPos.x,dz=a.worldPos.z-b.worldPos.z;const distance=Math.hypot(dx,dz);if(distance>=1.95)continue;
      if(distance<.001){dx=1;dz=0;}else{dx/=distance;dz/=distance;}
      const push=(1.95-distance)*.5;a.worldPos.x+=dx*push;a.worldPos.z+=dz*push;b.worldPos.x-=dx*push;b.worldPos.z-=dz*push;
      const closing=(a.vx-b.vx)*dx+(a.vz-b.vz)*dz;if(closing<0){const impulse=-closing*.56;a.vx+=dx*impulse;a.vz+=dz*impulse;b.vx-=dx*impulse;b.vz-=dz*impulse;}
      if(a.star>0)hitRacer(b);else if(b.star>0)hitRacer(a);
      if((a===player||b===player)&&player.contactCooldown===0){player.contactCooldown=.4;shake=.08;if(closing<-2)sfx('hit');}
    }
    for(const box of boxes){if(!box.active){box.respawn-=dt;if(box.respawn<=0){box.active=true;box.group.visible=true;}}else for(const racer of [player,...bots]){if(!racer.finished&&!racer.item&&racer.grounded&&Math.abs(nearestDelta(racer.s,box.s))<7&&Math.abs(racer.x-box.x)<.26){collect(box,racer);break;}}}
    for(const banana of bananas){banana.life-=dt;banana.grace-=dt;for(const racer of [player,...bots]){if(banana.life<=0||racer.finished||!racer.grounded||racer===banana.owner&&banana.grace>0)continue;if(Math.abs(nearestDelta(racer.s,banana.s))<8&&Math.abs(racer.x-banana.x)<.22&&hitRacer(racer)){banana.life=0;if(racer===player)notify('BANANA PEEL!');break;}}}
    for(const p of projectiles){
      p.life-=dt;if(p.type==='red'&&p.target&&!p.target.finished){p.x+=clamp(p.target.x-p.x,-dt*1.65,dt*1.65);}
      const prev=p.s;p.s+=p.speed/3.6/WORLD_PER_UNIT*dt;
      for(const target of [player,...bots]){if(target===p.owner||target.finished||!target.grounded||p.life<=0)continue;
        const ds=nearestDelta(target.s,prev);if(ds>=-6&&ds<=p.s-prev+6&&Math.abs(target.x-p.x)<.26&&hitRacer(target,1.4)){p.life=0;if(target===player)notify('SHELL HIT!');break;}}
    }
    for(const list of [projectiles,bananas])for(let i=list.length-1;i>=0;i--)if(list[i].life<=0){disposeEffect(list[i].mesh);list.splice(i,1);}
    toastLeft=Math.max(0,toastLeft-dt);if(!toastLeft)ui.toast.textContent='';shake=Math.max(0,shake-dt);
    for(const p of particles){p.life-=dt;p.mesh.position.addScaledVector(p.velocity,dt);p.velocity.y-=dt*1.5;p.mesh.material.opacity=Math.max(0,p.life/p.max);p.mesh.scale.setScalar(.45+.9*Math.max(0,p.life/p.max));}
    for(let i=particles.length-1;i>=0;i--)if(particles[i].life<=0){disposeEffect(particles[i].mesh);particles.splice(i,1);}
  }
  function updateRadar(){const cw=radar.width,ch=radar.height,pad=18;rctx.clearRect(0,0,cw,ch);rctx.fillStyle='rgba(5,16,28,.78)';rctx.beginPath();rctx.roundRect(0,0,cw,ch,8);rctx.fill();rctx.strokeStyle='rgba(206,247,244,.14)';rctx.lineWidth=9;rctx.lineJoin='round';rctx.lineCap='round';let points=[];for(let i=0;i<=160;i++){const p=routePoint(i/160);points.push([p.x,p.z]);}const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs),scale=Math.min((cw-pad*2)/(maxX-minX),(ch-pad*2)/(maxZ-minZ));const map=p=>[pad+(p[0]-minX)*scale,pad+(p[1]-minZ)*scale];rctx.beginPath();points.forEach((p,i)=>{const q=map(p);i?rctx.lineTo(q[0],q[1]):rctx.moveTo(q[0],q[1]);});rctx.closePath();rctx.stroke();rctx.strokeStyle='rgba(211,255,239,.45)';rctx.lineWidth=2;rctx.stroke();
    const dot=(s,lane,color,size)=>{const f=poseAt(s,laneWidth(lane),.2),q=map([f.p.x,f.p.z]);rctx.fillStyle=color;rctx.beginPath();rctx.arc(q[0],q[1],size,0,TAU);rctx.fill();};for(const box of boxes)if(box.active)dot(box.s,box.x,'#5af2dd',1.6);for(const b of bots)if(!b.finished)dot(b.s,b.x,b.color,3.2);dot(player.s,player.x,'#d5fa51',4.2);rctx.fillStyle='#d5fa51';rctx.font='bold 9px "DM Mono",monospace';rctx.fillText('TRACK RADAR',10,ch-7);
  }
  const cameraLook=new THREE.Vector3();let accumulator=0,hudClock=0,radarClock=0;
  function render(dt){
    if(!paused){
      if(landscape){landscape.rotor.rotation.z+=dt*.75;landscape.balloons.forEach((b,i)=>b.rotation.z=Math.sin(elapsed*.4+i)*.05);}
      for(const cloud of clouds){cloud.position.x+=cloud.userData.drift*dt;if(cloud.position.x>250)cloud.position.x=-250;}
      for(const pad of pads){const pulse=.5+.5*Math.sin(elapsed*5+pad.phase);pad.g.children.forEach((m,i)=>{if(i>0)m.material.emissiveIntensity=1.2+pulse*2;});}
      for(const box of boxes){if(box.active){const f=poseAt(box.s,box.x*6.25,2.3+Math.sin(elapsed*2.4+box.phase)*.24);box.group.position.copy(f.p);box.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.right,f.up,f.tangent.clone().negate()));box.group.rotateY(elapsed*.6+box.phase);}}
      for(const b of bananas){b.mesh.position.copy(poseAt(b.s,laneWidth(b.x),.25).p);b.mesh.rotation.y+=dt*1.5;}
      for(const p of projectiles){p.mesh.position.copy(poseAt(p.s,laneWidth(p.x),.7).p);p.mesh.rotation.y+=dt*7;p.mesh.rotation.x+=dt*4;}
      updateVehicle(player,playerKart,dt);bots.forEach(b=>updateVehicle(b,b.kart,dt));
    }
    hudClock+=dt;radarClock+=dt;if(radarClock>.08){updateRadar();radarClock=0;}
    if(hudClock>.05){hudClock=0;const rank=place();ui.place.innerHTML=`${rank}<small>${ordinal(rank).slice(String(rank).length)}</small>`;ui.lap.innerHTML=`${lapNumber(player.s,TRACK,TOTAL_LAPS)} <i>/ ${TOTAL_LAPS}</i>`;ui.lapFill.style.width=`${(modTrack(player.s)/TRACK)*100}%`;ui.driftFill.style.width=`${Math.round(player.drift*100)}%`;ui.speed.textContent=String(Math.round(player.speed)).padStart(3,'0');ui.timer.textContent=formatTime(raceTime);
      if(engineOsc){engineOsc.frequency.setTargetAtTime(55+player.speed*1.2,audio.currentTime,.08);engineFilter.frequency.setTargetAtTime(330+player.speed*6,audio.currentTime,.1);engineGain.gain.setTargetAtTime(running&&!finished?.018+player.speed/10000:.002,audio.currentTime,.12);audio.harmonic.frequency.setTargetAtTime(110+player.speed*2.4,audio.currentTime,.08);}}
    if(!paused){
      let forward=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));
      if(player.spin>0)forward.copy(frameAt(trackT(player.s)).tangent).setY(0).normalize();
      const look=player.worldPos.clone().addScaledVector(forward,7);look.y+=1.15;
      const desired=player.worldPos.clone().addScaledVector(forward,-8.7-player.speed*.017);desired.y+=4.7;
      camera.position.lerp(desired,1-Math.exp(-6*dt));cameraLook.lerp(look,1-Math.exp(-9*dt));
      const cameraTrack=projectTrack(camera.position,player.s);camera.position.y=Math.max(camera.position.y,cameraTrack.height+2.1);
      camera.fov+=(63+Math.min(7,player.speed*.045)+(player.boost>0?3:0)-camera.fov)*(1-Math.exp(-3*dt));camera.updateProjectionMatrix();
      camera.lookAt(cameraLook);if(shake){camera.rotation.z+=(Math.random()-.5)*shake*.05;}
    }
    sun.position.copy(player.worldPos).add(new THREE.Vector3(-65,95,45));sun.target.position.copy(player.worldPos);sun.target.updateMatrixWorld();
    renderer.render(scene,camera);
  }
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function frame(now){
    const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;
    if(!paused){accumulator+=dt;while(accumulator>=FIXED_DT){step(FIXED_DT);accumulator-=FIXED_DT;}}
    render(paused?0:dt);
    if(testMode){testFrameStats.frames++;testFrameStats.total+=dt;testFrameStats.max=Math.max(testFrameStats.max,dt);if(testFrameStats.frames%30===0)parent.postMessage({type:'racer-state',running,paused,finished,countdown,raceTime,rank:place(),player:{s:player.s,x:player.x,speed:player.speed,item:player.item,itemCount:player.itemCount,grounded:player.grounded,drift:player.drift,boost:player.boost,spin:player.spin},bots:bots.map(b=>({s:b.s,finished:b.finished})),effects:particles.length+bananas.length+projectiles.length,render:{geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,fps:testFrameStats.frames/Math.max(.01,testFrameStats.total),maxFrame:testFrameStats.max}},location.origin);}
    requestAnimationFrame(frame);
  }
  if(testMode)window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==parent||!event.data?.type?.startsWith('test-'))return;
    const message=event.data;
    if(message.type==='test-start')begin();
    if(message.type==='test-auto')testAutodrive=!!message.value;
    if(message.type==='test-input'){clearInput();for(const key of message.keys||[])keys[key]=true;}
    if(message.type==='test-pause')setPaused(!!message.value);
    if(message.type==='test-item'&&['mushroom','star','red','green','banana'].includes(message.item))setItem(player,message.item);
    if(message.type==='test-fire'&&running&&!paused)fireItem(player);
    if(message.type==='test-hit')hitRacer(player);
  });
  makeWorld();player.yaw=yawFor(frameAt(0).tangent);player.worldPos.copy(poseAt(0,0,.065).p);bots.forEach(b=>updateVehicle(b,b.kart,0));updateVehicle(player,playerKart,0,true);karts.forEach(k=>{k.root.visible=false;k.shadow.visible=false;});boxes.forEach(b=>b.group.visible=false);camera.position.set(0,30,35);cameraLook.copy(player.worldPos);camera.lookAt(cameraLook);syncItem();requestAnimationFrame(frame);
})();
