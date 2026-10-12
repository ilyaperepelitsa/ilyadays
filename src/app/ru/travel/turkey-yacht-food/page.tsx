import { TurkeyYachtFoodView } from '@/views/TurkeyYachtFoodView';
import { yachtFoodMeta } from '@/views/meta';
export const metadata=yachtFoodMeta('ru');
export default function Page(){return <TurkeyYachtFoodView lang="ru"/>;}
