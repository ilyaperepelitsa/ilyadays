// Private local bridge: stdin/stdout JSON only. No file reads from user paths or external calls.
import { applyCommand } from '../src/lib/aurelius/domain.mjs';
let input='';
for await(const chunk of process.stdin){input+=chunk;if(input.length>4_000_000)throw Error('Workspace payload too large');}
try { const {workspace,command}=JSON.parse(input);process.stdout.write(JSON.stringify(await applyCommand(workspace,command))); }
catch(error){process.stderr.write(error.message);process.exitCode=1;}
