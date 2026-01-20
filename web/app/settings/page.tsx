"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { format, parseISO } from "date-fns";
import {
  Download,
  Database,
  Sun,
  Moon,
  Laptop,
  RefreshCw,
  Settings2,
  Clock,
  FileCheck,
  HardDrive,
  Plus,
  Trash2,
  Search,
  Bot,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";

import { configApi, statsApi, backupApi, llmApi } from "@/lib/api";
import { workLocationLabels, type WorkLocation, statusLabels, type ApplicationStatus, type LLMConfigUpdate } from "@/lib/types";

const allWorkLocations: WorkLocation[] = ["remote", "onsite", "hybrid"];
const allStatuses: ApplicationStatus[] = [
  "applied",
  "screening",
  "interviewing",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
  "ghosted",
  "scam",
];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch with theme
  useEffect(() => {
    setMounted(true);
  }, []);

  const [defaultSource, setDefaultSource] = useState("");
  const [defaultLocation, setDefaultLocation] = useState("");
  const [ghostedDays, setGhostedDays] = useState("");
  const [reapplyDays, setReapplyDays] = useState("");
  const [jobSearchKeywords, setJobSearchKeywords] = useState("");

  // AI Settings state
  const [llmUrl, setLlmUrl] = useState("");
  const [llmApiMode, setLlmApiMode] = useState<"openai" | "ollama">("openai");
  const [visionModel, setVisionModel] = useState("");
  const [textModel, setTextModel] = useState("");
  const [temperature, setTemperature] = useState(0);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [concurrency, setConcurrency] = useState(2);

  const { data: config, isLoading } = useQuery({
    queryKey: ["config"],
    queryFn: () => configApi.list(),
  });

  const { data: stats } = useQuery({
    queryKey: ["stats", "summary"],
    queryFn: () => statsApi.summary(),
  });

  const { data: backups, isLoading: backupsLoading } = useQuery({
    queryKey: ["backups"],
    queryFn: () => backupApi.list(),
  });

  // LLM Status and Config queries
  const { data: llmStatus, isLoading: llmStatusLoading, refetch: refetchLlmStatus } = useQuery({
    queryKey: ["llm", "status"],
    queryFn: () => llmApi.status(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: llmConfig, isLoading: llmConfigLoading } = useQuery({
    queryKey: ["llm", "config"],
    queryFn: () => llmApi.getConfig(),
  });

  // Initialize AI settings form when config loads
  useEffect(() => {
    if (llmConfig) {
      setLlmUrl(llmConfig.url);
      setLlmApiMode(llmConfig.api_mode);
      setVisionModel(llmConfig.vision_model);
      setTextModel(llmConfig.text_model);
      setTemperature(llmConfig.temperature);
      setMaxTokens(llmConfig.max_tokens);
      setConcurrency(llmConfig.concurrency);
    }
  }, [llmConfig]);

  const updateLlmConfigMutation = useMutation({
    mutationFn: (config: LLMConfigUpdate) => llmApi.updateConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["llm", "config"] });
      queryClient.invalidateQueries({ queryKey: ["llm", "status"] });
      toast.success("AI settings saved");
    },
    onError: () => {
      toast.error("Failed to save AI settings");
    },
  });

  const handleSaveLlmConfig = (updates: LLMConfigUpdate) => {
    updateLlmConfigMutation.mutate(updates);
  };

  const createBackupMutation = useMutation({
    mutationFn: () => backupApi.create(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["backups"] });
      toast.success(data.message);
    },
    onError: () => {
      toast.error("Failed to create backup");
    },
  });

  const deleteBackupMutation = useMutation({
    mutationFn: (name: string) => backupApi.delete(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backups"] });
      toast.success("Backup deleted");
    },
    onError: () => {
      toast.error("Failed to delete backup");
    },
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const setMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      configApi.set(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config"] });
      toast.success("Setting saved");
    },
    onError: () => {
      toast.error("Failed to save setting");
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => configApi.reset(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config"] });
      toast.success("Settings reset to defaults");
    },
    onError: () => {
      toast.error("Failed to reset settings");
    },
  });

  const handleSave = (key: string, value: string) => {
    if (value) {
      setMutation.mutate({ key, value });
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/applications?all=true");
      const data = await response.json();

      // Convert to CSV
      const headers = [
        "ID",
        "Company",
        "Position",
        "Status",
        "Applied At",
        "Source",
        "Work Location",
        "URL",
        "Notes",
      ];
      const rows = data.applications.map((app: Record<string, string | number | boolean | null>) => [
        app.id,
        app.company_name || app.company_name_raw,
        app.position,
        app.status,
        app.applied_at,
        app.source || "",
        app.work_location || "",
        app.url || "",
        (app.notes || "").toString().replace(/"/g, '""'),
      ]);

      const csv = [
        headers.join(","),
        ...rows.map((row: string[]) => row.map((cell: string) => `"${cell}"`).join(",")),
      ].join("\n");

      // Download
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jam-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success("Data exported successfully");
    } catch {
      toast.error("Failed to export data");
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Settings" description="Configure your preferences" />
      <div className="flex-1 overflow-auto space-y-6 p-8">
        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>Customize how JAM looks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label>Theme</Label>
                <p className="text-sm text-muted-foreground">
                  Choose your preferred color scheme
                </p>
              </div>
              {!mounted ? (
                <Skeleton className="h-9 w-64" />
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant={theme === "light" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("light")}
                  >
                    <Sun className="mr-2 h-4 w-4" />
                    Light
                  </Button>
                  <Button
                    variant={theme === "dark" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("dark")}
                  >
                    <Moon className="mr-2 h-4 w-4" />
                    Dark
                  </Button>
                  <Button
                    variant={theme === "system" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("system")}
                  >
                    <Laptop className="mr-2 h-4 w-4" />
                    System
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Application Defaults */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Application Defaults
            </CardTitle>
            <CardDescription>
              Pre-fill values when adding new applications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                <div className="flex items-end gap-4">
                  <div className="flex-1 space-y-2">
                    <Label>Default Source</Label>
                    <Input
                      value={defaultSource || config?.config?.default_source || ""}
                      onChange={(e) => setDefaultSource(e.target.value)}
                      placeholder="LinkedIn, Indeed, Referral..."
                    />
                  </div>
                  <Button
                    onClick={() => handleSave("default_source", defaultSource)}
                    disabled={setMutation.isPending}
                  >
                    Save
                  </Button>
                </div>

                <div className="flex items-end gap-4">
                  <div className="flex-1 space-y-2">
                    <Label>Default Work Location</Label>
                    <Select
                      value={
                        defaultLocation || config?.config?.default_work_location || ""
                      }
                      onValueChange={setDefaultLocation}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select default location" />
                      </SelectTrigger>
                      <SelectContent>
                        {allWorkLocations.map((loc) => (
                          <SelectItem key={loc} value={loc}>
                            {workLocationLabels[loc]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={() => handleSave("default_work_location", defaultLocation)}
                    disabled={setMutation.isPending}
                  >
                    Save
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Notification Thresholds */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Thresholds
            </CardTitle>
            <CardDescription>
              Configure timing thresholds for warnings and suggestions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Ghosted Threshold (days)</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      className="flex-1"
                      type="number"
                      min="1"
                      value={
                        ghostedDays || config?.config?.ghosted_threshold_days || ""
                      }
                      onChange={(e) => setGhostedDays(e.target.value)}
                      placeholder="30"
                    />
                    <Button
                      onClick={() => handleSave("ghosted_threshold_days", ghostedDays)}
                      disabled={setMutation.isPending}
                    >
                      Save
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Days without response before considering an application ghosted
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Reapplication Warning (days)</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      className="flex-1"
                      type="number"
                      min="1"
                      value={
                        reapplyDays ||
                        config?.config?.reapplication_warning_days ||
                        ""
                      }
                      onChange={(e) => setReapplyDays(e.target.value)}
                      placeholder="90"
                    />
                    <Button
                      onClick={() =>
                        handleSave("reapplication_warning_days", reapplyDays)
                      }
                      disabled={setMutation.isPending}
                    >
                      Save
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Days before warning when reapplying to the same company
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

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
                    <Input
                      value={jobSearchKeywords || config?.config?.job_search_keywords || ""}
                      onChange={(e) => setJobSearchKeywords(e.target.value)}
                      placeholder="Full Stack Engineer, Software Developer, React Developer..."
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

        {/* AI Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI Settings
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                LLM
              </span>
            </CardTitle>
            <CardDescription>
              Configure AI model selection and inference parameters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {llmConfigLoading || llmStatusLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                {/* Connection Status */}
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    {llmStatus?.available ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <div>
                      <p className="font-medium">
                        {llmStatus?.available ? "Connected" : "Not Connected"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {llmStatus?.available
                          ? `${llmStatus.available_models.length} models available`
                          : "Check server URL and ensure LLM server is running"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchLlmStatus()}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>

                {/* Server Settings */}
                <div className="space-y-4">
                  <div className="flex items-end gap-4">
                    <div className="flex-1 space-y-2">
                      <Label>Server URL</Label>
                      <Input
                        value={llmUrl}
                        onChange={(e) => setLlmUrl(e.target.value)}
                        placeholder="http://localhost:1234"
                      />
                    </div>
                    <Button
                      onClick={() => handleSaveLlmConfig({ url: llmUrl })}
                      disabled={updateLlmConfigMutation.isPending}
                    >
                      Save
                    </Button>
                  </div>

                  <div className="flex items-end gap-4">
                    <div className="flex-1 space-y-2">
                      <Label>API Mode</Label>
                      <Select
                        value={llmApiMode}
                        onValueChange={(v) => setLlmApiMode(v as "openai" | "ollama")}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openai">OpenAI Compatible (LM Studio)</SelectItem>
                          <SelectItem value="ollama">Ollama Native</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={() => handleSaveLlmConfig({ api_mode: llmApiMode })}
                      disabled={updateLlmConfigMutation.isPending}
                    >
                      Save
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Model Selection */}
                <div className="space-y-4">
                  <Label className="text-base">Model Selection</Label>

                  <div className="flex items-end gap-4">
                    <div className="flex-1 space-y-2">
                      <Label>Vision Model</Label>
                      <p className="text-xs text-muted-foreground mb-1">
                        Used for analyzing images (job postings, resumes)
                      </p>
                      <Select
                        value={visionModel}
                        onValueChange={setVisionModel}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select vision model" />
                        </SelectTrigger>
                        <SelectContent>
                          {llmStatus?.available_models.map((model) => (
                            <SelectItem key={model} value={model}>
                              {model}
                              {model === llmStatus?.model && (
                                <Badge variant="secondary" className="ml-2 text-xs">current</Badge>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={() => handleSaveLlmConfig({ vision_model: visionModel })}
                      disabled={updateLlmConfigMutation.isPending}
                    >
                      Save
                    </Button>
                  </div>

                  <div className="flex items-end gap-4">
                    <div className="flex-1 space-y-2">
                      <Label>Text Model</Label>
                      <p className="text-xs text-muted-foreground mb-1">
                        Used for job analysis and scoring
                      </p>
                      <Select
                        value={textModel}
                        onValueChange={setTextModel}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select text model" />
                        </SelectTrigger>
                        <SelectContent>
                          {llmStatus?.available_models.map((model) => (
                            <SelectItem key={model} value={model}>
                              {model}
                              {model === llmStatus?.text_model && (
                                <Badge variant="secondary" className="ml-2 text-xs">current</Badge>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={() => handleSaveLlmConfig({ text_model: textModel })}
                      disabled={updateLlmConfigMutation.isPending}
                    >
                      Save
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Inference Parameters */}
                <div className="space-y-4">
                  <Label className="text-base">Inference Parameters</Label>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Temperature</Label>
                        <span className="text-sm font-mono text-muted-foreground">
                          {temperature.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Lower = more deterministic, Higher = more creative
                      </p>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[temperature]}
                          onValueChange={([v]) => setTemperature(v)}
                          min={0}
                          max={1}
                          step={0.05}
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSaveLlmConfig({ temperature })}
                          disabled={updateLlmConfigMutation.isPending}
                        >
                          Save
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-end gap-4">
                      <div className="flex-1 space-y-2">
                        <Label>Max Tokens</Label>
                        <p className="text-xs text-muted-foreground">
                          Maximum response length (64-8192)
                        </p>
                        <Input
                          type="number"
                          value={maxTokens}
                          onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1024)}
                          min={64}
                          max={8192}
                        />
                      </div>
                      <Button
                        onClick={() => handleSaveLlmConfig({ max_tokens: maxTokens })}
                        disabled={updateLlmConfigMutation.isPending}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Analysis Settings */}
                <div className="space-y-4">
                  <Label className="text-base">Analysis Settings</Label>

                  <div className="flex items-end gap-4">
                    <div className="flex-1 space-y-2">
                      <Label>Concurrency</Label>
                      <p className="text-xs text-muted-foreground">
                        Number of jobs to analyze in parallel (1-10)
                      </p>
                      <Input
                        type="number"
                        value={concurrency}
                        onChange={(e) => setConcurrency(parseInt(e.target.value) || 2)}
                        min={1}
                        max={10}
                      />
                    </div>
                    <Button
                      onClick={() => handleSaveLlmConfig({ concurrency })}
                      disabled={updateLlmConfigMutation.isPending}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Backup & Restore */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Backup & Restore
            </CardTitle>
            <CardDescription>
              Create and manage database backups
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label>Create Backup</Label>
                <p className="text-sm text-muted-foreground">
                  Save a copy of your database
                </p>
              </div>
              <Button
                onClick={() => createBackupMutation.mutate()}
                disabled={createBackupMutation.isPending}
              >
                <Plus className="mr-2 h-4 w-4" />
                {createBackupMutation.isPending ? "Creating..." : "Create Backup"}
              </Button>
            </div>

            <Separator />

            <div>
              <Label>Available Backups</Label>
              <p className="mb-3 text-sm text-muted-foreground">
                {backups?.total || 0} backup{backups?.total !== 1 ? "s" : ""} available
              </p>
              {backupsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : !backups?.backups.length ? (
                <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  No backups yet. Create your first backup above.
                </p>
              ) : (
                <div className="space-y-2">
                  {backups.backups.map((backup) => (
                    <div
                      key={backup.name}
                      className="flex items-center justify-between rounded-lg border bg-muted/30 p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-mono text-sm">{backup.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(backup.size)} •{" "}
                          {format(parseISO(backup.created), "MMM d, yyyy, h:mm a")}
                        </p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <a href={backupApi.download(backup.name)} download>
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Backup</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete &quot;{backup.name}&quot;?
                                This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteBackupMutation.mutate(backup.name)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Data Management
            </CardTitle>
            <CardDescription>Export and manage your data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label>Export Data</Label>
                <p className="text-sm text-muted-foreground">
                  Download all applications as CSV
                </p>
              </div>
              <Button variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Database Stats</Label>
                <p className="text-sm text-muted-foreground">
                  Current database statistics
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-muted-foreground" />
                  <span>{stats?.total || 0} applications</span>
                </div>
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span>{stats?.companies || 0} companies</span>
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Reset Settings</Label>
                <p className="text-sm text-muted-foreground">
                  Restore all settings to default values
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reset to Defaults
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset Settings</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to reset all settings to their default
                      values? This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => resetMutation.mutate()}>
                      Reset Settings
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        {/* Current Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Current Configuration</CardTitle>
            <CardDescription>All saved configuration values</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <pre className="overflow-auto rounded-lg bg-muted p-4 text-sm">
                {JSON.stringify(config?.config, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
