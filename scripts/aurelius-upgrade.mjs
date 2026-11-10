import fs from 'node:fs';
import { upgradeFixture } from '../src/lib/aurelius/upgrade.mjs';
const seed=JSON.parse(fs.readFileSync(new URL('../content/aurelius/fixture.json',import.meta.url),'utf8'));
let input='';for await(const chunk of process.stdin)input+=chunk;
try{process.stdout.write(JSON.stringify(upgradeFixture(JSON.parse(input),seed)));}catch(error){process.stderr.write(error.message);process.exitCode=1;}
