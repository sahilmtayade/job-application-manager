"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  Bot,
  CheckCircle2,
  Clock,
  Database,
  Download,
  ExternalLink,
  FileCheck,
  Globe,
  HardDrive,
  Laptop,
  Moon,
  Plus,
  RefreshCw,
  Settings2,
  Sun,
  Trash2,
  XCircle
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Header } from "@/components/layout/header";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";


import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";

import { backupApi, configApi, llmApi, statsApi } from "@/lib/api";
import { workLocationLabels, type ApplicationStatus, type LLMConfigUpdate, type WorkLocation } from "@/lib/types";

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

const suggestedOllamaModels = [
  {
    name: "llama3.1:8b",
    role: "Text",
    size: "8B",
    ram: "8-12 GB",
    url: "https://ollama.com/library/llama3.1",
  },
  {
    name: "qwen2.5:7b",
    role: "Text",
    size: "7B",
    ram: "8-12 GB",
    url: "https://ollama.com/library/qwen2.5",
  },
  {
    name: "mistral:7b",
    role: "Text",
    size: "7B",
    ram: "8-12 GB",
    url: "https://ollama.com/library/mistral",
  },
  {
    name: "llava:7b",
    role: "Vision",
    size: "7B",
    ram: "10-14 GB",
    url: "https://ollama.com/library/llava",
  },
  {
    name: "llava:13b",
    role: "Vision",
    size: "13B",
    ram: "16-24 GB",
    url: "https://ollama.com/library/llava",
  },
  {
    name: "qwen2.5vl:7b",
    role: "Vision",
    size: "7B",
    ram: "10-14 GB",
    url: "https://ollama.com/library/qwen2.5vl",
  },
];

const ramGuidanceRows = [
  { modelSize: "3B", minRam: "6 GB", recommendedRam: "8 GB", note: "Good for lightweight text tasks" },
  { modelSize: "7B", minRam: "10 GB", recommendedRam: "12-16 GB", note: "Strong default for text and some vision" },
  { modelSize: "8B", minRam: "12 GB", recommendedRam: "16 GB", note: "Reliable quality for most text tasks" },
  { modelSize: "13B", minRam: "18 GB", recommendedRam: "24 GB", note: "Better quality, heavier memory usage" },
  { modelSize: "34B+", minRam: "40 GB", recommendedRam: "64 GB+", note: "Usually requires high-end workstation" },
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
  const [logoDevPublishableKey, setLogoDevPublishableKey] = useState("");

  // Candidate Profile State
  const [candidateSkills, setCandidateSkills] = useState("");
  const [candidateExp, setCandidateExp] = useState("");
  const [candidateLoc, setCandidateLoc] = useState("");
  const [candidateClearance, setCandidateClearance] = useState("");
  const [candidateDisqualifiers, setCandidateDisqualifiers] = useState("");

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

  const { data: llmModels, isLoading: llmModelsLoading, refetch: refetchLlmModels } = useQuery({
    queryKey: ["llm", "models"],
    queryFn: () => llmApi.getModels(),
    refetchInterval: 30000,
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

  const availableModelNames =
    llmModels?.models?.map((m) => m.name) && llmModels.models.length > 0
      ? llmModels.models.map((m) => m.name)
      : llmStatus?.available_models || [];

  const modelMetadataByName = Object.fromEntries(
    (llmModels?.models || []).map((m) => [m.name, m])
  );

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

  const formatModelSize = (sizeBytes?: number | null) => {
    if (!sizeBytes || sizeBytes <= 0) return "Unknown";
    return `${(sizeBytes / (1024 ** 3)).toFixed(1)} GB`;
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

        {/* Integrations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Integrations
            </CardTitle>
            <CardDescription>
              Configure third-party API keys and integration services
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                <div className="flex items-end gap-4">
                  <div className="flex-1 space-y-2">
                    <Label>Logo.dev Publishable Key</Label>
                    <Input
                      type="password"
                      value={logoDevPublishableKey || config?.config?.logo_dev_publishable_key || ""}
                      onChange={(e) => setLogoDevPublishableKey(e.target.value)}
                      placeholder="pk_..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Retrieves company logos for job search results. You must use the Publishable Key (pk_...) from Logo.dev, not the Secret Key.
                    </p>
                  </div>
                  <Button
                    onClick={() => handleSave("logo_dev_publishable_key", logoDevPublishableKey)}
                    disabled={setMutation.isPending}
                  >
                    Save
                  </Button>
                </div>
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
            {llmConfigLoading || llmStatusLoading || llmModelsLoading ? (
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
                          ? `${availableModelNames.length} models available`
                          : "Check server URL and ensure LLM server is running"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      refetchLlmStatus();
                      refetchLlmModels();
                    }}
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
                          {availableModelNames.map((model) => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {visionModel && (
                        <p className="text-xs text-muted-foreground">
                          Selected size: {formatModelSize(modelMetadataByName[visionModel]?.size_bytes)}
                        </p>
                      )}
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
                          {availableModelNames.map((model) => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {textModel && (
                        <p className="text-xs text-muted-foreground">
                          Selected size: {formatModelSize(modelMetadataByName[textModel]?.size_bytes)}
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={() => handleSaveLlmConfig({ text_model: textModel })}
                      disabled={updateLlmConfigMutation.isPending}
                    >
                      Save
                    </Button>
                  </div>

                  {llmStatus?.available && availableModelNames.length === 0 && (
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      No models found on the server yet. Pull one first, for example: <span className="font-mono">ollama pull llava:7b</span>
                    </p>
                  )}
                </div>

                <Separator />

                {/* Suggested Models */}
                <div className="space-y-4">
                  <Label className="text-base">Suggested Models</Label>
                  <p className="text-xs text-muted-foreground">
                    Quick picks for Ollama with links to the model pages.
                  </p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {suggestedOllamaModels.map((model) => {
                      const isInstalled = availableModelNames.some((available) => available.startsWith(model.name.split(":")[0]));
                      return (
                        <div key={model.name} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">{model.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {model.role} • {model.size} • ~{model.ram} RAM
                              </p>
                            </div>
                            {isInstalled ? (
                              <Badge variant="secondary">Installed</Badge>
                            ) : (
                              <Badge variant="outline">Not installed</Badge>
                            )}
                          </div>
                          <a
                            className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            href={model.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View on Ollama
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                {/* RAM Guidance */}
                <div className="space-y-4">
                  <Label className="text-base">Model Size vs RAM</Label>
                  <p className="text-xs text-muted-foreground">
                    Your detected system RAM: {llmModels?.system_memory_gb ? `${llmModels.system_memory_gb.toFixed(2)} GB` : "Unavailable"}
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Model Size</TableHead>
                        <TableHead>Minimum RAM</TableHead>
                        <TableHead>Recommended RAM</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ramGuidanceRows.map((row) => (
                        <TableRow key={row.modelSize}>
                          <TableCell>{row.modelSize}</TableCell>
                          <TableCell>{row.minRam}</TableCell>
                          <TableCell>{row.recommendedRam}</TableCell>
                          <TableCell>{row.note}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {llmModels?.models && llmModels.models.length > 0 && (
                    <div className="rounded-lg border p-3">
                      <p className="mb-2 text-sm font-medium">Installed Models & Sizes</p>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {llmModels.models.map((model) => (
                          <p key={model.name}>
                            {model.name} — {formatModelSize(model.size_bytes)}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
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
