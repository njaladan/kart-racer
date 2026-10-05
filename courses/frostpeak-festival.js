import { buildWorld } from './frostpeak-festival-world.js';

// Clockwise mountain loop: west village, winding northern forest, high eastern
// ridge, sweeping descent, southern rink, and the inside-right southwest cut.
export default {
  id: 'frostpeak-festival',
  name: 'Frostpeak Festival',
  description: 'Snowy slalom, a summit reveal, and a playful mountain descent.',
  targetLength: 1540,
  controls: [
    [-205,2,-80],[-195,2,-155],[-145,2,-205],[-80,3,-210],[-35,4,-190],
    [15,5,-210],[60,7,-180],[90,10,-205],[130,13,-160],[155,18,-130],
    [175,24,-100],[145,37,-40],[205,49,-10],[210,54,40],[180,52,85],
    [210,42,130],[175,29,180],[100,16,210],[45,8,185],[5,4,205],
    [-45,2,210],[-100,2,195],[-145,2,205],[-200,2,195],
    [-245,2,185],[-260,2,135],[-240,2,0],[-215,2,-40],
  ],
  sections: [
    {controlIndex:0,id:'village',name:'VILLAGE SQUARE',hint:'Find your line · festival ahead',halfWidth:9,material:'asphalt',color:'#ef7686'},
    {controlIndex:5,id:'pines',name:'PINE SLALOM',hint:'Link the snowy bends · trick the roller',halfWidth:8.2,material:'asphalt',color:'#74d5d9'},
    {controlIndex:10,id:'summit',name:'SUMMIT CLIMB',hint:'Climb to the crest · see the resort',halfWidth:8.7,material:'asphalt',color:'#b2cee9'},
    {controlIndex:15,id:'descent',name:'PANORAMIC DESCENT',hint:'Bank through the sweep · soft landing',halfWidth:8.5,material:'asphalt',color:'#ffd36e'},
    {controlIndex:19,id:'rink',name:'ICE-RINK BEND',hint:'Blue ice · recover before the groomer',halfWidth:9.5,material:'asphalt',color:'#8cdef6'},
    {controlIndex:23,id:'grandstands',name:'GRANDSTAND FINISH',hint:'Inside powder cut · outside turbo',halfWidth:9,material:'asphalt',color:'#f88fa2'},
  ],
  surfaces:[{section:4,startFraction:.12,endFraction:.45,material:'ice',grip:8.5}],
  ramps:[{section:1,fraction:.50,halfLength:8,height:.7},{section:3,fraction:.30,halfLength:10,height:.8}],
  pads:[{section:0,fraction:.67,offset:-3.4,duration:.75},{section:2,fraction:.83,offset:0,duration:.75},
    {section:3,fraction:.79,offset:-3.4,duration:.7},
    ...[.23,.36,.49].map(fraction=>({section:5,fraction,offset:-5.5,duration:.65}))],
  itemRows:[{section:0,fraction:.29},{section:1,fraction:.12},{section:1,fraction:.88},
    {section:2,fraction:.32},{section:3,fraction:.65},{section:4,fraction:.05},{section:4,fraction:.95},{section:5,fraction:.72}],
  shortcut:{section:5,startFraction:.07,endFraction:.32,extraWidth:20,drag:1.25},
  hazard:{section:4,fraction:.78,kind:'groomer',label:'GROOMER CROSSING',parkOffset:12,minOffset:0,
    halfWidth:1.35,halfLength:2.15,safeLane:-5.5,activation:30,period:12,warningSeconds:2},
  theme:{terrain:'snow',sky:'#b8def2',fog:'#d8e9f2',ground:'#e9f2f7',road:'#d5e1e9',shoulder:'#d6e6ed',
    hemisphere:'#dcf6ff',ambientGround:'#829baa',sun:'#fff1cc',sunIntensity:2.2,exposure:1.05},
  buildWorld,
};
