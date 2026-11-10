import fs from 'node:fs';
import { upgradeFixture } from '../src/lib/aurelius/upgrade.mjs';
import { upgradeStudy } from '../src/lib/aurelius/study-upgrade.mjs';
const seed=JSON.parse(fs.readFileSync(new URL('../content/aurelius/fixture.json',import.meta.url),'utf8'));
let input='';for await(const chunk of process.stdin)input+=chunk;
try{const value=JSON.parse(input);process.stdout.write(JSON.stringify(value.mode==='study'?upgradeStudy(value.workspace,value.seed):upgradeFixture(value,seed)));}catch(error){process.stderr.write(error.message);process.exitCode=1;}
