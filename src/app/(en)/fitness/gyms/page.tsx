import { GymsView } from "@/views/fitness/GymsView";
import { gymsMeta } from "@/views/fitness/meta";

export const metadata = gymsMeta("en");

export default function Page() {
  return <GymsView lang="en" />;
}
