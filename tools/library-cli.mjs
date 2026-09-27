import { buildIndex, search, context, readSource } from './library-index.mjs';

try {
  const [command='help',...args] = process.argv.slice(2);
  if (command==='help') {
    console.log('Gameref: search [query] [--kind capability|project|demo|example] [--category camera] [--project cloudkeep] [--backend webgl]\ninspect <id> | context <id> | source <id> [file-index] | verify\nAll commands are read-only. JSON output except source. Requires Node 22.18+ for the existing TypeScript lab catalog.');
  } else {
    const index = await buildIndex();
    if (command==='search') {
      const filters={},query=[];
      for(let i=0;i<args.length;i++) {
        if(args[i].startsWith('--')) {const key=args[i].slice(2);if(!['kind','category','project','backend','maturity'].includes(key)||!args[i+1])throw new Error('Unknown or missing filter');filters[key]=args[++i];}
        else query.push(args[i]);
      }
      console.log(JSON.stringify(search(index,{...filters,q:query.join(' ')}),null,2));
    } else if (command==='source') console.log((await readSource(index,args[0],Number(args[1]||0))).content);
    else if (['inspect','context'].includes(command)) console.log(JSON.stringify(context(index,args[0]),null,2));
    else if (command==='verify') {
      const stale=index.records.filter(record=>record.source_freshness!=='current');
      console.log(JSON.stringify({counts:index.counts,lab_error:index.labError,stale:stale.map(record=>record.id),scope:'Source availability and pinned hashes only; not gameplay parity.'},null,2));
      if(stale.length||index.labError)process.exitCode=1;
    } else throw new Error(`Unknown command: ${command}`);
  }
} catch(error) {console.error(error.message);process.exitCode=1;}
