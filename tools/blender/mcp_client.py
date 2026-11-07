"""Use the installed MCP server from this build session without restarting Codex.

Usage: python mcp_client.py [--file build_city.py | --code 'print(...)' | --list]
"""
import asyncio, json, os, sys
from datetime import timedelta
from pathlib import Path
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    env = dict(os.environ, DISABLE_TELEMETRY='true', BLENDER_HOST='127.0.0.1')
    command = str(Path.home()/'.local/bin/mcp-for-blender.exe')
    async with stdio_client(StdioServerParameters(command=command, env=env)) as (read, write):
        async with ClientSession(read, write, read_timeout_seconds=timedelta(seconds=240)) as client:
            await client.initialize()
            if '--list' in sys.argv:
                result=await client.list_tools()
                print(json.dumps([{'name':t.name,'schema':t.inputSchema} for t in result.tools],indent=2))
                return
            if '--file' in sys.argv:
                path=str(Path(sys.argv[sys.argv.index('--file')+1]).resolve())
                code=f"from pathlib import Path\nexec(compile(Path({path!r}).read_text(encoding='utf-8'), {path!r}, 'exec'), {{'__name__':'__main__','__file__':{path!r}}})"
            elif '--code' in sys.argv:
                code=sys.argv[sys.argv.index('--code')+1]
            else:
                result=await client.call_tool('get_scene_info',{})
                for item in result.content:
                    if hasattr(item,'text'):print(item.text)
                return
            if '--defer' in sys.argv:
                code=f"import bpy\ndef _nocturne_job():\n    exec({code!r}, {{'__name__':'__main__'}})\n    return None\nbpy.app.timers.register(_nocturne_job, first_interval=1.0)\nprint('Build scheduled. Progress: assets/blender/build-status.json')"
            result=await client.call_tool('execute_blender_code',{'code':code,'user_prompt':'Create the original Blender city assets for the local portfolio project.'})
            for item in result.content:
                if hasattr(item,'text'):
                    print(item.text)
                    if item.text.startswith('Error'):sys.exit(1)
            if result.isError:sys.exit(1)
asyncio.run(main())
