import { ProfileView } from "@/views/fitness/ProfileView";
import { profileMeta } from "@/views/fitness/meta";
export const metadata = profileMeta("en");
export default function Page() { return <ProfileView lang="en" />; }
