import { NewTripView } from "@/views/NewTripView";
import { makeTripMeta } from "@/views/meta";

export const metadata = makeTripMeta("ru");

export default function Page() {
  return <NewTripView lang="ru" />;
}
