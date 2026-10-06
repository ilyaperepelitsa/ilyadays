import "../globals.css";
import { RootShell, rootMetadata, rootViewport } from "@/components/site/RootShell";

export const metadata = rootMetadata;
export const viewport = rootViewport;

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RootShell lang="ru">{children}</RootShell>;
}
