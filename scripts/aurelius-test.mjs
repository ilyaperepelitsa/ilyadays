import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..'),python=resolve(root,'apps/aurelius/.venv/bin/python');
if(!existsSync(python)){console.error('Run npm run aurelius:dev once to create the locked Python environment.');process.exit(1);}
const checks=[
 [process.execPath,['--test','tests/aurelius/provenance.test.mjs','tests/aurelius/discovery.test.mjs','tests/aurelius/real-corpus.test.mjs','tests/aurelius/production.test.mjs','tests/aurelius/annotations.test.mjs','tests/aurelius/book.test.mjs']],
 [python,['-m','pytest','apps/aurelius/tests','-q']],
 [python,['-m','pytest','tests/aurelius/e2e','-q']],
];
for(const [exe,args] of checks){const r=spawnSync(exe,args,{cwd:root,stdio:'inherit',env:{...process.env,PYTHONPATH:resolve(root,'apps/aurelius')}});if(r.status!==0)process.exit(r.status??1);}
