const controls = [
  [-150, 1, -130], [-110, 1, -160], [-40, 1.5, -175],
  [10, 2, -170], [30, 2, -140],
  [60, 3, -120], [35, 4, -90], [70, 5, -60],
  [110, 5, -85], [150, 6, -55],
  [190, 8, -25], [215, 18, 25], [175, 30, 50], [130, 34, 80],
  [135, 16, 125], [115, 8, 155], [65, 7, 150], [30, 6, 135],
  [-10, 5, 150], [-50, 3, 175], [-90, 2, 150],
  [-100, 2, 105], [-145, 1, 90],
  [-195, 1, 90], [-225, 2, 45], [-225, 3, -10],
  [-180, 1, -25], [-170, 1, -80], [-180, 1, -115],
];
const definitions = [
  [0, "meadow", "FESTIVAL MEADOW", "Open road · find your line", 9, "asphalt", "#ffc677"],
  [5, "forest", "PINE HOLLOW", "Link the bends · tap drift to trick", 7.4, "asphalt", "#82bca0"],
  [10, "ridge", "RIDGE OVERLOOK", "Climb · crest · chase the view", 8, "asphalt", "#d1d9ad"],
  [14, "bridge", "LAKESIDE TIMBER", "Hold your line over the water", 6.1, "wood", "#7bd4de"],
  [18, "mill", "WINDMILL WORKS", "Watch the delivery cart", 8.2, "stone", "#ffd48d"],
  [23, "orchard", "ORCHARD RUN", "Inside grass cut · outside turbo", 9, "asphalt", "#f6b884"],
];

export default {
  id: 'windmill-wilds', name: 'Windmill Wilds', description: 'From pine hollow to the working mill. Six places. One wild lap.',
  targetLength: 1500, controls,
  sections: definitions.map(([controlIndex,id,name,hint,halfWidth,material,color]) => ({controlIndex,id,name,hint,halfWidth,material,color,grip:id==='mill'?10:12})),
  ramps: [{section:1,fraction:.55,halfLength:7,height:.9},{section:3,fraction:.52,halfLength:9,height:1.15},{section:5,fraction:.88,halfLength:7,height:.7}],
  pads: [{section:0,fraction:.70,offset:-3.3,duration:.8},{section:2,fraction:.72,offset:0,duration:.8},{section:3,fraction:.78,offset:0,duration:.8},...[.27,.40,.53].map(fraction=>({section:5,fraction,offset:-5.1,duration:.7}))],
  itemRows: [[0,.23],[1,.12],[1,.85],[2,.32],[3,.12],[3,.90],[4,.87],[5,.72]].map(([section,fraction])=>({section,fraction})),
  shortcut: {section:5,startFraction:.10,endFraction:.36,extraWidth:22},
  verges: [
    {section:0,startFraction:.42,endFraction:.69,side:1,extraWidth:11,material:'grass',grip:6,drag:1},
    {section:1,startFraction:.29,endFraction:.63,side:-1,extraWidth:7,material:'needles',grip:8,drag:.8},
    {section:2,startFraction:.37,endFraction:.59,side:-1,extraWidth:5,material:'gravel',grip:10,drag:.7},
  ],
  hazard: {section:4,fraction:.70,kind:'cart',label:'CART CROSSING',parkOffset:10,minOffset:-3,halfWidth:1.35,halfLength:2.15,safeLane:-6,activation:30,period:12,warningSeconds:2},
  theme: {sky:'#56ace2',fog:'#c2e1e6',ground:'#ffffff',road:'#ffffff',shoulder:'#b1afa0',hemisphere:'#bddcf5',ambientGround:'#7e8c6b',ambientIntensity:1.4,sun:'#fff0d5',sunIntensity:2.3,exposure:1.02},
};
