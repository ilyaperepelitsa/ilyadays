import { TurkeyYachtFoodView } from '@/views/TurkeyYachtFoodView';
import { yachtFoodMeta } from '@/views/meta';
export const metadata=yachtFoodMeta('en');
export default function Page(){return <TurkeyYachtFoodView lang="en"/>;}
