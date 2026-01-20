"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { ShieldAlert, ImageIcon, X, Upload, Sparkles, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Autocomplete } from "@/components/ui/combobox";

import { applicationsApi, companiesApi, bannedCompaniesApi, bannedSourcesApi, filesApi, llmApi } from "@/lib/api";
import {
  statusLabels,
  workLocationLabels,
  type Application,
  type ApplicationStatus,
  type WorkLocation,
  type ExtractedJobData,
} from "@/lib/types";

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

const allWorkLocations: WorkLocation[] = ["remote", "onsite", "hybrid"];

interface ApplicationFormProps {
  application?: Application;
  mode: "create" | "edit";
}

export function ApplicationForm({ application, mode }: ApplicationFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    company_name: application?.company_name_raw || "",
    position: application?.position || "",
    applied_at:
      application?.applied_at || format(new Date(), "yyyy-MM-dd"),
    source: application?.source || "",
    url: application?.url || "",
    notes: application?.notes || "",
    work_location: application?.work_location || "",
    location_address: application?.location_address || "",
    initial_status: application?.current_status || "applied",
  });

  // Image upload state (create mode only)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const showLocationAddress = formData.work_location === "hybrid" || formData.work_location === "onsite";

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Scan image with AI
  const handleScanWithAI = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Please upload an image first");
      return;
    }

    setIsScanning(true);
    try {
      // Use the first image for scanning
      const imageBase64 = await fileToBase64(selectedFiles[0]);
      const extracted = await llmApi.scanJobPosting(imageBase64);

      // Prefill form with extracted data (only non-null values)
      setFormData((prev) => ({
        ...prev,
        company_name: extracted.company_name || prev.company_name,
        position: extracted.position || prev.position,
        source: extracted.source || prev.source,
        url: extracted.url || prev.url,
        work_location: extracted.work_location || prev.work_location,
        location_address: extracted.location_address || prev.location_address,
        notes: extracted.notes || prev.notes,
      }));

      // Count how many fields were extracted
      const fieldsExtracted = [
        extracted.company_name,
        extracted.position,
        extracted.source,
        extracted.url,
        extracted.work_location,
        extracted.location_address,
        extracted.notes,
      ].filter(Boolean).length;

      toast.success(`Extracted ${fieldsExtracted} field${fieldsExtracted !== 1 ? "s" : ""} from image`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to scan image";
      toast.error(message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length !== files.length) {
      toast.error("Only image files are allowed");
    }
    setSelectedFiles((prev) => [...prev, ...imageFiles]);
  }, []);

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  // Fetch unique sources for autocomplete
  const { data: sourcesData } = useQuery({
    queryKey: ["sources"],
    queryFn: applicationsApi.getUniqueSources,
  });

  // Fetch unique positions for autocomplete
  const { data: positionsData } = useQuery({
    queryKey: ["positions"],
    queryFn: applicationsApi.getUniquePositions,
  });

  // Fetch companies for autocomplete
  const { data: companiesData } = useQuery({
    queryKey: ["companies"],
    queryFn: () => companiesApi.list(),
  });

  // Fetch banned companies for warning
  const { data: bannedData } = useQuery({
    queryKey: ["banned-companies"],
    queryFn: () => bannedCompaniesApi.list(),
  });

  // Fetch banned sources for warning
  const { data: bannedSourcesData } = useQuery({
    queryKey: ["banned-sources"],
    queryFn: () => bannedSourcesApi.list(),
  });

  const sources = sourcesData || [];
  const positions = positionsData || [];
  const companyNames = companiesData?.companies.map((c) => c.name) || [];

  // Check if the current company name is banned
  const bannedCompany = bannedData?.banned_companies.find(
    (b) => b.name.trim().toLowerCase() === formData.company_name.trim().toLowerCase()
  );

  // Check if the current source is banned
  const bannedSource = bannedSourcesData?.banned_sources.find(
    (b: { id: number; name: string; reason: string | null; created_at: string | null }) =>
      b.name.trim().toLowerCase() === formData.source.trim().toLowerCase()
  );

  const createMutation = useMutation({
    mutationFn: applicationsApi.create,
    onSuccess: async (data) => {
      // Upload any selected images
      if (selectedFiles.length > 0) {
        toast.info(`Uploading ${selectedFiles.length} image(s)...`);
        const uploadPromises = selectedFiles.map((file) =>
          filesApi.upload(data.id, file).catch((err) => {
            toast.error(`Failed to upload ${file.name}: ${err.message}`);
            return null;
          })
        );
        await Promise.all(uploadPromises);
      }

      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success("Application created!");
      router.push(`/applications/${data.id}`);
    },
    onError: (error) => {
      toast.error(`Failed to create application: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof applicationsApi.update>[1]) =>
      applicationsApi.update(application!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success("Application updated!");
      router.push(`/applications/${application!.id}`);
    },
    onError: (error) => {
      toast.error(`Failed to update application: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Trim all string fields before submission
    const trimmedData = {
      company_name: formData.company_name.trim(),
      position: formData.position.trim(),
      source: formData.source.trim() || null,
      url: formData.url.trim() || null,
      notes: formData.notes.trim() || null,
      location_address: formData.location_address.trim() || null,
    };

    if (mode === "create") {
      createMutation.mutate({
        company_name: trimmedData.company_name,
        position: trimmedData.position,
        applied_at: formData.applied_at,
        source: trimmedData.source,
        url: trimmedData.url,
        notes: trimmedData.notes,
        work_location: (formData.work_location as WorkLocation) || null,
        location_address: trimmedData.location_address,
        initial_status: formData.initial_status as ApplicationStatus,
      });
    } else {
      updateMutation.mutate({
        company_name: trimmedData.company_name,
        position: trimmedData.position,
        source: trimmedData.source,
        url: trimmedData.url,
        work_location: (formData.work_location as WorkLocation) || null,
        location_address: trimmedData.location_address,
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {mode === "create" ? "New Application" : "Edit Application"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Company *</label>
              <Autocomplete
                options={companyNames}
                value={formData.company_name}
                onChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    company_name: value,
                  }))
                }
                placeholder="Type to search or add new company..."
              />
              {bannedCompany && (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/50">
                  <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400" />
                  <div className="text-sm">
                    <p className="font-medium text-red-800 dark:text-red-200">
                      Warning: This company is on your banned list
                    </p>
                    {bannedCompany.reason && (
                      <p className="mt-1 text-red-700 dark:text-red-300">
                        Reason: {bannedCompany.reason}
                      </p>
                    )}
                    <p className="mt-1 text-red-600 dark:text-red-400">
                      You can still submit this application if you wish.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Position *</label>
              <Autocomplete
                options={positions}
                value={formData.position}
                onChange={(value) =>
                  setFormData((prev) => ({ ...prev, position: value }))
                }
                placeholder="Type to search or add new position..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Applied Date *</label>
              <Input
                type="date"
                value={formData.applied_at}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    applied_at: e.target.value,
                  }))
                }
                required
                disabled={mode === "edit"}
              />
            </div>

            {mode === "create" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Initial Status</label>
                <Select
                  value={formData.initial_status}
                  onValueChange={(value: ApplicationStatus) =>
                    setFormData((prev) => ({ ...prev, initial_status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {statusLabels[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Work Location</label>
              <Select
                value={formData.work_location}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, work_location: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location type (optional)" />
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

            {showLocationAddress && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Office Location</label>
                <Input
                  value={formData.location_address}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, location_address: e.target.value }))
                  }
                  placeholder="City, State or full address"
                />
                <p className="text-xs text-muted-foreground">
                  City/address for this {formData.work_location} position
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Source</label>
              <Autocomplete
                options={sources}
                value={formData.source}
                onChange={(value) =>
                  setFormData((prev) => ({ ...prev, source: value }))
                }
                placeholder="Type to search or add new source..."
              />
              {bannedSource && (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/50">
                  <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400" />
                  <div className="text-sm">
                    <p className="font-medium text-red-800 dark:text-red-200">
                      Warning: This platform is on your banned list
                    </p>
                    {bannedSource.reason && (
                      <p className="mt-1 text-red-700 dark:text-red-300">
                        Reason: {bannedSource.reason}
                      </p>
                    )}
                    <p className="mt-1 text-red-600 dark:text-red-400">
                      You can still submit this application if you wish.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Job Posting URL</label>
              <Input
                type="url"
                value={formData.url}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, url: e.target.value }))
                }
                placeholder="https://..."
              />
            </div>

            {mode === "create" && (
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Initial Note (Optional)</label>
                <textarea
                  className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Add an initial note about this application..."
                />
                <p className="text-xs text-muted-foreground">
                  This will be saved as your first note. You can add more notes after creation.
                </p>
              </div>
            )}

            {mode === "create" && (
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Screenshots (Optional)
                  </label>
                  {selectedFiles.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleScanWithAI}
                      disabled={isScanning}
                      className="gap-2"
                    >
                      {isScanning ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Scanning...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Scan with AI
                        </>
                      )}
                    </Button>
                  )}
                </div>
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`
                    rounded-lg border-2 border-dashed p-4 transition-colors
                    ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"}
                  `}
                >
                  {selectedFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-4 text-center">
                      <Upload className="h-8 w-8 text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Drag and drop images here, or{" "}
                        <label className="text-primary hover:underline cursor-pointer">
                          browse
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => handleFileSelect(e.target.files)}
                          />
                        </label>
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        JPEG, PNG, GIF, WebP (max 5MB each)
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {selectedFiles.map((file, index) => (
                          <div
                            key={index}
                            className="relative group rounded-lg overflow-hidden border bg-muted"
                          >
                            <img
                              src={URL.createObjectURL(file)}
                              alt={file.name}
                              className="h-20 w-20 object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeFile(index)}
                              className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3" />
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                              <p className="text-[10px] text-white truncate">
                                {file.name}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <label className="text-xs text-primary hover:underline cursor-pointer">
                        + Add more images
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => handleFileSelect(e.target.files)}
                        />
                      </label>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Attach screenshots of the job posting for reference. Use &quot;Scan with AI&quot; to auto-fill fields.
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Saving..."
                : mode === "create"
                ? "Create Application"
                : "Save Changes"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

