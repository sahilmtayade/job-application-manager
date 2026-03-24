"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlertTriangle,
  Braces,
    Camera,
    CheckCircle2,
  Code2,
    FileText,
    HelpCircle,
    Image as ImageIcon,
    Lightbulb,
    Link,
    Loader2,
    Plus,
    Shield,
    Sparkles,
    Target,
    Trash2,
    Upload,
    X,
    XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

import { llmApi, resumeApi } from "@/lib/api";
import type { FitAnalysis } from "@/lib/types";

type JobInputMode = "screenshot" | "url";
type UrlStepStatus = "idle" | "loading" | "success" | "error";

export default function JobFitPage() {
  const queryClient = useQueryClient();

  // Resume state
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [useStoredResume, setUseStoredResume] = useState(true);

  // Job posting input mode
  const [jobInputMode, setJobInputMode] = useState<JobInputMode>("screenshot");

  // Screenshot mode state — supports multiple images
  const [jobPostingFiles, setJobPostingFiles] = useState<File[]>([]);
  const [jobPostingPreviews, setJobPostingPreviews] = useState<string[]>([]);
  const [parsedJobPreview, setParsedJobPreview] = useState<Record<string, unknown> | null>(null);
  const [isPreviewingParsedJob, setIsPreviewingParsedJob] = useState(false);
  const screenshotDropRef = useRef<HTMLDivElement>(null);

  // URL mode state
  const [jobPostingUrl, setJobPostingUrl] = useState("");
  const [urlPipelineOpen, setUrlPipelineOpen] = useState(false);
  const [urlFetchStatus, setUrlFetchStatus] = useState<UrlStepStatus>("idle");
  const [urlFetchError, setUrlFetchError] = useState<string | null>(null);
  const [urlParsedStatus, setUrlParsedStatus] = useState<UrlStepStatus>("idle");
  const [urlParsedError, setUrlParsedError] = useState<string | null>(null);
  const [urlAnalysisStatus, setUrlAnalysisStatus] = useState<UrlStepStatus>("idle");
  const [urlAnalysisError, setUrlAnalysisError] = useState<string | null>(null);
  const [urlPreviewImage, setUrlPreviewImage] = useState<string | null>(null);
  const [urlPreviewText, setUrlPreviewText] = useState<string | null>(null);
  const [urlRawHtml, setUrlRawHtml] = useState<string | null>(null);
  const [urlParsedPreview, setUrlParsedPreview] = useState<Record<string, unknown> | null>(null);

  // Analysis state
  const [analysis, setAnalysis] = useState<FitAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<{
    phase: number;
    totalPhases: number;
    message: string;
  } | null>(null);

  // Fetch stored resume info
  const { data: storedResume, isLoading: isLoadingResume } = useQuery({
    queryKey: ["resume-info"],
    queryFn: resumeApi.getInfo,
  });

  // Upload resume mutation
  const uploadResumeMutation = useMutation({
    mutationFn: resumeApi.upload,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resume-info"] });
      toast.success("Resume uploaded and saved");
      setResumeFile(null);
      setUseStoredResume(true);
    },
    onError: (error) => {
      toast.error(`Failed to upload resume: ${error.message}`);
    },
  });

  // Delete resume mutation
  const deleteResumeMutation = useMutation({
    mutationFn: resumeApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resume-info"] });
      toast.success("Resume deleted");
      setUseStoredResume(false);
    },
  });

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Handle resume file selection (images or PDF)
  const handleResumeSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const allowed = file.type.startsWith("image/") || file.type === "application/pdf";
    if (!allowed) {
      toast.error("Please upload a PDF or image file.");
      return;
    }
    setResumeFile(file);
    setUseStoredResume(false);
  }, []);

  // Add job posting screenshots (accumulate, not replace)
  const addJobPostingFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    const images = arr.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) {
      toast.error("Please upload image files only");
      return;
    }
    if (images.length < arr.length) {
      toast.warning(`${arr.length - images.length} non-image file(s) were skipped`);
    }
    setJobPostingFiles((prev) => [...prev, ...images]);
    images.forEach((img) => {
      const url = URL.createObjectURL(img);
      setJobPostingPreviews((prev) => [...prev, url]);
    });
  }, []);

  const removeJobPostingFile = useCallback((idx: number) => {
    setJobPostingFiles((prev) => prev.filter((_, i) => i !== idx));
    setJobPostingPreviews((prev) => {
      URL.revokeObjectURL(prev[idx]);
      return prev.filter((_, i) => i !== idx);
    });
    setParsedJobPreview(null);
  }, []);

  // Paste handler — catches clipboard images (Snipping Tool, etc.)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (jobInputMode !== "screenshot") return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageItems = Array.from(items).filter((i) => i.type.startsWith("image/"));
      if (imageItems.length === 0) return;
      e.preventDefault();
      const files = imageItems
        .map((i) => i.getAsFile())
        .filter((f): f is File => f !== null);
      if (files.length > 0) {
        addJobPostingFiles(files);
        toast.success(`Pasted ${files.length} image${files.length > 1 ? "s" : ""} from clipboard`);
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [jobInputMode, addJobPostingFiles]);

  // Drag-and-drop for screenshot zone
  const handleScreenshotDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      addJobPostingFiles(e.dataTransfer.files);
    },
    [addJobPostingFiles]
  );

  // Save resume for future use
  const handleSaveResume = () => {
    if (resumeFile) {
      uploadResumeMutation.mutate(resumeFile);
    }
  };

  const handlePreviewParsedJob = async () => {
    if (jobPostingFiles.length === 0) {
      toast.error("Please upload at least one job posting screenshot");
      return;
    }

    setIsPreviewingParsedJob(true);
    try {
      const imageBase64 = await fileToBase64(jobPostingFiles[0]);
      const parsed = await llmApi.previewJobRequirements(imageBase64);
      setParsedJobPreview(parsed);
      toast.success("Parsed preview generated");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate parsed preview";
      toast.error(message);
    } finally {
      setIsPreviewingParsedJob(false);
    }
  };

  const resetUrlPipelineState = () => {
    setUrlFetchStatus("idle");
    setUrlFetchError(null);
    setUrlParsedStatus("idle");
    setUrlParsedError(null);
    setUrlAnalysisStatus("idle");
    setUrlAnalysisError(null);
    setUrlPreviewImage(null);
    setUrlPreviewText(null);
    setUrlRawHtml(null);
    setUrlParsedPreview(null);
  };

  // Check whether inputs are ready for analysis
  const hasJobPosting =
    jobInputMode === "screenshot"
      ? jobPostingFiles.length > 0
      : jobPostingUrl.trim().length > 0;

  // Analyze job fit
  const handleAnalyze = async () => {
    if (!hasJobPosting) {
      toast.error(
        jobInputMode === "screenshot"
          ? "Please upload at least one job posting screenshot"
          : "Please enter a job posting URL"
      );
      return;
    }

    const hasResume = useStoredResume ? storedResume?.has_resume : resumeFile;
    if (!hasResume) {
      toast.error("Please upload a resume or use your stored resume");
      return;
    }

    setIsAnalyzing(true);
    setAnalysis(null);
    setAnalysisProgress(null);

    try {
      // Get resume base64
      let resumeBase64: string;
      if (useStoredResume && storedResume?.has_resume) {
        const resumeData = await resumeApi.getData();
        if (!resumeData.data || !resumeData.mime_type) {
          throw new Error("Could not load stored resume");
        }
        resumeBase64 = `data:${resumeData.mime_type};base64,${resumeData.data}`;
      } else if (resumeFile) {
        resumeBase64 = await fileToBase64(resumeFile);
      } else {
        throw new Error("No resume available");
      }

      let result: FitAnalysis;

      if (jobInputMode === "url") {
        const trimmedUrl = jobPostingUrl.trim();
        setUrlPipelineOpen(true);
        resetUrlPipelineState();

        setUrlFetchStatus("loading");

        try {
          const fetchResult = await llmApi.fetchJobUrl(trimmedUrl);
          if (!fetchResult.success) {
            throw new Error(fetchResult.error || "Failed to fetch URL content");
          }

          setUrlPreviewImage(fetchResult.preview_image_url || null);
          setUrlPreviewText(fetchResult.text_preview || null);
          setUrlRawHtml(fetchResult.raw_html || null);
          setUrlFetchStatus("success");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to fetch URL content";
          setUrlFetchStatus("error");
          setUrlFetchError(message);
          toast.error(message);
          return;
        }

        setUrlParsedStatus("loading");
        try {
          const parsed = await llmApi.previewJobRequirementsFromUrl(trimmedUrl);
          setUrlParsedPreview(parsed);
          setUrlParsedStatus("success");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to extract JSON from URL";
          setUrlParsedStatus("error");
          setUrlParsedError(message);
          toast.error(message);
        }

        setUrlAnalysisStatus("loading");
        try {
          result = await llmApi.analyzeFitFromUrlStream(
            trimmedUrl,
            resumeBase64,
            (progress) => setAnalysisProgress(progress)
          );
          setUrlAnalysisStatus("success");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to analyze job fit from URL";
          setUrlAnalysisStatus("error");
          setUrlAnalysisError(message);
          toast.error(message);
          return;
        }
      } else {
        // Screenshot mode — use first image (legacy path, good for most cases)
        // If multiple screenshots were provided, use only the first for now since
        // the model processes one image at a time.
        const jobPostingBase64 = await fileToBase64(jobPostingFiles[0]);
        result = await llmApi.analyzeFitStream(
          jobPostingBase64,
          resumeBase64,
          (progress) => setAnalysisProgress(progress)
        );
      }

      setAnalysis(result);
      toast.success("Analysis complete!");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to analyze job fit";
      toast.error(message);
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(null);
    }
  };

  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };

  // Get risk level color
  const getRiskColor = (level: string) => {
    if (level === "low") return "bg-green-500/10 text-green-500 border-green-500/20";
    if (level === "medium") return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    return "bg-red-500/10 text-red-500 border-red-500/20";
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Dialog open={urlPipelineOpen} onOpenChange={setUrlPipelineOpen}>
        <DialogContent className="sm:max-w-6xl p-0 max-h-[90vh] overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2 border-b">
            <DialogTitle>URL Processing Preview</DialogTitle>
            <DialogDescription>
              Review scraped screenshot metadata, raw HTML, and extracted JSON before AI fit analysis.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 p-4 md:grid-cols-3 overflow-y-auto">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Screenshot Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {urlFetchStatus === "loading" ? (
                  <div className="flex h-48 items-center justify-center text-sm text-muted-foreground gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Scraping URL...
                  </div>
                ) : urlFetchStatus === "error" ? (
                  <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400">
                    <p className="font-medium">Could not fetch screenshot metadata</p>
                    <p className="mt-1 text-xs">{urlFetchError || "URL fetch failed"}</p>
                  </div>
                ) : urlPreviewImage ? (
                  <img
                    src={urlPreviewImage}
                    alt="Job posting preview"
                    className="w-full max-h-56 object-contain rounded-md border bg-background"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
                    No preview image metadata found on this page.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Code2 className="h-4 w-4" />
                  Raw HTML
                </CardTitle>
              </CardHeader>
              <CardContent>
                {urlFetchStatus === "loading" ? (
                  <div className="flex h-48 items-center justify-center text-sm text-muted-foreground gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading HTML...
                  </div>
                ) : urlFetchStatus === "error" ? (
                  <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400">
                    <p className="font-medium">No HTML available</p>
                    <p className="mt-1 text-xs">{urlFetchError || "URL fetch failed"}</p>
                  </div>
                ) : urlRawHtml ? (
                  <div className="rounded-md border bg-muted/20 p-3 max-h-64 overflow-auto">
                    <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words">{urlRawHtml}</pre>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
                    HTML content is empty.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Braces className="h-4 w-4" />
                  Extracted JSON
                </CardTitle>
              </CardHeader>
              <CardContent>
                {urlParsedStatus === "loading" ? (
                  <div className="flex h-48 items-center justify-center text-sm text-muted-foreground gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Extracting structured JSON...
                  </div>
                ) : urlParsedStatus === "error" ? (
                  <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400">
                    <p className="font-medium">JSON extraction failed</p>
                    <p className="mt-1 text-xs">{urlParsedError || "Could not extract JSON"}</p>
                  </div>
                ) : urlParsedPreview ? (
                  <div className="rounded-md border bg-muted/20 p-3 max-h-64 overflow-auto">
                    <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words">
                      {JSON.stringify(urlParsedPreview, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
                    JSON extraction has not started yet.
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="md:col-span-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Fit Generation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {urlAnalysisStatus === "loading" ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {analysisProgress?.message || "Generating fit analysis..."}
                      </div>
                      {analysisProgress && (
                        <Progress
                          value={(analysisProgress.phase / analysisProgress.totalPhases) * 100}
                          className="h-2"
                        />
                      )}
                    </div>
                  ) : urlAnalysisStatus === "error" ? (
                    <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400">
                      <p className="font-medium">Fit generation failed</p>
                      <p className="mt-1 text-xs">{urlAnalysisError || "Failed to generate fit analysis"}</p>
                    </div>
                  ) : urlAnalysisStatus === "success" ? (
                    <div className="rounded-md border border-green-500/30 bg-green-500/5 p-3 text-sm text-green-700 dark:text-green-300">
                      Fit analysis generated successfully. See detailed results below.
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                      Run analysis to generate fit scoring.
                    </div>
                  )}
                  {urlPreviewText && (
                    <p className="text-xs text-muted-foreground mt-3 line-clamp-3">
                      Text preview: {urlPreviewText}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Header title="Job Fit Analyzer" badge="Beta" />
      <div className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Info Banner */}
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Target className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-700 dark:text-blue-300">
                    AI-Powered Job Fit Analysis
                  </p>
                  <p className="text-blue-600/80 dark:text-blue-400/80 mt-1">
                    Provide your resume and a job posting (via URL or screenshot) to get a detailed
                    compatibility analysis, including skills match, experience level check, and scam detection.
                    PDF resumes are preferred — text is extracted directly for better accuracy.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Resume Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Your Resume
                </CardTitle>
                <CardDescription>
                  Upload a new resume or use your previously saved one. PDF and image formats supported.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stored Resume Option */}
                {isLoadingResume ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading saved resume...
                  </div>
                ) : storedResume?.has_resume ? (
                  <div
                    onClick={() => {
                      setUseStoredResume(true);
                      setResumeFile(null);
                    }}
                    className={`
                      p-3 rounded-lg border-2 cursor-pointer transition-colors
                      ${useStoredResume && !resumeFile
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/50"
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{storedResume.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            Uploaded {storedResume.uploaded_at
                              ? new Date(storedResume.uploaded_at).toLocaleDateString()
                              : "previously"
                            }
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {useStoredResume && !resumeFile && (
                          <Badge variant="secondary">Selected</Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteResumeMutation.mutate();
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Upload New Resume */}
                <div
                  className={`
                    rounded-lg border-2 border-dashed p-4 transition-colors
                    ${resumeFile ? "border-primary bg-primary/5" : "border-muted-foreground/25"}
                  `}
                >
                  {resumeFile ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm font-medium">{resumeFile.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSaveResume}
                          disabled={uploadResumeMutation.isPending}
                        >
                          {uploadResumeMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Save for later"
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setResumeFile(null);
                            if (storedResume?.has_resume) setUseStoredResume(true);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-4 text-center">
                      <Upload className="h-8 w-8 text-muted-foreground/50 mb-2" />
                      <label className="text-sm text-muted-foreground cursor-pointer">
                        <span className="text-primary hover:underline">Upload resume (PDF or image)</span>
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          className="hidden"
                          onChange={(e) => handleResumeSelect(e.target.files)}
                        />
                      </label>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        PDF (recommended for LaTeX resumes) or image
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Job Posting Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Job Posting
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs text-sm space-y-2 p-3">
                        <p className="font-semibold">How to provide the job posting</p>
                        <p><strong>URL:</strong> Paste the direct job posting link. Works best on sites that do not block bots (e.g. company career pages). LinkedIn/Indeed may block access — use screenshots instead.</p>
                        <p><strong>Screenshot tips:</strong></p>
                        <ul className="list-disc ml-4 space-y-1">
                          <li>Capture the full posting including title, requirements, and description.</li>
                          <li><strong>Windows:</strong> Press <kbd>Win+Shift+S</kbd> to open Snipping Tool, select the area, then paste here with <kbd>Ctrl+V</kbd>.</li>
                          <li><strong>Mac:</strong> Press <kbd>Cmd+Shift+4</kbd>, drag to select, then paste with <kbd>Cmd+V</kbd>.</li>
                          <li>If the posting is long, take multiple screenshots and upload them all.</li>
                          <li>Drag &amp; drop images or use the file picker.</li>
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>

                {/* Mode toggle */}
                <div className="flex gap-1 mt-1 rounded-lg bg-muted p-1 w-fit">
                  <button
                    onClick={() => {
                      setJobInputMode("screenshot");
                      setParsedJobPreview(null);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      jobInputMode === "screenshot"
                        ? "bg-background shadow text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Camera className="h-3.5 w-3.5" />
                    Screenshot
                  </button>
                  <button
                    onClick={() => {
                      setJobInputMode("url");
                      setParsedJobPreview(null);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      jobInputMode === "url"
                        ? "bg-background shadow text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Link className="h-3.5 w-3.5" />
                    URL
                  </button>
                </div>
              </CardHeader>

              <CardContent>
                {jobInputMode === "url" ? (
                  /* ── URL mode ── */
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://company.com/jobs/123"
                        value={jobPostingUrl}
                        onChange={(e) => {
                          setJobPostingUrl(e.target.value);
                          resetUrlPipelineState();
                          setUrlPreviewImage(null);
                          setUrlPreviewText(null);
                          setUrlRawHtml(null);
                          setUrlParsedPreview(null);
                        }}
                        onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                      />
                      {jobPostingUrl && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 flex-shrink-0"
                          onClick={() => {
                            setJobPostingUrl("");
                            resetUrlPipelineState();
                            setUrlPreviewImage(null);
                            setUrlPreviewText(null);
                            setUrlRawHtml(null);
                            setUrlParsedPreview(null);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Click <span className="font-medium">Analyze Job Fit</span> once to run all URL steps and open a full preview popup.
                    </p>

                    <p className="text-xs text-muted-foreground">
                      Works best on company career pages. LinkedIn, Indeed, and similar sites often block
                      automated access — use screenshots for those.
                    </p>
                  </div>
                ) : (
                  /* ── Screenshot mode ── */
                  <div className="space-y-3">
                    {/* Drop zone */}
                    <div
                      ref={screenshotDropRef}
                      onDrop={handleScreenshotDrop}
                      onDragOver={(e) => e.preventDefault()}
                      className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 transition-colors hover:border-muted-foreground/40"
                    >
                      <div className="flex flex-col items-center justify-center py-4 text-center">
                        <Upload className="h-8 w-8 text-muted-foreground/50 mb-2" />
                        <label className="text-sm text-muted-foreground cursor-pointer">
                          <span className="text-primary hover:underline">Upload screenshot(s)</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files) addJobPostingFiles(e.target.files);
                              setParsedJobPreview(null);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          JPEG, PNG, WebP · drag &amp; drop · or <kbd className="px-1 py-0.5 rounded bg-muted text-xs">Ctrl+V</kbd> to paste
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">
                          Multiple screenshots supported for long postings
                        </p>
                      </div>
                    </div>

                    {/* Uploaded images list */}
                    {jobPostingFiles.length > 0 && (
                      <div className="space-y-2">
                        {jobPostingFiles.map((file, idx) => (
                          <div key={idx} className="rounded-lg border bg-muted/30 overflow-hidden">
                            <div className="flex items-center justify-between px-3 py-2">
                              <span className="text-sm font-medium truncate max-w-[180px]">
                                {file.name || `Screenshot ${idx + 1}`}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 flex-shrink-0"
                                onClick={() => removeJobPostingFile(idx)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <img
                              src={jobPostingPreviews[idx]}
                              alt={`Screenshot ${idx + 1}`}
                              className="w-full max-h-40 object-contain bg-background border-t"
                            />
                          </div>
                        ))}

                        {/* Add more button */}
                        <label className="flex items-center gap-2 text-sm text-primary cursor-pointer hover:underline w-fit">
                          <Plus className="h-4 w-4" />
                          Add another screenshot
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files) addJobPostingFiles(e.target.files);
                              setParsedJobPreview(null);
                              e.target.value = "";
                            }}
                          />
                        </label>

                        <div className="pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handlePreviewParsedJob}
                            disabled={isPreviewingParsedJob || jobPostingFiles.length === 0}
                            className="gap-2"
                          >
                            {isPreviewingParsedJob ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Parsing screenshot...
                              </>
                            ) : (
                              "Show parsed preview"
                            )}
                          </Button>
                          {jobPostingFiles.length > 1 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Using the first screenshot for this preview.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {parsedJobPreview && (
                      <div className="rounded-lg border bg-muted/20 overflow-hidden">
                        <div className="px-3 py-2 border-b bg-muted/30">
                          <p className="text-xs font-medium text-muted-foreground">
                            Parsed Preview (comparison format)
                          </p>
                        </div>
                        <div className="p-3">
                          <pre className="text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap break-words">
                            {JSON.stringify(parsedJobPreview, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Help hint */}
                    {jobPostingFiles.length === 0 && (
                      <p className="text-xs text-muted-foreground/70">
                        <strong>Tip:</strong> Scroll through the full job posting before screenshotting.
                        Capture the job title, requirements, responsibilities, and any salary/location info.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Analyze Button */}
          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={handleAnalyze}
              disabled={isAnalyzing || !hasJobPosting || (!resumeFile && !storedResume?.has_resume)}
              className="gap-2"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  {jobInputMode === "url" ? "Analyze URL Job Fit" : "Analyze Job Fit"}
                </>
              )}
            </Button>
          </div>

          {/* Progress Indicator */}
          {isAnalyzing && analysisProgress && (
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      Phase {analysisProgress.phase} of {analysisProgress.totalPhases}
                    </span>
                    <span className="text-muted-foreground">
                      {Math.round((analysisProgress.phase / analysisProgress.totalPhases) * 100)}%
                    </span>
                  </div>
                  <Progress
                    value={(analysisProgress.phase / analysisProgress.totalPhases) * 100}
                    className="h-2"
                  />
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {analysisProgress.message}
                  </div>
                  <div className="flex gap-2">
                    {[1, 2, 3].map((phase) => (
                      <div
                        key={phase}
                        className={`flex-1 rounded-full h-1.5 ${
                          phase < analysisProgress.phase
                            ? "bg-green-500"
                            : phase === analysisProgress.phase
                            ? "bg-primary animate-pulse"
                            : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Resume</span>
                    <span>Job Posting</span>
                    <span>Analysis</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Analysis Results */}
          {analysis && (
            <Card>
              <CardHeader>
                <CardTitle>Analysis Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Score and Summary */}
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className={`text-5xl font-bold ${getScoreColor(analysis.score)}`}>
                      {analysis.score}
                    </div>
                    <div className="text-sm text-muted-foreground">Match Score</div>
                  </div>
                  <div className="flex-1">
                    <Progress value={analysis.score} className="h-3" />
                    <div className="flex items-center gap-2 mt-2">
                      {analysis.compatible ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Compatible
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
                          <XCircle className="h-3 w-3 mr-1" />
                          Not Compatible
                        </Badge>
                      )}
                      <Badge variant="outline" className={getRiskColor(analysis.scam_analysis.risk_level)}>
                        <Shield className="h-3 w-3 mr-1" />
                        {analysis.scam_analysis.risk_level.charAt(0).toUpperCase() + analysis.scam_analysis.risk_level.slice(1)} Scam Risk
                      </Badge>
                    </div>
                  </div>
                </div>

                <p className="text-muted-foreground">{analysis.summary}</p>

                <Separator />

                {/* Skills Match */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Skills Match
                  </h4>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Matched Skills</p>
                      <div className="flex flex-wrap gap-1">
                        {analysis.skills_match.matched.length > 0 ? (
                          analysis.skills_match.matched.map((skill, i) => (
                            <Badge key={i} variant="secondary" className="bg-green-500/10 text-green-600">
                              {skill}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">None identified</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Missing Skills</p>
                      <div className="flex flex-wrap gap-1">
                        {analysis.skills_match.missing.length > 0 ? (
                          analysis.skills_match.missing.map((skill, i) => (
                            <Badge key={i} variant="secondary" className="bg-red-500/10 text-red-600">
                              {skill}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">None</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Bonus Skills</p>
                      <div className="flex flex-wrap gap-1">
                        {analysis.skills_match.bonus.length > 0 ? (
                          analysis.skills_match.bonus.map((skill, i) => (
                            <Badge key={i} variant="secondary" className="bg-blue-500/10 text-blue-600">
                              {skill}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">None</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Experience Match */}
                <div>
                  <h4 className="font-medium mb-3">Experience Level</h4>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">
                      Required: {analysis.experience_match.required_level}
                    </Badge>
                    {analysis.experience_match.compatible ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {analysis.experience_match.assessment}
                  </p>
                </div>

                {/* Red Flags */}
                {analysis.red_flags.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2 text-orange-500">
                        <AlertTriangle className="h-4 w-4" />
                        Red Flags
                      </h4>
                      <ul className="space-y-1">
                        {analysis.red_flags.map((flag, i) => (
                          <li key={i} className="text-sm text-orange-600 dark:text-orange-400 flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                            {flag}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}

                {/* Scam Analysis */}
                <Separator />
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Scam Analysis
                  </h4>
                  {analysis.scam_analysis.warnings.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-muted-foreground mb-2">Warnings</p>
                      <ul className="space-y-1">
                        {analysis.scam_analysis.warnings.map((warning, i) => (
                          <li key={i} className="text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
                            <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {analysis.scam_analysis.legitimate_signals.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Legitimate Signals</p>
                      <ul className="space-y-1">
                        {analysis.scam_analysis.legitimate_signals.map((signal, i) => (
                          <li key={i} className="text-sm text-green-600 dark:text-green-400 flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            {signal}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Recommendations */}
                {analysis.recommendations.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Lightbulb className="h-4 w-4" />
                        Recommendations
                      </h4>
                      <ul className="space-y-2">
                        {analysis.recommendations.map((rec, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

