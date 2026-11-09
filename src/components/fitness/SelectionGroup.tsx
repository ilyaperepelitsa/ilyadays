"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ActionIcon } from "../site/ActionIcon";

/** Shared shadcn/Radix multi-selection: wrapping layout, keyboard focus and explicit pressed states. */
export function SelectionGroup<T extends string>({ label, values, options, disabled, testId, onChange }: {
  label: string;
  values: T[];
  options: { id: T; label: string; count?: number; disabled?: boolean; description?: string }[];
  disabled?: boolean;
  testId?: string;
  onChange: (values: T[]) => void;
}) {
  return <ToggleGroup type="multiple" variant="outline" size="lg" className="flex-wrap justify-start gap-2"
    aria-label={label} value={values} disabled={disabled} data-testid={testId}
    onValueChange={(next) => onChange(next.filter((id): id is T => options.some((o) => o.id === id)))}>
    {options.map((option) => <ToggleGroupItem key={option.id} value={option.id} data-value={option.id}
      className="fit-choice h-auto min-h-11 max-w-full px-3 py-2 text-left leading-snug data-[state=on]:border-ring disabled:border-dashed"
      disabled={option.disabled} title={option.description}>
      <span aria-hidden="true" className="fit-choice-indicator">{values.includes(option.id) ? <ActionIcon name="check" /> : null}</span>
      {option.label}{option.count === undefined ? null : <span className="text-xs tabular-nums opacity-70">{option.count}</span>}
    </ToggleGroupItem>)}
  </ToggleGroup>;
}
