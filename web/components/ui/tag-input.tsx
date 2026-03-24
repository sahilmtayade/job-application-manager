"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface TagInputProps {
  /** The raw comma-separated string value */
  value: string;
  /** Called with the new comma-separated string whenever tags change */
  onChange: (value: string) => void;
  placeholder?: string;
  /** Placeholder shown only when there are no tags yet */
  emptyPlaceholder?: string;
  className?: string;
  /** Badge color variant */
  color?: "violet" | "primary" | "blue" | "green" | "amber";
  /** Keys that trigger tag creation. Defaults to [",", "Enter"] */
  triggerKeys?: string[];
  disabled?: boolean;
}

const COLOR_CLASSES: Record<NonNullable<TagInputProps["color"]>, string> = {
  violet:
    "bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 border-violet-500/20",
  primary:
    "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border-blue-500/20",
  green:
    "bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 border-green-500/20",
  amber:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border-amber-500/20",
};

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function joinTags(tags: string[]): string {
  return tags.join(", ");
}

/**
 * A shared tag/badge input that turns comma-separated values into interactive badges.
 *
 * Usage:
 * ```tsx
 * <TagInput
 *   value={someString}
 *   onChange={setSomeString}
 *   placeholder="Add item..."
 *   emptyPlaceholder="e.g., React, TypeScript..."
 *   color="violet"
 * />
 * ```
 */
export function TagInput({
  value,
  onChange,
  placeholder = "Add...",
  emptyPlaceholder,
  className,
  color = "violet",
  triggerKeys = [",", "Enter"],
  disabled = false,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const tags = parseTags(value);

  const addTag = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    onChange(joinTags([...tags, trimmed]));
    setInputValue("");
  };

  const removeTag = (index: number) => {
    onChange(joinTags(tags.filter((_, i) => i !== index)));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (triggerKeys.includes(e.key)) {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      // Remove last tag on backspace when input is empty
      onChange(joinTags(tags.slice(0, -1)));
    }
  };

  const handleBlur = () => {
    // Commit pending input on blur
    if (inputValue.trim()) {
      addTag(inputValue);
    }
  };

  const badgeClass = COLOR_CLASSES[color];

  return (
    <div
      className={cn(
        "flex flex-wrap gap-1.5 items-center rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm",
        "focus-within:ring-1 focus-within:ring-ring transition-shadow min-h-[40px]",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {tags.map((tag, i) => (
        <Badge
          key={i}
          variant="secondary"
          className={cn(
            "flex items-center gap-1 px-2 py-0.5 text-xs border transition-colors select-none",
            badgeClass
          )}
        >
          {tag}
          {!disabled && (
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              className="rounded-full outline-none hover:opacity-70 transition-opacity ml-0.5 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(i);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}
      {!disabled && (
        <input
          className="flex-1 bg-transparent min-w-[140px] outline-none placeholder:text-muted-foreground text-sm"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={tags.length === 0 ? (emptyPlaceholder ?? placeholder) : placeholder}
        />
      )}
    </div>
  );
}
