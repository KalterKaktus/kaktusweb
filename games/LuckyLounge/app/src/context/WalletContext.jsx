import { createContext, useContext, useEffect, useState } from 'react';
const {CasinoWallet}=await import(/* @vite-ignore */ String('/games/LuckyLounge/js/wallet.js'));
import { useText } from '../i18n';
const Context = createContext(null);
const service = new CasinoWallet();
let started;
export function WalletProvider({ children }) {
  const {t} = useText();
  const [state, update] = useState({snapshot:null,available:false});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const change = () => {update({snapshot:service.snapshot,available:service.available}); if(service.available)setError(null);};
    const fail = e => setError(e.detail);
    service.addEventListener('change',change); service.addEventListener('failure',fail);
    started ||= service.init({redirectOnGuest:false});
    started.then(change).catch(setError);
    return () => {service.removeEventListener('change',change); service.removeEventListener('failure',fail);};
  },[]);
  const action = async (name, ...args) => {
    setBusy(true); setError(null);
    try {
      if(name==='refresh'&&(!service.client||!service.user)) {
        started=service.init({redirectOnGuest:false});
        await started;
        return service.snapshot;
      }
      return await service[name](...args);
    } catch(e){setError(e);throw e;} finally{setBusy(false);}
  };
  const text = error ? t(errorKey(error)) : '';
  return <Context.Provider value={{...state,error: text,busy,user:service.user,balance:state.snapshot?.wallet.chips ?? 0,
    now:()=>service.now(),claim:()=>action('claim'),play:(...args)=>action('play',...args),game:(...args)=>action('game',...args),crashState:()=>service.refreshCrash(),crashAction:(...args)=>action('crashAction',...args),refresh:()=>action('refresh')}}>{children}</Context.Provider>;
}
export const useWallet = () => useContext(Context);
export function errorKey(error) {
  const msg=(error?.message||'')+(error?.code||'');
  if(/casino_login_required/.test(msg))return 'login_required';
  if(/casino_insufficient/.test(msg))return 'insufficient';
  if(/casino_invalid_bet/.test(msg))return 'invalid_bet';
  if(/casino_invalid_(state|round|active_round)/.test(msg))return 'round_changed';
  if(/casino_rate_limit/.test(msg))return 'rate_limit';
  if(/casino_account_banned/.test(msg))return 'banned';
  if(/casino_balance_limit/.test(msg))return 'balance_limit';
  if(/casino_precision_migration/.test(msg))return 'precision_migration';
  if(/casino_(fun|bonus)_migration/.test(msg))return 'hourly_migration_required';
  if(/PGRST202|42883|schema cache/i.test(msg))return 'migration_required';
  return 'network_error';
}
