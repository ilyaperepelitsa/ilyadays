import { ToolsView } from "@/views/fitness/ToolsView";
import { toolsMeta } from "@/views/fitness/meta";

export const metadata = toolsMeta("en");

export default function Page() {
  return <ToolsView lang="en" />;
}
