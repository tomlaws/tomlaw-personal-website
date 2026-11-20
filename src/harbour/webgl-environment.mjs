import { DataTexture, RGBAFormat, HalfFloatType } from 'three';
import { readEnvironmentResponse } from './environment-data.mjs';

// Three's node PMREM samples direction.y with the opposite sign to WebGL.
// Reorient each packed cube/mip by permuting texels, without resampling them.
export function webGLCubeUV(entry) {
  const {width,height,data}=entry, cubeSize=height/4, maxMip=Math.log2(cubeSize);
  if (!Number.isInteger(maxMip)||maxMip<4) throw new Error('Unsupported prepared PMREM dimensions');
  const output=data.slice();
  for(let mip=maxMip;mip>=-2;mip--) {
    const size=2**Math.max(4,mip),xOffset=Math.max(4-mip,0)*48,yOffset=4*(cubeSize-size);
    for(let face=0;face<6;face++) {
      const sourceFace=face===1?4:face===4?1:face;
      for(let y=0;y<size;y++) {
        const from=((yOffset+(sourceFace>2?size:0)+size-1-y)*width+xOffset+(sourceFace%3)*size)*4;
        const to=((yOffset+(face>2?size:0)+y)*width+xOffset+(face%3)*size)*4;
        output.set(data.subarray(from,from+size*4),to);
      }
    }
  }
  return output;
}

// Reuse the existing full-resolution PMREM asset instead of generating both
// skies and every roughness mip on the phone at each cold start.
export async function loadWebGLEnvironments(url, fetcher = fetch) {
  const response=await fetcher(url,{signal:AbortSignal.timeout(15_000)});
  const entries=await readEnvironmentResponse(response);
  return entries.map(entry => {
    const texture=new DataTexture(webGLCubeUV(entry),entry.width,entry.height,RGBAFormat,HalfFloatType);
    Object.assign(texture,{mapping:entry.mapping,minFilter:entry.minFilter,magFilter:entry.magFilter,
      colorSpace:entry.colorSpace,flipY:entry.flipY,generateMipmaps:false,needsUpdate:true});
    return texture;
  });
}
