// Queries are read only after the frame fence completes; never wait for the GPU.
export function createGpuFrameTimer(gl) {
  const extension=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const query=extension?gl.createQuery():null;
  return {
    begin(){if(query)gl.beginQuery(extension.TIME_ELAPSED_EXT,query);},
    end(){if(query)gl.endQuery(extension.TIME_ELAPSED_EXT);},
    read(){
      if(!query||gl.getParameter(extension.GPU_DISJOINT_EXT)
        ||!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE))return;
      return gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6;
    },
    dispose(){if(query)gl.deleteQuery(query);},
  };
}
