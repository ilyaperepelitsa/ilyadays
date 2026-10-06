"use client";
// Vinegar picker (cucumber pickle): swap amounts to match rice vinegar's acidity. The picker and the
// [data-v] / [data-v-row] / [data-v-show] spans come from the exported HTML; the choice is kept in localStorage.
import { useEffect } from "react";
import type { VinegarOption } from "@/lib/content";

export function VinegarPicker({ options }: { options: Record<string, VinegarOption> }) {
  useEffect(() => {
    const picker = document.querySelector("[data-vinegar-picker]");
    if (!picker) return;
    const apply = (key: string) => {
      const v = options[key] as Record<string, string> | undefined;
      if (!v) return;
      document.querySelectorAll<HTMLElement>("[data-v]").forEach((el) => {
        el.textContent = v[el.dataset.v ?? ""] || "—";
      });
      document.querySelectorAll<HTMLElement>("[data-v-row]").forEach((el) => {
        const li = el.closest("li");
        if (li) li.hidden = !v[el.dataset.vRow ?? ""];
      });
      document.querySelectorAll<HTMLElement>("[data-v-show]").forEach((el) => {
        el.hidden = !v[el.dataset.vShow ?? ""];
      });
      try {
        localStorage.setItem("vinegar", key);
      } catch {
        /* storage blocked */
      }
    };
    const onChange = (e: Event) => apply((e.target as HTMLInputElement).value);
    picker.addEventListener("change", onChange);
    let saved = "rice";
    try {
      saved = localStorage.getItem("vinegar") || "rice";
    } catch {
      /* storage blocked */
    }
    const input = picker.querySelector<HTMLInputElement>(`input[value="${CSS.escape(saved)}"]`);
    if (input) input.checked = true;
    apply(input ? saved : "rice");
    return () => picker.removeEventListener("change", onChange);
  }, [options]);
  return null;
}
