import {Lighting,LightsNode,NodeUpdateType,Vector3,Vector4} from 'three/webgpu';
import {nodeObject,uniform,uniformArray,Loop,Fn,positionView,directPointLight,renderGroup} from 'three/tsl';

export class CompactLightsNode extends LightsNode{
  static get type(){return 'CompactLightsNode';}
  constructor(){super();this.allLights=[];this.points=[];this.countNode=uniform(0,'int').setGroup(renderGroup);this.updateBeforeType=NodeUpdateType.RENDER;}
  setLights(lights){
    this.allLights=lights;this.points=lights.filter(light=>light.isPointLight&&!light.castShadow&&!light.colorNode);
    this.countNode.value=this.points.length;
    if(this.positions?.length!==this.points.length&&this.points.length){
      this.positions=this.points.map(()=>new Vector4());this.colours=this.points.map(()=>new Vector4());
      this.positionNode=uniformArray(this.positions,'vec4').setGroup(renderGroup);this.colourNode=uniformArray(this.colours,'vec4').setGroup(renderGroup);
    }
    return super.setLights(lights.filter(light=>!this.points.includes(light)));
  }
  // NodeMaterial adds its environment/occlusion nodes by cloning this list.
  // Include the point lights as well as the analytic lights in that copy.
  getLights(){return this.allLights;}
  get hasLights(){return super.hasLights||this.points.length>0;}
  customCacheKey(){return super.customCacheKey()+this.points.length*65537;}
  getHash(builder){return `${super.getHash(builder)}-compact-${this.points.map(light=>light.id).join(',')}`;}
  setupLights(builder,nodes){
    const context=builder.context.reflectedLight;
    context.directDiffuse.toStack();context.directSpecular.toStack();
    super.setupLights(builder,nodes);
    if(!this.points.length)return;
    const positions=this.positionNode,colours=this.colourNode;
    const surfacePosition=builder.context.positionView||positionView;
    Fn(()=>{
      Loop(this.countNode,({i})=>{
        const position=positions.element(i),colour=colours.element(i);
        builder.lightsNode.setupDirectLight(builder,this,directPointLight({
          color:colour.rgb,lightVector:position.xyz.sub(surfacePosition),cutoffDistance:position.w,decayExponent:colour.w,
        }));
      });
    },'void')();
  }
  updateBefore({camera}){
    if(!this.positions)return;
    const position=new Vector3();
    this.points.forEach((light,index)=>{
      position.setFromMatrixPosition(light.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
      this.positions[index].set(position.x,position.y,position.z,light.distance);
      this.colours[index].set(light.color.r*light.intensity,light.color.g*light.intensity,light.color.b*light.intensity,light.decay);
    });
  }
}
export class CompactLighting extends Lighting{
  createNode(lights=[]){return nodeObject(new CompactLightsNode()).setLights(lights);}
}
