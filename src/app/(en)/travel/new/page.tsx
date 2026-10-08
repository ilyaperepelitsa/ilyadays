import { NewTripView } from "@/views/NewTripView";
import { makeTripMeta } from "@/views/meta";

export const metadata = makeTripMeta("en");

export default function Page() {
  return <NewTripView lang="en" />;
}
