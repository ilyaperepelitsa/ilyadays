"use client";

import { useSyncExternalStore } from "react";

export const subscribeChoices=(notify:()=>void)=>{
  window.addEventListener('popstate',notify);
  return ()=>window.removeEventListener('popstate',notify);
};
export const choiceSearch=()=>window.location.search;
export const serverSearch=()=>'';

/** URL-backed controls survive reloads and can be shared without another page. */
export function useUrlChoice(name:string,allowed:readonly string[],fallback:string) {
  const search=useSyncExternalStore(subscribeChoices,choiceSearch,serverSearch);
  const value=new URLSearchParams(search).get(name);
  const selected=value&&allowed.includes(value)?value:fallback;
  const select=(next:string)=>{
    if (!allowed.includes(next)) return;
    const url=new URL(window.location.href);
    url.searchParams.set(name,next);
    history.replaceState(history.state,'',url);
    window.dispatchEvent(new Event('popstate'));
  };
  return [selected,select] as const;
}
