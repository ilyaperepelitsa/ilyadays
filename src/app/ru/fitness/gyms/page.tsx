import { GymsView } from "@/views/fitness/GymsView";
import { gymsMeta } from "@/views/fitness/meta";

export const metadata = gymsMeta("ru");

export default function Page() {
  return <GymsView lang="ru" />;
}
