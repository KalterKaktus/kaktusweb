import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const {PGlite} = await import(process.env.KAKTUSLIFE_PGLITE_MODULE || '@electric-sql/pglite');

export const ROOT = fileURLToPath(new URL('../../../../',import.meta.url));
export const PEOPLE = [
 {id:'10000000-0000-4000-8000-000000000001',name:'Mila',token:'fixture-host'},
 {id:'20000000-0000-4000-8000-000000000002',name:'Noah',token:'fixture-guest'},
 {id:'30000000-0000-4000-8000-000000000003',name:'Outsider',token:'fixture-outsider'},
];

export async function startIntegrationServer({port=4187}={}) {
 const db = new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role;
 create schema auth; create table auth.users(id uuid primary key);
 create table public.profiles(id uuid primary key references auth.users(id),username text,is_banned boolean default false);`);
 for(const p of PEOPLE) {
  await db.query('insert into auth.users values ($1)',[p.id]);
  await db.query('insert into profiles(id,username) values($1,$2)',[p.id,p.name]);
 }
 const sql = await readFile(resolve(ROOT,'supabase/migrations/20261105120000_kaktuslife.sql'),'utf8');
 await db.exec(sql);
 const {createHandler} = await import(pathToFileURL(resolve(ROOT,'netlify/functions/kaktuslife.mjs')));
 let requests=0;
 const fetchImpl=async(url,options={})=>{
  if(url.endsWith('/auth/v1/user')) {
   const who=PEOPLE.find(p=>options.headers.Authorization === `Bearer ${p.token}`);
   return new Response(JSON.stringify(who ? {id:who.id} : {error:'unauthorized'}),{status:who?200:401});
  }
  const name=url.split('/').at(-1);
  if(!['kaktuslife_snapshot','kaktuslife_lobby','kaktuslife_commit'].includes(name)) throw Error('unexpected RPC '+name);
  const args=JSON.parse(options.body), keys=Object.keys(args);
  if(keys.some(key=>!/^p_[a-z_]+$/.test(key))) throw Error('unexpected RPC key');
  try {
   const query=`select public.${name}(${keys.map((key,i)=>`${key} := $${i+1}`).join(',')}) as result`;
   const result=await db.query(query,keys.map(key=>args[key]));
   requests++;
   // Test clock only: accelerated complete games would otherwise intentionally hit the production rate limiter.
   if(requests%35===0) await db.exec("update public.kaktuslife_requests set created_at=clock_timestamp()-interval '2 minutes'");
   return new Response(JSON.stringify(result.rows[0].result));
  } catch(error) { return new Response(JSON.stringify({message:error.message}),{status:400}); }
 };
 const handler=createHandler({fetchImpl,getEnv:name=>name==='SUPABASE_URL'?'https://fixture.invalid':name==='SUPABASE_SERVICE_ROLE_KEY'?'fixture-service':undefined});
 const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon'};
 const server=createServer(async(req,res)=>{
  try{
   const pathname=new URL(req.url,'http://localhost').pathname;
   if(pathname==='/api/kaktuslife') {
    let chunks=[];for await(const chunk of req)chunks.push(chunk);
    const response=await handler(new Request(`http://localhost:${port}/api/kaktuslife`,{method:req.method,headers:req.headers,body:Buffer.concat(chunks)}));
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
   }
   if(pathname==='/js/auth-nav.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end('// isolated test auth-nav');return;}
   if(pathname==='/js/config.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end("window.SUPABASE_URL='https://fixture.invalid';window.SUPABASE_ANON_KEY='fixture-public';");return;}
   if(pathname==='/js/supabase-client.js') {
    res.writeHead(200,{'Content-Type':'text/javascript'});
    res.end(`export function getSupabase(){return {auth:{async getSession(){const p=JSON.parse(localStorage.getItem('fixture-person')||'null');return {data:{session:p?{access_token:p.token,user:{id:p.id,user_metadata:{username:p.name}}}:null}};}}}};`);return;
   }
   const target=resolve(ROOT,'.'+decodeURIComponent(pathname));
   if(!target.startsWith(resolve(ROOT)+sep)){res.writeHead(403);res.end();return;}
   const info=await stat(target), file=info.isDirectory()?resolve(target,'index.html'):target;
   res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(file));
  }catch(error){res.writeHead(404);res.end('Not found');}
 });
 await new Promise((yes,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',yes);});
 return {db,server,handler,close:async()=>{await new Promise(yes=>server.close(yes));await db.close();}};
}

if(resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)) {
 const running=await startIntegrationServer();console.log('KaktusLife integration fixture http://127.0.0.1:4187');
 process.on('SIGINT',async()=>{await running.close();process.exit();});
}
