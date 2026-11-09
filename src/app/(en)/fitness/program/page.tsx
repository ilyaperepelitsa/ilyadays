import { ProgramView } from "@/views/fitness/ProgramView";
import { programMeta } from "@/views/fitness/meta";

export const metadata = programMeta("en");

export default function Page() {
  return <ProgramView lang="en" />;
}
