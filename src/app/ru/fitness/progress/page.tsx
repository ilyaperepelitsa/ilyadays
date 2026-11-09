import { ProgressView } from "@/views/fitness/ProgressView";
import { progressMeta } from "@/views/fitness/meta";

export const metadata = progressMeta("ru");

export default function Page() {
  return <ProgressView lang="ru" />;
}
