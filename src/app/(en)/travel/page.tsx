import { TravelView } from "@/views/TravelView";
import { travelMeta } from "@/views/meta";

export const metadata = travelMeta("en");

export default function Page() {
  return <TravelView lang="en" />;
}
