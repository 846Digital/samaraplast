import * as THREE from './three.module.min.js';

// A miniature home made of native geometry. No model files or image bundles.
export function mountHome(host,{onSelect,onHover,selected='kitchen'}={}){
 const colors=getComputedStyle(host),color=name=>colors.getPropertyValue('--scene-'+name).trim();
 const P=Object.fromEntries(['ivory','wall','wood','oak','clay','moss','mint','sage','blue','coral','linen','steel','ink','soil','water','gold'].map(name=>[name,color(name)]));
 let renderer;
 try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'})}catch{host.dataset.scene='fallback';return{selectRoom(){},overview(){},destroy(){}}}
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 const canvas=renderer.domElement;canvas.className='room-canvas';canvas.setAttribute('aria-hidden','true');host.append(canvas);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-9,9,6,-6,.1,100);
 camera.position.set(13,14,17);const look=new THREE.Vector3(0,.55,.8);camera.lookAt(look);
 scene.add(new THREE.HemisphereLight(P.ivory,P.moss,2.1));scene.add(new THREE.AmbientLight(P.ivory,.8));
 const sun=new THREE.DirectionalLight(P.ivory,3.2);sun.position.set(-7,14,6);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
 sun.shadow.camera.left=-11;sun.shadow.camera.right=11;sun.shadow.camera.top=11;sun.shadow.camera.bottom=-11;sun.shadow.normalBias=.035;sun.shadow.bias=-.0002;sun.shadow.radius=3;scene.add(sun);
 const rim=new THREE.DirectionalLight(P.blue,1.2);rim.position.set(8,7,-8);scene.add(rim);
 const root=new THREE.Group();scene.add(root);
 const materialCache=new Map(),geometryCache=new Map(),ownedGeometries=new Set();
 const mat=(c,metal=0,rough=.72)=>{const key=[c,metal,rough].join('|');if(!materialCache.has(key))materialCache.set(key,new THREE.MeshStandardMaterial({color:c,metalness:metal,roughness:rough}));return materialCache.get(key)};
 function rounded(w,h,d,r=.045){
  const key=[w,h,d,r].join('|');if(geometryCache.has(key))return geometryCache.get(key);
  r=Math.min(r,w/3,h/3,d/3);const geometry=new THREE.BoxGeometry(w,h,d,4,4,4),a=geometry.attributes.position,v=new THREE.Vector3(),inner=new THREE.Vector3(),normal=new THREE.Vector3();
  for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i);inner.set(THREE.MathUtils.clamp(v.x,-w/2+r,w/2-r),THREE.MathUtils.clamp(v.y,-h/2+r,h/2-r),THREE.MathUtils.clamp(v.z,-d/2+r,d/2-r));normal.copy(v).sub(inner).normalize();v.copy(inner).addScaledVector(normal,r);a.setXYZ(i,v.x,v.y,v.z)}
  geometry.computeVertexNormals();geometryCache.set(key,geometry);ownedGeometries.add(geometry);return geometry;
 }
 function add(geo,material,x,y,z,parent=root){const mesh=new THREE.Mesh(geo,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
 function box(w,h,d,x,y,z,c,parent=root,r=.035){return add(rounded(w,h,d,r),mat(c),x,y,z,parent)}
 function cyl(rt,rb,h,x,y,z,c,parent=root,metal=0){const g=new THREE.CylinderGeometry(rt,rb,h,28);ownedGeometries.add(g);return add(g,mat(c,metal,metal?.28:.65),x,y,z,parent)}
 function sphere(r,x,y,z,c,parent=root){const g=new THREE.SphereGeometry(r,18,12);ownedGeometries.add(g);return add(g,mat(c),x,y,z,parent)}
 function torus(r,t,x,y,z,c,parent=root,rotation=0){const g=new THREE.TorusGeometry(r,t,7,28);ownedGeometries.add(g);const mesh=add(g,mat(c,.25,.35),x,y,z,parent);mesh.rotation.x=rotation;return mesh}
 function tube(points,r,c,parent=root){const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),16,r,7,false);ownedGeometries.add(g);return add(g,mat(c,.5,.28),0,0,0,parent)}
 function mug(x,y,z,c,parent=root,scale=1){cyl(.135*scale,.11*scale,.25*scale,x,y+.125*scale,z,c,parent);const drink=cyl(.108*scale,.108*scale,.009,x,y+.254*scale,z,P.soil,parent);drink.castShadow=false;const handle=torus(.09*scale,.024*scale,x+.14*scale,y+.14*scale,z,c,parent);handle.rotation.y=Math.PI/2}
 function bowl(x,y,z,c,parent=root,r=.23){cyl(r,r*.6,r*.55,x,y+r*.275,z,c,parent);cyl(r*.85,r*.85,.012,x,y+r*.56,z,P.linen,parent)}
 function plant(x,z,size,parent=root){
  const y=.1;cyl(.3*size,.23*size,.48*size,x,y+.24*size,z,P.clay,parent);cyl(.27*size,.27*size,.02,x,y+.487*size,z,P.soil,parent);
  for(let i=0;i<9;i++){const angle=i*2.399,reach=.17*size+(i%3)*.07*size,top=.75*size+(i%4)*.13*size;
   tube([[x,y+.44*size,z],[x+Math.cos(angle)*reach*.5,y+top*.8,z+Math.sin(angle)*reach*.5],[x+Math.cos(angle)*reach,y+top,z+Math.sin(angle)*reach]],.012*size,P.moss,parent);
   const leaf=sphere(.17*size,x+Math.cos(angle)*reach,y+top,z+Math.sin(angle)*reach,i%2?P.moss:P.sage,parent);leaf.scale.set(.7,.21,1.9);leaf.rotation.set(.2,angle,-.3);
  }
 }
 const rooms={};
 function room(id,x,z,w,d,c){const group=new THREE.Group();group.userData.room=id;root.add(group);const floorMat=new THREE.MeshStandardMaterial({color:c,roughness:.86});materialCache.set('floor-'+id,floorMat);const floor=add(rounded(w,.12,d,.025),floorMat,x,0,z,group);group.userData.floor=floor;rooms[id]=group;return group}
 box(12.1,.28,10.1,0,-.23,.75,P.ivory,root,.15);
 box(11.9,.1,9.9,0,-.05,.75,P.wood,root,.04);
 const kitchen=room('kitchen',-3,-1.8,5.7,3.9,P.oak),bath=room('bath',3,-1.8,5.7,3.9,P.mint),textile=room('textile',-3,2.2,5.7,4,P.linen),storage=room('storage',1.4,2.2,3.5,4,P.ivory),care=room('care',4.7,2.2,2.8,4,P.sage),garden=room('garden',1.9,5,6.1,1.5,P.wood);
 // Cutaway walls and a small kitchen window.
 box(11.9,1.85,.16,0,.95,-3.78,P.wall);
 box(.17,1.85,8,-5.9,.95,.2,P.wall);
 box(.12,1.35,3.6,0,.69,-1.9,P.wall);
 box(5.8,.16,.1,-3,1.9,-3.64,P.wood);
 box(1.8,1.05,.07,-3.65,1.18,-3.64,P.blue);
 box(1.92,.08,.12,-3.65,1.74,-3.56,P.ivory);box(1.92,.08,.12,-3.65,.62,-3.56,P.ivory);
 for(const x of [-4.62,-3.65,-2.68])box(.065,1.12,.13,x,1.18,-3.55,P.ivory);
 // Kitchen counter, stove, basin, crockery and breakfast table.
 box(4.8,.83,.95,-3.05,.48,-3.12,P.moss,kitchen,.07);box(4.95,.09,1.08,-3.05,.94,-3.08,P.ivory,kitchen);
 for(const x of [-4.8,-3.9,-3,-2.1,-1.2]){box(.79,.65,.035,x,.48,-2.625,P.sage,kitchen);box(.21,.035,.07,x,.73,-2.585,P.gold,kitchen)}
 box(1.15,.035,.76,-3.95,1.005,-3.08,P.ink,kitchen);
 for(const x of [-4.23,-3.67])for(const z of [-3.29,-2.88])cyl(.17,.17,.02,x,1.035,z,P.steel,kitchen,.65);
 cyl(.3,.26,.4,-4.2,1.25,-3.05,P.blue,kitchen);cyl(.31,.31,.035,-4.2,1.46,-3.05,P.blue,kitchen);cyl(.05,.05,.055,-4.2,1.505,-3.05,P.gold,kitchen);
 box(.88,.025,.66,-1.6,1.008,-3.05,P.steel,kitchen,.12);box(.68,.028,.48,-1.6,1.024,-3.05,P.ink,kitchen,.11);
 tube([[-1.6,1,-3.45],[-1.6,1.44,-3.45],[-1.6,1.48,-3.13],[-1.6,1.3,-3.07]],.026,P.gold,kitchen);
 box(1.55,.08,.35,-1.3,1.6,-3.5,P.wood,kitchen);mug(-1.65,1.65,-3.45,P.clay,kitchen);mug(-1.15,1.65,-3.45,P.ivory,kitchen);
 cyl(.86,.86,.11,-3,.68,-.9,P.wood,kitchen);cyl(.14,.23,.62,-3,.32,-.9,P.wood,kitchen);bowl(-3,.75,-.94,P.clay,kitchen,.25);mug(-3.4,.75,-.75,P.ivory,kitchen);
 for(const [x,z,rot] of [[-4.15,-.7,-.3],[-2,-.2,.3]]){const chair=new THREE.Group();kitchen.add(chair);chair.position.set(x,0,z);chair.rotation.y=rot;box(.63,.1,.64,0,.43,0,P.blue,chair,.08);box(.63,.55,.1,0,.75,-.3,P.blue,chair,.09);for(const a of [-.23,.23])for(const b of [-.23,.23])cyl(.025,.03,.4,a,.2,b,P.wood,chair)}
 // Bathroom: tiled floor, bath, brass tap, vanity and round mirror.
 for(let x=.25;x<5.6;x+=.53)box(.014,.006,3.82,x,.067,-1.8,P.ivory,bath,0);
 for(let z=-3.65;z<.1;z+=.53)box(5.65,.006,.014,3,.068,z,P.ivory,bath,0);
 box(2.55,.59,1.21,2.3,.36,-2.8,P.ivory,bath,.2);box(2.25,.055,.94,2.3,.66,-2.8,P.water,bath,.18);
 tube([[3.75,.1,-2.95],[3.75,1.05,-2.95],[3.36,1.12,-2.95],[3.25,.96,-2.95]],.035,P.gold,bath);
 box(1.12,.74,.65,4.85,.45,-3.15,P.wood,bath);box(1.19,.07,.72,4.85,.86,-3.15,P.ivory,bath);bowl(4.85,.9,-3.1,P.ivory,bath,.3);
 const mirror=cyl(.44,.44,.025,4.85,1.53,-3.65,P.steel,bath,.8);mirror.rotation.x=Math.PI/2;torus(.45,.025,4.85,1.53,-3.62,P.gold,bath);
 box(.9,.035,.4,1.0,.09,-.7,P.linen,bath,.03);box(.9,.035,.4,1.1,.13,-.6,P.clay,bath,.03);plant(5.1,-.55,.74,bath);
 // Textile room: soft sofa, pillows, rug, wooden table and floor lamp.
 box(4.45,.025,3.25,-3, .09,2.15,P.coral,textile,.04);
 for(let z=.7;z<3.6;z+=.22)box(4.27,.007,.012,-3,.107,z,P.linen,textile,0);
 box(3.3,.4,1.25,-3.65,.43,1.4,P.linen,textile,.16);box(3.3,.74,.3,-3.65,.86,.95,P.linen,textile,.13);
 box(.32,.63,1.25,-5.15,.69,1.4,P.linen,textile,.13);box(.32,.63,1.25,-2.15,.69,1.4,P.linen,textile,.13);
 for(const x of [-4.6,-3.7,-2.8])box(.87,.17,.94,x,.71,1.51,P.ivory,textile,.08);
 const pillow1=box(.6,.58,.19,-4.5,1.03,1.18,P.clay,textile,.13);pillow1.rotation.z=-.13;
 const pillow2=box(.6,.58,.19,-2.75,1.03,1.18,P.moss,textile,.13);pillow2.rotation.z=.13;
 cyl(.66,.66,.09,-2.9,.47,3.1,P.wood,textile);cyl(.11,.16,.43,-2.9,.23,3.1,P.wood,textile);
 box(.47,.05,.34,-2.8,.56,3.05,P.blue,textile);box(.38,.04,.3,-2.85,.6,3.05,P.linen,textile);bowl(-3.18,.54,3.22,P.clay,textile,.17);
 cyl(.022,.025,1.9,-5.1,1.03,3.55,P.gold,textile);cyl(.29,.29,.035,-5.1,.1,3.55,P.ink,textile);const globe=sphere(.3,-5.1,2.04,3.55,P.ivory,textile);globe.material=new THREE.MeshStandardMaterial({color:P.ivory,emissive:P.gold,emissiveIntensity:.22});materialCache.set('lamp',globe.material);
 // Open storage shelves filled with folded textiles and useful boxes.
 box(2.45,2.12,.11,1.5,1.15,1.03,P.wood,storage);
 for(const x of [.23,2.77])box(.1,2.2,.65,x,1.15,1.3,P.wood,storage);
 for(const y of [.14,.78,1.42,2.15])box(2.65,.09,.75,1.5,y,1.32,P.wood,storage);
 for(const [x,c] of [[.8,P.mint],[1.8,P.clay]]){box(.75,.45,.62,x,.43,1.37,c,storage,.06);box(.78,.05,.65,x,.68,1.37,P.ivory,storage,.02)}
 for(let i=0;i<3;i++)box(.78,.11,.58,.85,.88+i*.12,1.36,i===1?P.coral:P.linen,storage,.05);
 cyl(.34,.3,.4,2.05,1.03,1.36,P.oak,storage);for(let i=0;i<3;i++)box(.95,.07,.6,1.1,1.53+i*.08,1.34,i%2?P.sage:P.ivory,storage);
 box(1.24,.47,.8,1.5,.37,3.25,P.mint,storage,.08);box(1.29,.055,.86,1.5,.63,3.25,P.ivory,storage,.035);
 // Cleaning nook, laundry basket and simple bottles.
 box(1.75,1.8,.17,4.5,.97,1.1,P.wall,care,.04);box(1.7,.08,.7,4.5,1.85,1.36,P.wood,care);
 const broom=cyl(.03,.03,1.48,4.85,.88,1.8,P.wood,care);broom.rotation.z=-.12;box(.61,.17,.27,4.94,.17,1.8,P.clay,care,.05);
 cyl(.34,.29,.47,4,.33,2,P.blue,care);torus(.3,.018,4,.6,2,P.gold,care,Math.PI/2);
 for(const [x,c] of [[4.04,P.mint],[4.4,P.clay],[4.75,P.ivory]]){cyl(.08,.09,.28,x,2.03,1.4,c,care);cyl(.035,.035,.08,x,2.21,1.4,P.ink,care)}
 cyl(.5,.42,.73,4.5,.47,3.25,P.oak,care);cyl(.51,.51,.05,4.5,.86,3.25,P.linen,care);
 // Front terrace / garden.
 for(let x=-1.05;x<4.9;x+=.24)box(.013,.006,1.43,x,.068,5,P.soil,garden,0);
 plant(-.25,5,.95,garden);plant(1.3,4.95,1.3,garden);plant(3.15,5,.8,garden);plant(4.1,5.1,.6,garden);
 const groundGeometry=new THREE.PlaneGeometry(200,200);ownedGeometries.add(groundGeometry);const shadowMaterial=new THREE.ShadowMaterial({opacity:.22});materialCache.set('shadow',shadowMaterial);const ground=add(groundGeometry,shadowMaterial,0,-.4,0,scene);ground.rotation.x=-Math.PI/2;ground.castShadow=false;
 let disposed=false,frame=0,hoverId=null,activeId=null;
 const pointer=new THREE.Vector2(9,9),raycaster=new THREE.Raycaster(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function render(){frame=0;if(disposed||!host.isConnected)return;camera.lookAt(look);renderer.render(scene,camera)}
 function schedule(){if(!frame&&!disposed)frame=requestAnimationFrame(render)}
 function resize(){const {width,height}=host.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height,false);const aspect=width/height,worldHeight=Math.max(10.7,17.6/aspect),worldWidth=worldHeight*aspect;camera.left=-worldWidth/2;camera.right=worldWidth/2;camera.top=worldHeight/2;camera.bottom=-worldHeight/2;camera.updateProjectionMatrix();schedule()}
 function selectRoom(id,{immediate=false}={}){
  if(!rooms[id]||disposed||(id===activeId&&!immediate))return;activeId=id;
  for(const [key,group] of Object.entries(rooms)){
   const target=key===id ? .18 : 0;
   if(window.gsap&&!reduced.matches&&!immediate)gsap.to(group.position,{y:target,duration:.65,ease:'power2.out',overwrite:true,onUpdate:schedule});else group.position.y=target;
   group.userData.floor.material.emissive.set(key===id?P.gold:P.ink);group.userData.floor.material.emissiveIntensity=key===id ? .1 : 0;
  }
  const point=rooms[id].userData.floor.position,target={x:point.x*.12,y:.55,z:.8+(point.z-.8)*.1};
  if(window.gsap&&!reduced.matches&&!immediate)gsap.to(look,{...target,duration:.8,ease:'power3.out',overwrite:true,onUpdate:schedule});else look.set(target.x,target.y,target.z);
  schedule();
 }
 function hit(event){const r=canvas.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const intersections=raycaster.intersectObjects(Object.values(rooms),true);let object=intersections[0]?.object;while(object&&!object.userData.room)object=object.parent;return object?.userData.room||null}
 const swayX=window.gsap?gsap.quickTo(root.rotation,'x',{duration:.8,ease:'power2.out',overwrite:'auto',onUpdate:schedule}):null;
 const swayY=window.gsap?gsap.quickTo(root.rotation,'y',{duration:.8,ease:'power2.out',overwrite:'auto',onUpdate:schedule}):null;
 let moveFrame=0,lastEvent=null;
 function move(event){lastEvent=event;if(moveFrame)return;moveFrame=requestAnimationFrame(()=>{moveFrame=0;const id=hit(lastEvent);canvas.style.cursor=id?'pointer':'default';if(!reduced.matches&&lastEvent.pointerType!=='touch'){swayX?.(pointer.y*.018);swayY?.(pointer.x*.045)}if(id!==hoverId){hoverId=id;onHover?.(id)}})}
 function click(event){const id=hit(event);if(id)onSelect?.(id)}
 function leave(){hoverId=null;canvas.style.cursor='default';if(!reduced.matches){swayX?.(0);swayY?.(0)}onHover?.(null)}
 canvas.addEventListener('pointermove',move);canvas.addEventListener('click',click);canvas.addEventListener('pointerleave',leave);
 function contextLost(event){if(disposed)return;event.preventDefault();canvas.hidden=true;host.dataset.scene='fallback'}
 function contextRestored(){if(disposed)return;canvas.hidden=false;host.dataset.scene='ready';schedule()}
 canvas.addEventListener('webglcontextlost',contextLost);canvas.addEventListener('webglcontextrestored',contextRestored);
 const observer=new ResizeObserver(resize);observer.observe(host);resize();selectRoom(selected,{immediate:true});render();host.dataset.scene='ready';
 if(window.gsap&&!reduced.matches){root.position.y=-.4;gsap.to(root.position,{y:0,duration:1.15,ease:'power3.out',onUpdate:schedule});root.rotation.y=-.12;gsap.to(root.rotation,{y:0,duration:1.4,ease:'power3.out',onUpdate:schedule})}
 function motionChange(){if(reduced.matches){window.gsap?.killTweensOf(look);window.gsap?.killTweensOf(root.position);window.gsap?.killTweensOf(root.rotation);root.position.y=0;root.rotation.y=0;for(const group of Object.values(rooms))window.gsap?.killTweensOf(group.position);selectRoom(activeId,{immediate:true});schedule()}}
 reduced.addEventListener('change',motionChange);
 return{selectRoom,overview(){if(window.gsap&&!reduced.matches){gsap.to(look,{x:0,y:.55,z:.8,duration:.8,ease:'power3.out',overwrite:true,onUpdate:schedule});swayX?.(0);swayY?.(0)}else{look.set(0,.55,.8);schedule()}},destroy(){if(disposed)return;disposed=true;observer.disconnect();cancelAnimationFrame(frame);cancelAnimationFrame(moveFrame);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('click',click);canvas.removeEventListener('pointerleave',leave);canvas.removeEventListener('webglcontextlost',contextLost);canvas.removeEventListener('webglcontextrestored',contextRestored);reduced.removeEventListener('change',motionChange);if(window.gsap){gsap.killTweensOf(root.position);gsap.killTweensOf(root.rotation);gsap.killTweensOf(look);for(const group of Object.values(rooms))gsap.killTweensOf(group.position)}for(const geometry of ownedGeometries)geometry.dispose();for(const material of materialCache.values())material.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove()}};
}
