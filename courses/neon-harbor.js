import buildWorld from './neon-harbor-world.js';

// A waterfront loop: boulevard/promenade on the west/north, compact city
// streets to the east, and a supported quay overlooking the southern harbor.
export default {
  id: 'neon-harbor', name: 'Neon Harbor',
  description: 'Market alleys, a luminous waterfront and a working cargo terminal after dark.',
  targetLength: 1500,
  controls: [
    [-155,1,-185], [-100,1,-200], [-40,1,-198], [15,1,-185], [65,1,-165],
    [100,1,-135], [145,1,-135], [130,1,-90], [170,1,-55], [165,1,-5],
    [190,1,20], [210,1,55], [205,2,90], [180,3,125], [155,5,155],
    [130,8,165], [80,18,190], [20,24,205], [-35,20,185], [-75,10,155],
    [-95,3,120], [-145,2,100], [-180,2,70], [-200,2,30], [-210,1,-10],
    [-235,1,-40], [-250,1,-95], [-240,1,-150], [-210,1,-180], [-180,1,-185],
  ],
  sections: [
    {controlIndex:0,id:'promenade',name:'HARBOR PROMENADE',hint:'Waterfront sweep · choose your item lane',halfWidth:9,material:'asphalt',color:'#7af1e6'},
    {controlIndex:5,id:'market',name:'NIGHT MARKET',hint:'Link the alley bends · dock lights ahead',halfWidth:7.8,material:'stone',color:'#ff94cd'},
    {controlIndex:10,id:'warehouse',name:'WAREHOUSE RUN',hint:'Loading hall · follow the dock lights',halfWidth:8.5,material:'stone',color:'#ffcb78'},
    {controlIndex:15,id:'quay',name:'SKYLINE QUAY',hint:'Climb · crest · follow the harbor',halfWidth:8,material:'stone',color:'#8ad9ff'},
    {controlIndex:20,id:'terminal',name:'CARGO TERMINAL',hint:'Amber warning · keep the left lane clear',halfWidth:9,material:'stone',color:'#ffd36c'},
    {controlIndex:25,id:'boulevard',name:'NEON BOULEVARD',hint:'Inside service cut · outside turbo',halfWidth:9,material:'asphalt',color:'#c4a5ff'},
  ],
  ramps:[{section:3,fraction:.48,halfLength:8,height:.8},{section:5,fraction:.86,halfLength:7,height:.65}],
  pads:[{section:0,fraction:.68,offset:-3.6,duration:.8},{section:3,fraction:.84,offset:0,duration:.75},
    ...[.26,.40,.54].map(fraction=>({section:5,fraction,offset:-5.1,duration:.7}))],
  itemRows:[{section:0,fraction:.30},{section:1,fraction:.12},{section:1,fraction:.88},{section:2,fraction:.75},
    {section:3,fraction:.13},{section:4,fraction:.12},{section:4,fraction:.88},{section:5,fraction:.78}],
  shortcut:{section:5,startFraction:.36,endFraction:.72,extraWidth:10},
  elevated:[{section:3,startFraction:.04,endFraction:.88}],
  hazard:{section:4,fraction:.59,kind:'cargo-shuttle',label:'CARGO SHUTTLE · KEEP LEFT',
    parkOffset:12,minOffset:0,halfWidth:1.35,halfLength:2.15,safeLane:-5.5,activation:30,period:12,warningSeconds:2},
  theme:{terrain:'concrete',sky:'#142039',fog:'#26334d',ground:'#334553',road:'#435269',shoulder:'#8194a5',
    hemisphere:'#b4d8ff',ambientGround:'#596988',sun:'#b8d6ff',sunIntensity:1.7,exposure:1.25},
  buildWorld,
};
