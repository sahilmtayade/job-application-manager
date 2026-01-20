"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Merge } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { companiesApi } from "@/lib/api";

interface MergeDialogProps {
  trigger?: React.ReactNode;
}

export function MergeDialog({ trigger }: MergeDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fromId, setFromId] = useState<string>("");
  const [toId, setToId] = useState<string>("");

  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: () => companiesApi.list(),
    enabled: open,
  });

  const mergeMutation = useMutation({
    mutationFn: () => companiesApi.merge(parseInt(fromId), parseInt(toId)),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast.success(`Companies merged into "${result.name}"`);
      setOpen(false);
      setFromId("");
      setToId("");
    },
    onError: (error) => {
      toast.error(`Failed to merge: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromId || !toId) {
      toast.error("Please select both companies");
      return;
    }
    if (fromId === toId) {
      toast.error("Cannot merge a company with itself");
      return;
    }
    mergeMutation.mutate();
  };

  const fromCompany = companies?.companies.find((c) => c.id === parseInt(fromId));
  const toCompany = companies?.companies.find((c) => c.id === parseInt(toId));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Merge className="mr-2 h-4 w-4" />
            Merge Companies
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Merge Companies</DialogTitle>
            <DialogDescription>
              Move all applications from one company to another
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Merge From (will be deleted)</label>
              <Select value={fromId} onValueChange={setFromId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source company" />
                </SelectTrigger>
                <SelectContent>
                  {companies?.companies
                    .filter((c) => c.id !== parseInt(toId))
                    .map((company) => (
                      <SelectItem key={company.id} value={company.id.toString()}>
                        {company.name} ({company.application_count} apps)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Merge Into (will keep)</label>
              <Select value={toId} onValueChange={setToId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target company" />
                </SelectTrigger>
                <SelectContent>
                  {companies?.companies
                    .filter((c) => c.id !== parseInt(fromId))
                    .map((company) => (
                      <SelectItem key={company.id} value={company.id.toString()}>
                        {company.name} ({company.application_count} apps)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {fromCompany && toCompany && (
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p>
                  All {fromCompany.application_count} applications from{" "}
                  <strong>{fromCompany.name}</strong> will be moved to{" "}
                  <strong>{toCompany.name}</strong>.
                </p>
                <p className="mt-1 text-muted-foreground">
                  &quot;{fromCompany.name}&quot; will be deleted after merging.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mergeMutation.isPending || !fromId || !toId}
            >
              {mergeMutation.isPending ? "Merging..." : "Merge Companies"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

