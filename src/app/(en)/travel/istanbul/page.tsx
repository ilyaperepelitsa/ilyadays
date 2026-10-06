import { IstanbulView } from "@/views/IstanbulView";
import { istanbulMeta } from "@/views/meta";

export const metadata = istanbulMeta("en");

export default function Page() {
  return <IstanbulView lang="en" />;
}
