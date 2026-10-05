import { buildWorld } from './sunstone-ruins-world.js';

// A clockwise expedition: the final sustained right bend puts the sand on
// the inside, while the temple approach faces the monument from the ridge.
export default {
  id: 'sunstone-ruins', name: 'Sunstone Ruins',
  description: 'An oasis, a sandstone canyon, and an ancient temple revealed from the ridge.',
  targetLength: 1500,
  controls: [
    [-170,1,-170],[-125,1,-185],[-70,1,-195],[-10,2,-185],[45,2,-170],
    [85,3,-140],[125,5,-125],[110,7,-85],[150,8,-60],[160,10,-25],
    [190,14,10],[225,22,45],[225,31,90],[195,34,120],[160,22,145],
    [120,11,170],[70,7,180],[35,6,160],[-5,5,175],[-45,5,170],
    [-85,4,160],[-120,4,140],[-160,3,120],[-165,3,80],[-190,2,50],
    [-215,2,10],[-250,2,-45],[-220,2,-105],[-170,1,-130],[-180,1,-145],
  ],
  sections: [
    {controlIndex:0,id:'oasis',name:'OASIS RUN',hint:'Flow beside the water · choose an item lane',halfWidth:9,material:'asphalt',color:'#edcd83'},
    {controlIndex:5,id:'canyon',name:'SANDSTONE CANYON',hint:'Link shaded bends · watch the bright exit',halfWidth:7.8,material:'asphalt',color:'#ce9868'},
    {controlIndex:10,id:'ridge',name:'RIDGE OVERLOOK',hint:'Climb to the temple reveal',halfWidth:8.5,material:'asphalt',color:'#f0cc93'},
    {controlIndex:15,id:'temple',name:'TEMPLE GATE',hint:'Enter the monument · follow the stone road',halfWidth:8,material:'stone',color:'#a9a6c6',grip:11},
    {controlIndex:20,id:'courtyard',name:'PILLARED COURTYARD',hint:'Read the glowing runes · pass on the left',halfWidth:9,material:'stone',color:'#dbc693',grip:11},
    {controlIndex:25,id:'dunes',name:'DUNE-SIDE FINISH',hint:'Saved mushroom for sand · outside turbo line',halfWidth:9,material:'asphalt',color:'#f1cf87'},
  ],
  ramps: [{section:1,fraction:.62,halfLength:7,height:.8},{section:2,fraction:.56,halfLength:8,height:.7}],
  pads: [{section:0,fraction:.73,offset:-3.3,duration:.8},{section:2,fraction:.78,offset:0,duration:.8},
    {section:3,fraction:.85,offset:2.7,duration:.7},
    ...[.28,.58].map(fraction=>({section:5,fraction,offset:-5.2,duration:.45}))],
  itemRows: [{section:0,fraction:.26},{section:1,fraction:.10},{section:1,fraction:.85},
    {section:2,fraction:.25},{section:3,fraction:.12},{section:3,fraction:.78},
    {section:4,fraction:.90},{section:5,fraction:.80}],
  shortcut:{section:5,startFraction:.28,endFraction:.65,extraWidth:22},
  hazard:{section:4,fraction:.64,kind:'stone',label:'ANCIENT SHUTTLE',parkOffset:12,minOffset:0,
    halfWidth:1.35,halfLength:2.15,safeLane:-5.5,activation:30,period:12,warningSeconds:2},
  theme:{terrain:'sand',sky:'#e3bd82',fog:'#e5c493',ground:'#d7b56d',road:'#ead9bb',shoulder:'#efe0af',
    hemisphere:'#fff3d4',ambientGround:'#6e5c68',sun:'#fff0c6',sunIntensity:2.3,exposure:1.08},
  buildWorld,
};
