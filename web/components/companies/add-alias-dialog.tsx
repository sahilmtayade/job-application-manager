"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { companiesApi } from "@/lib/api";

interface AddAliasDialogProps {
  companyId: number;
  companyName: string;
  trigger?: React.ReactNode;
}

export function AddAliasDialog({ companyId, companyName, trigger }: AddAliasDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [alias, setAlias] = useState("");

  const addMutation = useMutation({
    mutationFn: (aliasName: string) => companiesApi.addAlias(companyId, aliasName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["company", companyId, "aliases"] });
      toast.success("Alias added");
      setOpen(false);
      setAlias("");
    },
    onError: (error) => {
      toast.error(`Failed to add alias: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!alias.trim()) {
      toast.error("Please enter an alias");
      return;
    }
    addMutation.mutate(alias.trim());
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="ghost">
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Alias</DialogTitle>
            <DialogDescription>
              Add an alternative name for {companyName}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="Alternative company name"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Aliases help recognize the same company with different spellings
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addMutation.isPending}>
              {addMutation.isPending ? "Adding..." : "Add Alias"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

