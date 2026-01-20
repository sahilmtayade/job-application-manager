"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Calendar,
  MapPin,
  Briefcase,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ApplicationForm } from "@/components/applications/application-form";
import { NotesSection } from "@/components/applications/notes-section";
import { StatusHistory } from "@/components/applications/status-history";
import { ImagesSection } from "@/components/applications/images-section";
import { applicationsApi } from "@/lib/api";
import {
  statusColors,
  statusLabels,
  workLocationLabels,
  type ApplicationStatus,
  type WorkLocation,
} from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export default function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const numericId = parseInt(id);
  const isValidId = !isNaN(numericId) && numericId > 0;

  const { data: application, isLoading } = useQuery({
    queryKey: ["applications", id],
    queryFn: () => applicationsApi.get(numericId, true),
    enabled: isValidId,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="shrink-0 border-b bg-card px-8 py-4">
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="flex-1 overflow-auto p-8">
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!isValidId || !application) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <p className="text-muted-foreground">Application not found</p>
        <Button variant="link" onClick={() => router.push("/applications")}>
          Back to applications
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="shrink-0 flex items-center gap-4 border-b bg-card px-8 py-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/applications">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {application.company_name || application.company_name_raw}
            </h1>
            {application.current_status && (
              <Badge
                variant="secondary"
                className={cn(
                  "text-white",
                  statusColors[application.current_status as ApplicationStatus]
                )}
              >
                {statusLabels[application.current_status as ApplicationStatus]}
              </Badge>
            )}
            {application.is_deleted && (
              <Badge variant="destructive">Deleted</Badge>
            )}
          </div>
          <p className="text-muted-foreground">{application.position}</p>
        </div>
        {application.url && (
          <Button variant="outline" asChild>
            <a
              href={application.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View Posting
            </a>
          </Button>
        )}
      </header>

      <div className="flex-1 overflow-auto p-8">
        <Tabs defaultValue="details" className="space-y-6">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="status">Status History</TabsTrigger>
            <TabsTrigger value="edit">Edit</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Application Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Applied</p>
                          <p className="text-muted-foreground">
                            {formatDate(application.applied_at, "MMMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      {application.work_location && (
                        <div className="flex items-center gap-3">
                          <MapPin className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Work Location</p>
                            <p className="text-muted-foreground">
                              {workLocationLabels[application.work_location as WorkLocation]}
                              {application.location_address && (
                                <span className="block text-sm">
                                  {application.location_address}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      )}
                      {application.source && (
                        <div className="flex items-center gap-3">
                          <Briefcase className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Source</p>
                            <p className="text-muted-foreground">
                              {application.source}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <NotesSection applicationId={application.id} />

                <ImagesSection applicationId={application.id} />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Info</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {application.current_status && (
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "h-3 w-3 rounded-full",
                            statusColors[application.current_status as ApplicationStatus]
                          )}
                        />
                        <div>
                          <p className="text-sm font-medium">
                            {statusLabels[application.current_status as ApplicationStatus]}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Current status
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full bg-blue-500" />
                      <div>
                        <p className="text-sm font-medium">Applied</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(application.applied_at)}
                        </p>
                      </div>
                    </div>
                    {application.status_updated_at && (
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full bg-purple-500" />
                        <div>
                          <p className="text-sm font-medium">Last Status Change</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(application.status_updated_at)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="status">
            <div className="mx-auto max-w-3xl">
              <StatusHistory applicationId={application.id} />
            </div>
          </TabsContent>

          <TabsContent value="edit">
            <div className="mx-auto max-w-2xl">
              <ApplicationForm application={application} mode="edit" />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
