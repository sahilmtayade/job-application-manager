"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings2,
  ChevronDown,
  ChevronUp,
  Save,
  Search,
  MapPin,
  Briefcase,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagInput } from "@/components/ui/tag-input";
import { configApi } from "@/lib/api";
import type { ConfigList } from "@/lib/types";

export type { ConfigList };

export interface JobSearchSettingsProps {
  jobSearchKeywords: string;
  setJobSearchKeywords: (v: string) => void;
  candidateLoc: string;
  setCandidateLoc: (v: string) => void;
  candidateExp: string;
  setCandidateExp: (v: string) => void;
  searchHoursOld: string;
  setSearchHoursOld: (v: string) => void;
  config: ConfigList | undefined;
}

const HOURS_OPTIONS = [
  { label: "12 hours", value: "12" },
  { label: "24 hours", value: "24" },
  { label: "48 hours", value: "48" },
  { label: "72 hours", value: "72" },
  { label: "1 week", value: "168" },
];

export function JobSearchSettings({
  jobSearchKeywords,
  setJobSearchKeywords,
  candidateLoc,
  setCandidateLoc,
  candidateExp,
  setCandidateExp,
  searchHoursOld,
  setSearchHoursOld,
  config,
}: JobSearchSettingsProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const setMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) =>
      configApi.set(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config"] });
      queryClient.invalidateQueries({ queryKey: ["job-search-keywords"] });
    },
    onError: () => {
      toast.error("Failed to save settings");
    },
  });

  const handleSaveAsDefault = async () => {
    try {
      const saves: Array<{ key: string; value: string }> = [];

      if (jobSearchKeywords !== (config?.config?.job_search_keywords ?? ""))
        saves.push({ key: "job_search_keywords", value: jobSearchKeywords });
      if (candidateLoc !== (config?.config?.candidate_location ?? ""))
        saves.push({ key: "candidate_location", value: candidateLoc });
      if (candidateExp !== (config?.config?.candidate_experience_years ?? ""))
        saves.push({ key: "candidate_experience_years", value: candidateExp });
      if (searchHoursOld !== (config?.config?.job_search_hours_old ?? "24"))
        saves.push({ key: "job_search_hours_old", value: searchHoursOld });

      if (saves.length === 0) {
        toast.info("No changes to save");
        return;
      }

      await Promise.all(saves.map((s) => setMutation.mutateAsync(s)));
      toast.success("Saved as default search preferences");
      setIsOpen(false);
    } catch {
      // Error handled in mutation
    }
  };

  const keywordsArray = jobSearchKeywords.split(",").map((k) => k.trim()).filter(Boolean);
  const locArray = candidateLoc.split(",").map((l) => l.trim()).filter(Boolean);
  const hoursLabel = HOURS_OPTIONS.find((o) => o.value === searchHoursOld)?.label ?? `${searchHoursOld}h`;

  const hasUnsavedDefaults =
    jobSearchKeywords !== (config?.config?.job_search_keywords ?? "") ||
    candidateLoc !== (config?.config?.candidate_location ?? "") ||
    candidateExp !== (config?.config?.candidate_experience_years ?? "") ||
    searchHoursOld !== (config?.config?.job_search_hours_old ?? "24");

  return (
    <div className="border rounded-lg bg-card overflow-hidden transition-all duration-200">
      {/* Collapsed header */}
      <div
        className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3 flex-1">
          <Settings2 className="h-4 w-4 text-violet-500" />
          <div className="flex flex-col">
            <span className="text-sm font-medium flex items-center gap-2">
              Search Preferences
              {hasUnsavedDefaults && (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block"
                  title="Unsaved changes"
                />
              )}
            </span>
            {!isOpen && (
              <span className="text-xs text-muted-foreground flex gap-4 mt-0.5 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Search className="h-3 w-3" />
                  {keywordsArray.length} keyword{keywordsArray.length !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" />
                  {locArray.length > 0 ? locArray.join(", ") : "Any location"}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Past {hoursLabel}
                </span>
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-transparent pointer-events-none">
          {isOpen
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </Button>
      </div>

      {/* Expanded panel */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-4 border-t bg-muted/20 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Keywords — full width */}
            <div className="space-y-2 col-span-1 md:col-span-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Search className="h-3 w-3" />
                Job Titles &amp; Skills
              </Label>
              <TagInput
                value={jobSearchKeywords}
                onChange={setJobSearchKeywords}
                emptyPlaceholder="e.g., Software Engineer, React..."
                placeholder="Add keyword..."
                color="violet"
              />
            </div>

            {/* Location — tag input */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3 w-3" />
                Location / Region
              </Label>
              <TagInput
                value={candidateLoc}
                onChange={setCandidateLoc}
                emptyPlaceholder="e.g., Remote, Washington DC..."
                placeholder="Add location..."
                color="blue"
              />
            </div>

            {/* Time since posted */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Time Since Posted
              </Label>
              <div className="flex flex-wrap gap-2">
                {HOURS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSearchHoursOld(opt.value)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                      searchHoursOld === opt.value
                        ? "bg-violet-600 border-violet-600 text-white shadow-sm"
                        : "bg-background border-input text-muted-foreground hover:border-violet-400 hover:text-violet-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Max Experience */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Briefcase className="h-3 w-3" />
                Max Experience (Years)
              </Label>
              <Input
                type="number"
                value={candidateExp}
                onChange={(e) => setCandidateExp(e.target.value)}
                placeholder="e.g., 3"
                className="bg-background"
              />
            </div>
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-between pt-2 border-t mt-4">
            <p className="text-xs text-muted-foreground">
              Changes apply immediately when you search.{" "}
              <span className="text-amber-500 font-medium">Save as default</span> to persist.
            </p>
            <Button
              size="sm"
              onClick={handleSaveAsDefault}
              disabled={!hasUnsavedDefaults || setMutation.isPending}
              className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
            >
              <Save className="h-4 w-4" />
              {setMutation.isPending ? "Saving..." : "Save as Default"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
