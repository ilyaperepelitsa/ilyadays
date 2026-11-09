import { ProgressView } from "@/views/fitness/ProgressView";
import { progressMeta } from "@/views/fitness/meta";

export const metadata = progressMeta("en");

export default function Page() {
  return <ProgressView lang="en" />;
}
