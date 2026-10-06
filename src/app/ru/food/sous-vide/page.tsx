import { SousVidePage } from "@/views/FoodViews";
import { sousVideMeta } from "@/views/meta";

export const metadata = sousVideMeta("ru");

export default function Page() {
  return <SousVidePage lang="ru" />;
}
