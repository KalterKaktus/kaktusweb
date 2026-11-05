import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {TRANSLATIONS} from '../shared/catalog.mjs';
import {UI_TRANSLATIONS} from '../js/translations.mjs';
import {ERROR_TRANSLATIONS} from '../js/errors.mjs';

function leaves(tree,prefix=''){
 return Object.fromEntries(Object.entries(tree).flatMap(([key,value])=>typeof value==='string'
  ? [[prefix+key,value]] : Object.entries(leaves(value,prefix+key+'.'))));
}
test('shipped DE/RU game dictionaries contain all source texts and identical interpolation variables',async()=>{
 const shipped={};
 for(const lang of ['de','ru']){
  shipped[lang]=leaves(JSON.parse(await readFile(new URL(`../../../js/i18n/${lang}.json`,import.meta.url),'utf8')).life);
  const expected=Object.assign({},leaves(TRANSLATIONS[lang]),leaves(UI_TRANSLATIONS[lang]),leaves(ERROR_TRANSLATIONS[lang]));
  assert.deepEqual(shipped[lang],expected,`${lang}: run tests/sync-translations.mjs after copy changes`);
 }
 assert.deepEqual(Object.keys(shipped.de).sort(),Object.keys(shipped.ru).sort());
 for(const key of Object.keys(shipped.de)){
  const vars=text=>[...text.matchAll(/\{(\w+)\}/g)].map(match=>match[1]).sort();
  assert.deepEqual(vars(shipped.de[key]),vars(shipped.ru[key]),key);
  assert.ok(shipped.de[key].trim()&&shipped.ru[key].trim(),`empty translation ${key}`);
 }
});
