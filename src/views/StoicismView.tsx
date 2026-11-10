import { AureliusWorkbench } from '@/components/aurelius/AureliusWorkbench';
import { SiteHeader, SiteFooter } from '@/components/site/SiteHeader';
import type { Lang } from '@/lib/i18n';

export function StoicismView({lang}:{lang:Lang}){
  return <><SiteHeader lang={lang} path="/stoicism" section="stoicism"/><main className="au-main"><AureliusWorkbench lang={lang}/></main><SiteFooter>{lang==='ru'?'Aurelius · Редакторская реконструкция с проверяемыми источниками':'Aurelius · An editorial reconstruction with inspectable sources'}</SiteFooter></>;
}
