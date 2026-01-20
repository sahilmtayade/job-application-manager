"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, FileText, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { applicationsApi, bannedCompaniesApi } from "@/lib/api";
import { statusColors, statusLabels, type ApplicationStatus } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export function RecentApplications() {
  const { data, isLoading } = useQuery({
    queryKey: ["applications", "recent"],
    queryFn: () => applicationsApi.list({ limit: 5 }),
  });

  const { data: bannedData } = useQuery({
    queryKey: ["banned-companies"],
    queryFn: () => bannedCompaniesApi.list(),
  });

  // Create a Set of banned company names for quick lookup (case-insensitive)
  const bannedNames = new Set(
    bannedData?.banned_companies.map((b) => b.name.trim().toLowerCase()) || []
  );

  const isCompanyBanned = (name: string) => bannedNames.has(name.trim().toLowerCase());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Applications</CardTitle>
        <CardDescription>Your latest job applications</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        ) : data?.applications.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No applications yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start tracking your job search journey by adding your first application
            </p>
            <Link href="/applications/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Application
              </Button>
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.applications.map((app) => (
                <TableRow key={app.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/applications/${app.id}`}
                        className="hover:underline"
                      >
                        {app.company_name || app.company_name_raw}
                      </Link>
                      {isCompanyBanned(app.company_name || app.company_name_raw) && (
                        <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                          <ShieldAlert className="h-3 w-3" />
                          Banned
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{app.position}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(app.applied_at)}
                  </TableCell>
                  <TableCell>
                    {app.current_status && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-white",
                          statusColors[app.current_status as ApplicationStatus]
                        )}
                      >
                        {statusLabels[app.current_status as ApplicationStatus]}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

