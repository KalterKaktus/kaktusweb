import { createContext,useContext,useEffect,useState } from 'react';
const {ready,t,getLanguage,setLanguage,onLanguageChange,formatNumber,formatDate}=await import(/* @vite-ignore */ String('/js/i18n.js'));
const Context=createContext(null);
// Supabase serializes timestamps as ISO strings. The shared formatter expects
// a Date or epoch number; passing the string crashes React once history arrives.
function formatStoredDate(value, options){
 if(value===null||value===undefined||value==='')return '—';
 const date=value instanceof Date?value:new Date(value);
 return Number.isFinite(date.getTime())?formatDate(date,options):'—';
}
export function LanguageProvider({children}){const [language,change]=useState(getLanguage());const [loaded,load]=useState(false);useEffect(()=>{ready.then(()=>{load(true);change(getLanguage());});return onLanguageChange(change);},[]);return <Context.Provider value={{language,t:(key,vars)=>t('lounge.'+key,vars),setLanguage,number:formatNumber,chips:value=>formatNumber(value,{minimumFractionDigits:2,maximumFractionDigits:2}),date:formatStoredDate}}>{loaded?children:null}</Context.Provider>}
export const useText=()=>useContext(Context);

import ORIGINAL_KEYS from './original-text';
export function upstreamText(value){const key=ORIGINAL_KEYS[value];return key?t('lounge.original_ui.'+key):value;}
