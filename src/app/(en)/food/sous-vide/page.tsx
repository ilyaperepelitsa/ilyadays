import { SousVidePage } from "@/views/FoodViews";
import { sousVideMeta } from "@/views/meta";

export const metadata = sousVideMeta("en");

export default function Page() {
  return <SousVidePage lang="en" />;
}
