import { ScienceIndexView } from "@/views/fitness/ScienceIndexView";
import { scienceIndexMeta } from "@/views/fitness/meta";

export const metadata = scienceIndexMeta("ru");

export default function Page() {
  return <ScienceIndexView lang="ru" />;
}
