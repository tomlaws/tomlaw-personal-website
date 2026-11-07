import * as T from 'three';

// Render identical leaf shapes together, retaining every tree's original pose,
// colour, wind motion and physical shadows.
export function createCanopyInstances(root,trees){
  const batches=[];
  for(const tree of trees)for(const leaf of tree.children){
    if(!leaf.isMesh)continue;
    let batch=batches.find(b=>b.geometry===leaf.geometry&&b.material===leaf.material);
    if(!batch){batch={geometry:leaf.geometry,material:leaf.material,leaves:[]};batches.push(batch);}
    batch.leaves.push({leaf,tree});leaf.visible=false;
  }
  const group=new T.Group();group.name='Instanced tree canopies';root.add(group);
  for(const batch of batches){
    batch.mesh=new T.InstancedMesh(batch.geometry,batch.material,batch.leaves.length);
    batch.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    batch.mesh.castShadow=true;batch.mesh.receiveShadow=true;batch.mesh.frustumCulled=false;
    group.add(batch.mesh);
  }
  const matrix=new T.Matrix4();
  function update(){
    for(const tree of trees)tree.updateMatrix();
    for(const batch of batches){
      batch.leaves.forEach(({leaf,tree},index)=>{
        leaf.updateMatrix();matrix.multiplyMatrices(tree.matrix,leaf.matrix);batch.mesh.setMatrixAt(index,matrix);
      });
      batch.mesh.instanceMatrix.needsUpdate=true;
    }
  }
  update();return update;
}
