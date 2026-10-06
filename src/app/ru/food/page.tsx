import { FoodIndexPage } from "@/views/FoodViews";
import { foodMeta } from "@/views/meta";

export const metadata = foodMeta("ru");

export default function Page() {
  return <FoodIndexPage lang="ru" />;
}
