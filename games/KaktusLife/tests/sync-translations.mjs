// Rebuild only the life namespace; retain all other games' dictionary text/formatting.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {TRANSLATIONS} from '../shared/catalog.mjs';
import {UI_TRANSLATIONS} from '../js/translations.mjs';
import {ERROR_TRANSLATIONS} from '../js/errors.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
function merge(...parts){
 const result={};
 for(const part of parts)for(const [key,value] of Object.entries(part)){
  if(value && typeof value==='object' && !Array.isArray(value))result[key]=merge(result[key]||{},value);
  else if(result[key]!==undefined && result[key]!==value)throw Error('Conflicting translation '+key);
  else result[key]=value;
 }
 return result;
}
for(const lang of ['de','ru']){
 const path=resolve(root,`js/i18n/${lang}.json`);
 const original=await readFile(path,'utf8');
 const dict=JSON.parse(original);
 dict.life=merge(TRANSLATIONS[lang],UI_TRANSLATIONS[lang],ERROR_TRANSLATIONS[lang]);
 const newline=original.includes('\r\n')?'\r\n':'\n';
 await writeFile(path,JSON.stringify(dict,null,4).replace(/\n/g,newline)+newline);
 console.log(`${lang}: life dictionary updated`);
}
