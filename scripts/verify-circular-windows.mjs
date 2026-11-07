import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {prepareGlazingLight} from '../src/harbour/glazing-light.mjs';
import {Scene} from 'three';
import {buildOriginalWorld} from './build-world.mjs';
import {createCoastalLighting} from '../src/harbour/coastal-lighting.mjs';
import {createHarbourTime} from '../src/harbour/harbour-time.mjs';

const bytes=await readFile('public/hk-models/jardine-house.glb');
const model=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
const panes=[];model.traverse(mesh=>{if(mesh.isMesh&&/recessed_circular_glass/i.test(mesh.name))panes.push(mesh);});
assert.equal(panes.length,144,'Check every actual imported Jardine House porthole');
for(const heading of [0,Math.PI/4,Math.PI*.7]){
  model.rotation.y=heading;model.updateMatrixWorld(true);
  for(const pane of panes){
    const original=pane.geometry;
    prepareGlazingLight(pane,{buildingName:'Jardine House'});
    const g=pane.geometry,uv=g.attributes.harbourLightUV;
    assert.deepEqual(g.attributes.position.array,original.attributes.position.array,'Keep the modelled circular glass geometry');
    assert.deepEqual(g.index.array,original.index.array,'Keep the original glass topology');
    assert.ok([...g.attributes.harbourRoundWindow.array].every(value=>value===1),'Imported underscore names select circular diffusion');
    // The authored cylinder has only perimeter vertices. Both faces and the
    // narrow rim must map to the same circle, regardless of facade heading.
    for(let i=0;i<uv.count;i++)assert.ok(Math.abs(Math.hypot(uv.getX(i)-.5,uv.getY(i)-.5)-.5)<1e-6,'Pane-local UVs retain a circular perimeter on all four facades');
    g.dispose();pane.geometry=original;
  }
}
for(const pane of panes)pane.geometry.dispose();
const world=await buildOriginalWorld(),scene=new Scene();scene.add(world.root);
const lighting=createCoastalLighting(scene,world),time=createHarbourTime(scene,world,lighting);time.set(1);
const sources=world.root.userData.windowSpillSources,baseSource=sources.find(source=>source.buildingName==='Jardine House');
assert.ok(baseSource,'The excluded light is identified by its building, not a hardcoded array index');
const actual=[];scene.traverse(object=>{if(object.isPointLight&&object.name==='Coloured window spill')actual.push(object);});
assert.equal(actual.length,sources.length-1,'Only the Jardine House base light is removed');
assert.ok(actual.every(light=>light.position.distanceTo(baseSource.position)>.01),'No floodlight remains at the bright base patch');
for(const source of sources.filter(source=>source!==baseSource)){
  const light=actual.find(light=>light.position.equals(source.position));
  assert.ok(light,'Other buildings retain their original light positions');
  assert.equal(light.intensity,2.8,'Other buildings retain their original night brightness');
}
console.log('Jardine House: 144 original circular panes retain round glow across three headings; base floodlight removed, other spill lights preserved.');
