import { NutritionView } from "@/views/fitness/NutritionView";
import { nutritionMeta } from "@/views/fitness/meta";

export const metadata = nutritionMeta("ru");

export default function Page() {
  return <NutritionView lang="ru" />;
}
