import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
export default defineConfig({
 base:'/games/LuckyLounge/', plugins:[react(), {name:'host-modules',configureServer(server){
  server.middlewares.use((req,res,next)=>{
   const url=(req.url||'').split('?')[0];
   if (!/^\/(js|css|auth|profile)\//.test(url) && !['/login.html','/styles.css','/favicon-32x32.png','/favicon-16x16.png','/games/LuckyLounge/js/wallet.js','/games/LuckyLounge/js/audio.js'].includes(url)) return next();
   const root=path.resolve('../../..');
   let file=path.resolve(root,'.'+url);
   if(!file.startsWith(root+path.sep))return next();
   if(url.endsWith('/'))file=path.join(file,'index.html');
   try{res.setHeader('Content-Type',file.endsWith('.json')?'application/json':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.woff2')?'font/woff2':'text/javascript');res.end(fs.readFileSync(file));}catch{next();}
  });
 }}],
 server:{port:5173,open:false},
 build:{target:'esnext',outDir:'dist',emptyOutDir:true,rollupOptions:{external:['/js/i18n.js','/games/LuckyLounge/js/wallet.js','/games/LuckyLounge/js/audio.js']}}
});
