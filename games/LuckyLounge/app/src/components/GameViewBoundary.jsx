import {Component} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {useText} from '../i18n';

// A rejected lazy import or a renderer error must not remove the shared shell.
class ViewBoundary extends Component{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(error){console.error('Lucky Lounge game view:',error);}
 componentDidUpdate(previous){if(previous.resetKey!==this.props.resetKey&&this.state.failed)this.setState({failed:false});}
 render(){return this.state.failed?this.props.fallback:this.props.children;}
}
export default function GameViewBoundary({children}){
 const {pathname}=useLocation(),{t}=useText();
 // Keep the boundary mounted while the outgoing game runs its cleanup.
 // Keying the boundary by route leaves unmount errors without a catcher.
 return <ViewBoundary resetKey={pathname} fallback={<section className="lucky-status" role="alert"><p>{t('view_error')}</p><button onClick={()=>location.reload()}>{t('view_reload')}</button> <Link to="/">{t('back')}</Link></section>}>{children}</ViewBoundary>;
}

export function ApplicationBoundary({children}){
 const {t}=useText();
 return <ViewBoundary fallback={<section className="lucky-status" role="alert"><p>{t('view_error')}</p><button onClick={()=>location.reload()}>{t('view_reload')}</button> <a href="/games/LuckyLounge/">{t('back')}</a></section>}>{children}</ViewBoundary>;
}

export async function loadGame(importGame){
 try{return await importGame();}
 catch(error){
  // After a local rebuild an open tab can still reference the previous hashes.
  // Reload only the page, once; never replay a financial action here.
  if(/Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|preload CSS/i.test(error.message||'')){
   try{const key='kk-lounge-module-reload',last=Number(sessionStorage.getItem(key)||0);
    if(Date.now()-last>60000){sessionStorage.setItem(key,String(Date.now()));const url=new URL(location.href);url.searchParams.set('lounge-build',String(Date.now()));location.replace(url.href);}
   }catch{}
  }
  throw error;
 }
}
