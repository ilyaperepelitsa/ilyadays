import { TravelView } from "@/views/TravelView";
import { travelMeta } from "@/views/meta";

export const metadata = travelMeta("ru");

export default function Page() {
  return <TravelView lang="ru" />;
}
