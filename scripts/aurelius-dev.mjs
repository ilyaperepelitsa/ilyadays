import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..'),python=resolve(root,'apps/aurelius/.venv/bin/python');
if(!existsSync(python)){
  const setup=spawnSync('uv',['venv','apps/aurelius/.venv','--python','3.12'],{cwd:root,stdio:'inherit'});
  if(setup.status!==0){console.error('Install uv, then rerun npm run aurelius:dev.');process.exit(1);}
  const install=spawnSync('uv',['pip','sync','--python',python,'apps/aurelius/requirements.lock'],{cwd:root,stdio:'inherit'});if(install.status!==0)process.exit(1);
}
const uiPort=Number(process.env.AURELIUS_UI_PORT??3150),apiPort=Number(process.env.AURELIUS_API_PORT??8766);
if(![uiPort,apiPort].every(p=>Number.isInteger(p)&&p>=1024&&p<=65535)||uiPort===apiPort)throw Error('Choose distinct loopback ports between 1024 and 65535');
const children=[];
let closing=false;
function stop(code=0){if(closing)return;closing=true;for(const child of children)child.kill('SIGTERM');setTimeout(()=>process.exit(code),300).unref();}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>stop());
const backend=spawn(python,['-m','uvicorn','aurelius.api:create_app','--factory','--host','127.0.0.1','--port',String(apiPort)],{cwd:resolve(root,'apps/aurelius'),env:process.env,stdio:'inherit'});children.push(backend);
const frontend=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port',String(uiPort)],{cwd:root,env:{...process.env,AURELIUS_LOCAL_SERVICE:'1',NEXT_PUBLIC_AURELIUS_LOCAL:'1'},stdio:'inherit'});children.push(frontend);
for(const child of children){child.on('error',error=>{console.error(error.message);stop(1);});child.on('exit',code=>{if(!closing)stop(code??1);});}
console.log(`Aurelius: http://127.0.0.1:${uiPort}/stoicism — private loopback workspace; synthetic corpus until Stage 2.`);
