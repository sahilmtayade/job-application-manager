"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, User } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { TagInput } from "@/components/ui/tag-input";

import { configApi } from "@/lib/api";

export default function ProfilePage() {
  const queryClient = useQueryClient();

  // Keywords (comma-separated tag input)
  const [jobSearchKeywords, setJobSearchKeywords] = useState("");

  // Profile fields
  const [candidateSkills, setCandidateSkills] = useState("");
  const [candidateExp, setCandidateExp] = useState("");
  const [candidateLoc, setCandidateLoc] = useState("");
  const [candidateClearance, setCandidateClearance] = useState("");
  const [candidateDisqualifiers, setCandidateDisqualifiers] = useState("");

  const [initialized, setInitialized] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ["config"],
    queryFn: () => configApi.list(),
  });

  useEffect(() => {
    if (config?.config && !initialized) {
      if (config.config.job_search_keywords) setJobSearchKeywords(config.config.job_search_keywords);
      if (config.config.candidate_skills) setCandidateSkills(config.config.candidate_skills);
      if (config.config.candidate_experience_years) setCandidateExp(config.config.candidate_experience_years);
      if (config.config.candidate_location) setCandidateLoc(config.config.candidate_location);
      if (config.config.candidate_clearance_status) setCandidateClearance(config.config.candidate_clearance_status);
      if (config.config.candidate_disqualifiers) setCandidateDisqualifiers(config.config.candidate_disqualifiers);
      setInitialized(true);
    }
  }, [config, initialized]);

  const setMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      configApi.set(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config"] });
      toast.success("Profile saved");
    },
    onError: () => {
      toast.error("Failed to save profile");
    },
  });

  const handleSave = (key: string, value: string) => {
    setMutation.mutate({ key, value });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Candidate Profile" description="Manage your job application profile and preferences" />
      <div className="flex-1 overflow-auto space-y-6 p-8">

        {/* Job Search Keywords */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Job Search Keywords
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Beta
              </span>
            </CardTitle>
            <CardDescription>
              Keywords used for job search aggregation (comma-separated)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <>
                <div className="flex items-end gap-4">
                  <div className="flex-1 space-y-2">
                    <Label>Search Keywords</Label>
                    <TagInput
                      value={jobSearchKeywords}
                      onChange={setJobSearchKeywords}
                      emptyPlaceholder="Full Stack Engineer, Software Developer..."
                      placeholder="Add keyword..."
                      color="primary"
                    />
                  </div>
                  <Button
                    onClick={() => handleSave("job_search_keywords", jobSearchKeywords)}
                    disabled={setMutation.isPending}
                  >
                    Save
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter job titles or skills separated by commas. These will be used to search across LinkedIn, Indeed, Glassdoor, ZipRecruiter, and Google Jobs.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Candidate Profile Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Candidate Profile
            </CardTitle>
            <CardDescription>
              Details used by the AI to evaluate job fit
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <div className="space-y-4">

                {/* Core Skills — tag input */}
                <div className="flex items-end gap-4">
                  <div className="flex-1 space-y-2">
                    <Label>Core Technical Skills</Label>
                    <TagInput
                      value={candidateSkills}
                      onChange={setCandidateSkills}
                      emptyPlaceholder="React, Next.js, TypeScript, Python..."
                      placeholder="Add skill..."
                      color="green"
                    />
                  </div>
                  <Button
                    onClick={() => handleSave("candidate_skills", candidateSkills)}
                    disabled={setMutation.isPending}
                  >
                    Save
                  </Button>
                </div>

                {/* Experience — plain number input */}
                <div className="flex items-end gap-4">
                  <div className="flex-1 space-y-2">
                    <Label>Professional Experience (Years)</Label>
                    <Input
                      type="number"
                      value={candidateExp}
                      onChange={(e) => setCandidateExp(e.target.value)}
                      placeholder="2"
                    />
                  </div>
                  <Button
                    onClick={() => handleSave("candidate_experience_years", candidateExp)}
                    disabled={setMutation.isPending}
                  >
                    Save
                  </Button>
                </div>

                {/* Location — tag input */}
                <div className="flex items-end gap-4">
                  <div className="flex-1 space-y-2">
                    <Label>Location / Region</Label>
                    <TagInput
                      value={candidateLoc}
                      onChange={setCandidateLoc}
                      emptyPlaceholder="Washington DC, Maryland, Virginia, Remote..."
                      placeholder="Add location..."
                      color="blue"
                    />
                  </div>
                  <Button
                    onClick={() => handleSave("candidate_location", candidateLoc)}
                    disabled={setMutation.isPending}
                  >
                    Save
                  </Button>
                </div>

                {/* Clearance — plain text input (not comma-separated) */}
                <div className="flex items-end gap-4">
                  <div className="flex-1 space-y-2">
                    <Label>Security Clearance Status</Label>
                    <Input
                      value={candidateClearance}
                      onChange={(e) => setCandidateClearance(e.target.value)}
                      placeholder="No security clearance (cannot accept clearance-required jobs)"
                    />
                  </div>
                  <Button
                    onClick={() => handleSave("candidate_clearance_status", candidateClearance)}
                    disabled={setMutation.isPending}
                  >
                    Save
                  </Button>
                </div>

                {/* Disqualifiers — tag input */}
                <div className="flex items-end gap-4">
                  <div className="flex-1 space-y-2">
                    <Label>Disqualifiers (Hard stops)</Label>
                    <TagInput
                      value={candidateDisqualifiers}
                      onChange={setCandidateDisqualifiers}
                      emptyPlaceholder="Not a veteran, Not disabled..."
                      placeholder="Add disqualifier..."
                      color="amber"
                    />
                  </div>
                  <Button
                    onClick={() => handleSave("candidate_disqualifiers", candidateDisqualifiers)}
                    disabled={setMutation.isPending}
                  >
                    Save
                  </Button>
                </div>

              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
