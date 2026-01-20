"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Building2, MoreHorizontal, Trash2, X, Plus, ShieldAlert, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { AddAliasDialog } from "@/components/companies/add-alias-dialog";
import { MergeDialog } from "@/components/companies/merge-dialog";
import { companiesApi, bannedCompaniesApi } from "@/lib/api";
import type { Alias, Company } from "@/lib/types";

export default function CompaniesPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCompany, setExpandedCompany] = useState<number | null>(null);
  const [deleteCompanyId, setDeleteCompanyId] = useState<number | null>(null);
  const [deleteAlias, setDeleteAlias] = useState<{ companyId: number; aliasId: number; alias: string } | null>(null);
  const [banCompany, setBanCompany] = useState<Company | null>(null);
  const [banReason, setBanReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: () => companiesApi.list(),
  });

  const { data: aliases } = useQuery({
    queryKey: ["company", expandedCompany, "aliases"],
    queryFn: () => companiesApi.getAliases(expandedCompany!),
    enabled: expandedCompany !== null,
  });

  const { data: bannedData } = useQuery({
    queryKey: ["banned-companies"],
    queryFn: () => bannedCompaniesApi.list(),
  });

  // Create a Map of banned company names to their IDs for quick lookup (case-insensitive)
  const bannedCompaniesMap = new Map(
    bannedData?.banned_companies.map((b) => [b.name.trim().toLowerCase(), b]) || []
  );

  const isCompanyBanned = (name: string) => bannedCompaniesMap.has(name.trim().toLowerCase());
  const getBannedCompany = (name: string) => bannedCompaniesMap.get(name.trim().toLowerCase());

  const deleteMutation = useMutation({
    mutationFn: (id: number) => companiesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Company deleted");
      setDeleteCompanyId(null);
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
      setDeleteCompanyId(null);
    },
  });

  const deleteAliasMutation = useMutation({
    mutationFn: ({ companyId, aliasId }: { companyId: number; aliasId: number }) =>
      companiesApi.deleteAlias(companyId, aliasId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", expandedCompany, "aliases"] });
      toast.success("Alias removed");
      setDeleteAlias(null);
    },
    onError: (error) => {
      toast.error(`Failed to remove alias: ${error.message}`);
      setDeleteAlias(null);
    },
  });

  const banMutation = useMutation({
    mutationFn: (data: { name: string; reason?: string }) =>
      bannedCompaniesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banned-companies"] });
      toast.success("Company added to ban list");
      setBanCompany(null);
      setBanReason("");
    },
    onError: (error) => {
      toast.error(`Failed to ban company: ${error.message}`);
    },
  });

  const unbanMutation = useMutation({
    mutationFn: (id: number) => bannedCompaniesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banned-companies"] });
      toast.success("Company removed from ban list");
    },
    onError: (error) => {
      toast.error(`Failed to unban company: ${error.message}`);
    },
  });

  const handleBanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!banCompany) return;
    banMutation.mutate({
      name: banCompany.name,
      reason: banReason.trim() || undefined,
    });
  };

  const filteredCompanies = data?.companies.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Companies" description="Manage companies you've applied to" />
      <div className="flex-1 overflow-auto space-y-6 p-8">
        <div className="flex items-center justify-between">
          <Input
            placeholder="Search companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
          <MergeDialog />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Companies
            </CardTitle>
            <CardDescription>
              {data?.total || 0} companies total
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !filteredCompanies?.length ? (
              <p className="py-8 text-center text-muted-foreground">
                {searchQuery ? "No companies match your search" : "No companies yet"}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Aliases</TableHead>
                    <TableHead className="text-right">Applications</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies.map((company) => (
                    <React.Fragment key={company.id}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() =>
                          setExpandedCompany(
                            expandedCompany === company.id ? null : company.id
                          )
                        }
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/applications?company=${company.id}`}
                              className="hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {company.name}
                            </Link>
                            {isCompanyBanned(company.name) && (
                              <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                                <ShieldAlert className="h-3 w-3" />
                                Banned
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedCompany(
                                expandedCompany === company.id ? null : company.id
                              );
                            }}
                          >
                            {expandedCompany === company.id ? "Hide" : "Show"} aliases
                          </Button>
                        </TableCell>
                        <TableCell className="text-right">
                          {company.application_count}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {isCompanyBanned(company.name) ? (
                                <DropdownMenuItem
                                  className="text-green-600"
                                  onClick={() => {
                                    const banned = getBannedCompany(company.name);
                                    if (banned) {
                                      unbanMutation.mutate(banned.id);
                                    }
                                  }}
                                  disabled={unbanMutation.isPending}
                                >
                                  <ShieldOff className="mr-2 h-4 w-4" />
                                  Unban Company
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className="text-orange-600"
                                  onClick={() => setBanCompany(company)}
                                >
                                  <ShieldAlert className="mr-2 h-4 w-4" />
                                  Ban Company
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  if (company.application_count > 0) {
                                    toast.error(
                                      "Cannot delete company with applications"
                                    );
                                    return;
                                  }
                                  setDeleteCompanyId(company.id);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      {expandedCompany === company.id && (
                        <TableRow>
                          <TableCell colSpan={4} className="bg-muted/50">
                            <div className="flex flex-wrap items-center gap-2 py-2">
                              <span className="text-sm text-muted-foreground">
                                Aliases:
                              </span>
                              {aliases?.aliases.length === 0 ? (
                                <span className="text-sm text-muted-foreground">
                                  None
                                </span>
                              ) : (
                                aliases?.aliases.map((alias: Alias) => (
                                  <Badge
                                    key={alias.id}
                                    variant="secondary"
                                    className="flex items-center gap-1"
                                  >
                                    {alias.alias}
                                    <button
                                      onClick={() =>
                                        setDeleteAlias({
                                          companyId: company.id,
                                          aliasId: alias.id,
                                          alias: alias.alias,
                                        })
                                      }
                                      className="ml-1 rounded-full hover:bg-muted-foreground/20"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ))
                              )}
                              <AddAliasDialog
                                companyId={company.id}
                                companyName={company.name}
                                trigger={
                                  <Button size="sm" variant="outline">
                                    <Plus className="mr-1 h-3 w-3" />
                                    Add Alias
                                  </Button>
                                }
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Delete Company Confirmation Dialog */}
        <AlertDialog open={deleteCompanyId !== null} onOpenChange={(open) => !open && setDeleteCompanyId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Company</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;{filteredCompanies?.find(c => c.id === deleteCompanyId)?.name}&quot;?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteCompanyId && deleteMutation.mutate(deleteCompanyId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Alias Confirmation Dialog */}
        <AlertDialog open={deleteAlias !== null} onOpenChange={(open) => !open && setDeleteAlias(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Alias</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove the alias &quot;{deleteAlias?.alias}&quot;?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteAlias) {
                    deleteAliasMutation.mutate({
                      companyId: deleteAlias.companyId,
                      aliasId: deleteAlias.aliasId,
                    });
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Ban Company Dialog */}
        <Dialog open={banCompany !== null} onOpenChange={(open) => !open && setBanCompany(null)}>
          <DialogContent>
            <form onSubmit={handleBanSubmit}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-red-500" />
                  Ban Company
                </DialogTitle>
                <DialogDescription>
                  Add &quot;{banCompany?.name}&quot; to your banned companies list.
                  You&apos;ll see warnings when interacting with this company.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="reason">Reason (optional)</Label>
                  <Textarea
                    id="reason"
                    placeholder="Why is this company being banned? (e.g., scam, fake job posting, etc.)"
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setBanCompany(null);
                    setBanReason("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={banMutation.isPending}
                >
                  {banMutation.isPending ? "Adding..." : "Add to Ban List"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
