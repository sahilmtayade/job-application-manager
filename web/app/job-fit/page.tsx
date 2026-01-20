"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  X,
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  Target,
  Lightbulb,
  Trash2,
} from "lucide-react";

import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

import { llmApi, resumeApi } from "@/lib/api";
import type { FitAnalysis } from "@/lib/types";

export default function JobFitPage() {
  const queryClient = useQueryClient();

  // Resume state
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [useStoredResume, setUseStoredResume] = useState(true);

  // Job posting state
  const [jobPostingFile, setJobPostingFile] = useState<File | null>(null);
  const [jobPostingPreview, setJobPostingPreview] = useState<string | null>(null);

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

  // Handle resume file selection (images only - vision models can't process PDFs)
  const handleResumeSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (screenshot of your resume). PDFs cannot be processed by AI.");
      return;
    }
    setResumeFile(file);
    setUseStoredResume(false);
  }, []);

  // Handle job posting file selection
  const handleJobPostingSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    setJobPostingFile(file);
    setJobPostingPreview(URL.createObjectURL(file));
  }, []);

  // Save resume for future use
  const handleSaveResume = () => {
    if (resumeFile) {
      uploadResumeMutation.mutate(resumeFile);
    }
  };

  // Analyze job fit
  const handleAnalyze = async () => {
    // Validate inputs
    if (!jobPostingFile) {
      toast.error("Please upload a job posting screenshot");
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
      // Get job posting base64
      const jobPostingBase64 = await fileToBase64(jobPostingFile);

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

      // Call streaming API with progress updates
      const result = await llmApi.analyzeFitStream(
        jobPostingBase64,
        resumeBase64,
        (progress) => {
          setAnalysisProgress(progress);
        }
      );
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
                    Upload your resume and a job posting screenshot to get a detailed compatibility analysis,
                    including skills match, experience level check, and scam detection.
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
                  Upload a new resume or use your previously saved one
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
                        <span className="text-primary hover:underline">Upload resume screenshot</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleResumeSelect(e.target.files)}
                        />
                      </label>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        Image only (screenshot of your resume)
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
                </CardTitle>
                <CardDescription>
                  Upload a screenshot of the job posting to analyze
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className={`
                    rounded-lg border-2 border-dashed p-4 transition-colors
                    ${jobPostingFile ? "border-primary bg-primary/5" : "border-muted-foreground/25"}
                  `}
                >
                  {jobPostingFile ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{jobPostingFile.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setJobPostingFile(null);
                            setJobPostingPreview(null);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {jobPostingPreview && (
                        <img
                          src={jobPostingPreview}
                          alt="Job posting preview"
                          className="w-full rounded-md border max-h-48 object-contain bg-muted"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground/50 mb-2" />
                      <label className="text-sm text-muted-foreground cursor-pointer">
                        <span className="text-primary hover:underline">Upload job posting screenshot</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleJobPostingSelect(e.target.files)}
                        />
                      </label>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        JPEG, PNG, WebP, GIF
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Analyze Button */}
          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={handleAnalyze}
              disabled={isAnalyzing || !jobPostingFile || (!resumeFile && !storedResume?.has_resume)}
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
                  Analyze Job Fit
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

