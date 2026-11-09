import { NutritionView } from "@/views/fitness/NutritionView";
import { nutritionMeta } from "@/views/fitness/meta";

export const metadata = nutritionMeta("en");

export default function Page() {
  return <NutritionView lang="en" />;
}
