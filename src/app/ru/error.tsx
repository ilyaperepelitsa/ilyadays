"use client";
import { ErrorView } from "@/views/ErrorView";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView lang="ru" error={error} reset={reset} />;
}
