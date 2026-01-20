"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, Plus, Trash2, AlertTriangle, Building2, Globe } from "lucide-react";
import { toast } from "sonner";

import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Autocomplete } from "@/components/ui/combobox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { bannedCompaniesApi, bannedSourcesApi, companiesApi } from "@/lib/api";
import type { BannedCompany, BannedSource } from "@/lib/types";

export default function BannedEntitiesPage() {
  const queryClient = useQueryClient();
  const [companySearchQuery, setCompanySearchQuery] = useState("");
  const [sourceSearchQuery, setSourceSearchQuery] = useState("");
  const [isAddCompanyOpen, setIsAddCompanyOpen] = useState(false);
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyReason, setNewCompanyReason] = useState("");
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceReason, setNewSourceReason] = useState("");
  const [deleteCompanyTarget, setDeleteCompanyTarget] = useState<BannedCompany | null>(null);
  const [deleteSourceTarget, setDeleteSourceTarget] = useState<BannedSource | null>(null);

  // Fetch banned companies
  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ["banned-companies"],
    queryFn: () => bannedCompaniesApi.list(),
  });

  // Fetch banned sources
  const { data: sourcesData, isLoading: sourcesLoading } = useQuery({
    queryKey: ["banned-sources"],
    queryFn: () => bannedSourcesApi.list(),
  });

  // Fetch companies for autocomplete
  const { data: allCompaniesData } = useQuery({
    queryKey: ["companies"],
    queryFn: () => companiesApi.list(),
  });

  const companyNames = allCompaniesData?.companies.map((c) => c.name) || [];

  // Company mutations
  const createCompanyMutation = useMutation({
    mutationFn: (data: { name: string; reason?: string }) =>
      bannedCompaniesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banned-companies"] });
      toast.success("Company added to ban list");
      setIsAddCompanyOpen(false);
      setNewCompanyName("");
      setNewCompanyReason("");
    },
    onError: (error) => {
      toast.error(`Failed to ban company: ${error.message}`);
    },
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: (id: number) => bannedCompaniesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banned-companies"] });
      toast.success("Company removed from ban list");
      setDeleteCompanyTarget(null);
    },
    onError: (error) => {
      toast.error(`Failed to remove: ${error.message}`);
      setDeleteCompanyTarget(null);
    },
  });

  // Source mutations
  const createSourceMutation = useMutation({
    mutationFn: (data: { name: string; reason?: string }) =>
      bannedSourcesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banned-sources"] });
      toast.success("Source added to ban list");
      setIsAddSourceOpen(false);
      setNewSourceName("");
      setNewSourceReason("");
    },
    onError: (error) => {
      toast.error(`Failed to ban source: ${error.message}`);
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: (id: number) => bannedSourcesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banned-sources"] });
      toast.success("Source removed from ban list");
      setDeleteSourceTarget(null);
    },
    onError: (error) => {
      toast.error(`Failed to remove: ${error.message}`);
      setDeleteSourceTarget(null);
    },
  });

  const handleCompanySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    createCompanyMutation.mutate({
      name: newCompanyName.trim(),
      reason: newCompanyReason.trim() || undefined,
    });
  };

  const handleSourceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim()) {
      toast.error("Source name is required");
      return;
    }
    createSourceMutation.mutate({
      name: newSourceName.trim(),
      reason: newSourceReason.trim() || undefined,
    });
  };

  const filteredCompanies = companiesData?.banned_companies.filter((b: BannedCompany) =>
    b.name.toLowerCase().includes(companySearchQuery.toLowerCase()) ||
    b.reason?.toLowerCase().includes(companySearchQuery.toLowerCase())
  );

  const filteredSources = sourcesData?.banned_sources.filter((b: BannedSource) =>
    b.name.toLowerCase().includes(sourceSearchQuery.toLowerCase()) ||
    b.reason?.toLowerCase().includes(sourceSearchQuery.toLowerCase())
  );

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Banned Entities"
        description="Quick reference for companies and platforms to avoid"
      />
      <div className="flex-1 overflow-auto space-y-6 p-8">
        {/* Warning Banner */}
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/50">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-sm text-red-800 dark:text-red-200">
            Entities on these lists will be flagged with warnings when you view
            applications or try to apply to them.
          </p>
        </div>

        <Tabs defaultValue="companies" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="companies" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Companies ({companiesData?.total || 0})
            </TabsTrigger>
            <TabsTrigger value="sources" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Platforms ({sourcesData?.total || 0})
            </TabsTrigger>
          </TabsList>

          {/* Companies Tab */}
          <TabsContent value="companies" className="space-y-4 mt-6">
        <div className="flex items-center justify-between">
          <Input
            placeholder="Search banned companies..."
                value={companySearchQuery}
                onChange={(e) => setCompanySearchQuery(e.target.value)}
            className="max-w-sm"
          />
              <Dialog open={isAddCompanyOpen} onOpenChange={setIsAddCompanyOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <Plus className="mr-2 h-4 w-4" />
                Ban Company
              </Button>
            </DialogTrigger>
            <DialogContent>
                  <form onSubmit={handleCompanySubmit}>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-red-500" />
                        Add Company to Ban List
                  </DialogTitle>
                  <DialogDescription>
                    Add a company to your banned list. You&apos;ll see warnings
                    when interacting with this company.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                        <Label htmlFor="company-name">Company Name</Label>
                    <Autocomplete
                      options={companyNames}
                          value={newCompanyName}
                          onChange={setNewCompanyName}
                      placeholder="Type to search or enter new company..."
                    />
                  </div>
                  <div className="grid gap-2">
                        <Label htmlFor="company-reason">Reason (optional)</Label>
                    <Textarea
                          id="company-reason"
                      placeholder="Why is this company being banned? (e.g., scam, fake job posting, etc.)"
                          value={newCompanyReason}
                          onChange={(e) => setNewCompanyReason(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                        onClick={() => setIsAddCompanyOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="destructive"
                        disabled={createCompanyMutation.isPending}
                  >
                        {createCompanyMutation.isPending ? "Adding..." : "Add to Ban List"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <Building2 className="h-5 w-5" />
                  Banned Companies (Scam/Bad Actors)
            </CardTitle>
            <CardDescription>
                  Companies flagged as scams or to avoid
            </CardDescription>
          </CardHeader>
          <CardContent>
                {companiesLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
                ) : !filteredCompanies?.length ? (
              <div className="py-12 text-center">
                    <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">
                      {companySearchQuery
                    ? "No banned companies match your search"
                    : "No banned companies yet"}
                </p>
                    {!companySearchQuery && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Add companies to this list to get warnings when applying
                  </p>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Date Added</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                      {filteredCompanies.map((banned: BannedCompany) => (
                        <TableRow key={banned.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <ShieldAlert className="h-4 w-4 text-red-500" />
                              {banned.name}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-md truncate text-muted-foreground">
                            {banned.reason || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(banned.created_at)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950"
                              onClick={() => setDeleteCompanyTarget(banned)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sources Tab */}
          <TabsContent value="sources" className="space-y-4 mt-6">
            <div className="flex items-center justify-between">
              <Input
                placeholder="Search banned platforms..."
                value={sourceSearchQuery}
                onChange={(e) => setSourceSearchQuery(e.target.value)}
                className="max-w-sm"
              />
              <Dialog open={isAddSourceOpen} onOpenChange={setIsAddSourceOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive">
                    <Plus className="mr-2 h-4 w-4" />
                    Ban Platform
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleSourceSubmit}>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-red-500" />
                        Add Platform to Ban List
                      </DialogTitle>
                      <DialogDescription>
                        Add a job platform or source to your banned list (e.g., LENSA, Indeed).
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="source-name">Platform Name</Label>
                        <Input
                          id="source-name"
                          placeholder="e.g., LENSA, Indeed, etc."
                          value={newSourceName}
                          onChange={(e) => setNewSourceName(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="source-reason">Reason (optional)</Label>
                        <Textarea
                          id="source-reason"
                          placeholder="Why are you avoiding this platform? (e.g., spam, low quality jobs, etc.)"
                          value={newSourceReason}
                          onChange={(e) => setNewSourceReason(e.target.value)}
                          rows={3}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddSourceOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="destructive"
                        disabled={createSourceMutation.isPending}
                      >
                        {createSourceMutation.isPending ? "Adding..." : "Add to Ban List"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="border-red-200 dark:border-red-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <Globe className="h-5 w-5" />
                  Banned Platforms/Sources (Avoid Applying On)
                </CardTitle>
                <CardDescription>
                  Job platforms and sources to avoid using
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sourcesLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : !filteredSources?.length ? (
                  <div className="py-12 text-center">
                    <Globe className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-4 text-muted-foreground">
                      {sourceSearchQuery
                        ? "No banned platforms match your search"
                        : "No banned platforms yet"}
                    </p>
                    {!sourceSearchQuery && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Add platforms to this list to get warnings when applying
                      </p>
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Platform</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Date Added</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSources.map((banned: BannedSource) => (
                    <TableRow key={banned.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="h-4 w-4 text-red-500" />
                          {banned.name}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-md truncate text-muted-foreground">
                        {banned.reason || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(banned.created_at)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950"
                              onClick={() => setDeleteSourceTarget(banned)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>

        {/* Delete Company Confirmation Dialog */}
        <AlertDialog
          open={deleteCompanyTarget !== null}
          onOpenChange={(open) => !open && setDeleteCompanyTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Company from Ban List</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove &quot;{deleteCompanyTarget?.name}&quot;
                from the ban list? You will no longer see warnings for this
                company.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  deleteCompanyTarget && deleteCompanyMutation.mutate(deleteCompanyTarget.id)
                }
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Source Confirmation Dialog */}
        <AlertDialog
          open={deleteSourceTarget !== null}
          onOpenChange={(open) => !open && setDeleteSourceTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Platform from Ban List</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove &quot;{deleteSourceTarget?.name}&quot;
                from the ban list? You will no longer see warnings for this
                platform.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  deleteSourceTarget && deleteSourceMutation.mutate(deleteSourceTarget.id)
                }
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

