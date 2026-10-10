const fs=require('node:fs'),path=require('node:path');
const target=path.resolve('..');
if(path.basename(target)!=='LuckyLounge')throw new Error('Unexpected output directory');
// Keep one prior set of hashed assets for tabs already open during a rebuild.
// Copy assets before HTML, without temporarily emptying the live asset folder.
const assetDir=path.join(target,'assets'),manifestPath=path.join(assetDir,'build-manifest.json');
let previous;try{previous=JSON.parse(fs.readFileSync(manifestPath,'utf8')).current;}catch{previous=fs.existsSync(assetDir)?fs.readdirSync(assetDir):[];}
const current=fs.readdirSync('dist/assets');
for(const name of ['assets','images','dino-assets']){const dst=path.join(target,name);if(!dst.startsWith(target+path.sep))throw new Error('Unsafe path');fs.cpSync('dist/'+name,dst,{recursive:true});}
for(const name of ['index.html','plinko-outcomes.json'])fs.copyFileSync('dist/'+name,path.join(target,name));
for(const route of ['plinko','mines','crash','dino','statistics']){fs.mkdirSync(path.join(target,route),{recursive:true});fs.copyFileSync('dist/index.html',path.join(target,route,'index.html'));}
const keep=new Set([...current,...previous,'build-manifest.json']);
for(const file of fs.readdirSync(assetDir)){if(!keep.has(file)&&fs.statSync(path.join(assetDir,file)).isFile())fs.unlinkSync(path.join(assetDir,file));}
fs.writeFileSync(manifestPath,JSON.stringify({current,previous},null,2)+'\n');
