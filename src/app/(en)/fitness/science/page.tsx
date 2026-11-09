import { ScienceIndexView } from "@/views/fitness/ScienceIndexView";
import { scienceIndexMeta } from "@/views/fitness/meta";

export const metadata = scienceIndexMeta("en");

export default function Page() {
  return <ScienceIndexView lang="en" />;
}
