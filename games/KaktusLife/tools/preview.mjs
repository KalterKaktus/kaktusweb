// Dependency-free static preview. Online rooms require the deployed Netlify function.
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const port=Number(process.env.KAKTUSLIFE_PREVIEW_PORT || 4178);
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon'};
createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/api/kaktuslife'){
   res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});
   res.end(JSON.stringify({error:'life.errors.unavailable'}));return;
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  const file=resolve(root,'.'+pathname);
  if(!file.startsWith(resolve(root)+sep)||pathname.split('/').some(part=>part.startsWith('.')||part==='node_modules')){res.writeHead(403);res.end();return;}
  const info=await stat(file),target=info.isDirectory()?resolve(file,'index.html'):file;
  res.writeHead(200,{'Content-Type':types[extname(target)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(req.method==='HEAD'?undefined:await readFile(target));
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`KaktusLife: http://127.0.0.1:${port}/games/KaktusLife/ (local two-person practice)`));
