import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { Plus, MoreHorizontal, Search, Users, Phone, Mail, MapPin, Pencil, Trash2 } from "lucide-react";

type Surveyor = Tables<"surveyors">;

interface SurveyorFormData {
  name: string;
  email: string;
  phone: string;
  address: string;
}

const defaultForm: SurveyorFormData = {
  name: "",
  email: "",
  phone: "",
  address: "",
};

// ── Hooks ────────────────────────────────────────────────────

const useSurveyorsAdmin = (isSuperAdmin: boolean, companyId?: string) => {
  return useQuery({
    queryKey: ["surveyors-admin", isSuperAdmin, companyId],
    queryFn: async () => {
      let query = supabase
        .from("surveyors")
        .select("id, company_id, name, email, phone, address, is_active, created_at, updated_at")
        .order("name");

      if (!isSuperAdmin && companyId) {
        query = query.eq("company_id", companyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
};

const useCreateSurveyor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SurveyorFormData & { company_id: string }) => {
      const { data, error } = await supabase
        .from("surveyors")
        .insert({ ...payload, is_active: true })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["surveyors-admin"] });
      queryClient.invalidateQueries({ queryKey: ["surveyors"] });
      toast.success("Surveyor created successfully");
    },
    onError: (e: any) => toast.error("Failed to create surveyor: " + e.message),
  });
};

const useUpdateSurveyor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: SurveyorFormData & { id: string }) => {
      const { data, error } = await supabase
        .from("surveyors")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["surveyors-admin"] });
      queryClient.invalidateQueries({ queryKey: ["surveyors"] });
      toast.success("Surveyor updated successfully");
    },
    onError: (e: any) => toast.error("Failed to update surveyor: " + e.message),
  });
};

const useDeleteSurveyor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("surveyors")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["surveyors-admin"] });
      queryClient.invalidateQueries({ queryKey: ["surveyors"] });
      toast.success("Surveyor removed successfully");
    },
    onError: (e: any) => toast.error("Failed to remove surveyor: " + e.message),
  });
};

// ── Form Dialog ───────────────────────────────────────────────

interface SurveyorDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  surveyor?: Surveyor | null;
  companyId: string | null | undefined;
}

const SurveyorDialog = ({ open, onOpenChange, surveyor, companyId }: SurveyorDialogProps) => {
  const isEdit = !!surveyor;
  const createMutation = useCreateSurveyor();
  const updateMutation = useUpdateSurveyor();

  const [form, setForm] = useState<SurveyorFormData>(
    surveyor
      ? { name: surveyor.name, email: surveyor.email || "", phone: surveyor.phone || "", address: surveyor.address || "" }
      : defaultForm
  );

  // Reset form when surveyor changes
  useState(() => {
    setForm(
      surveyor
        ? { name: surveyor.name, email: surveyor.email || "", phone: surveyor.phone || "", address: surveyor.address || "" }
        : defaultForm
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Name is required");

    if (isEdit && surveyor) {
      await updateMutation.mutateAsync({ id: surveyor.id, ...form });
    } else {
      if (!companyId) return toast.error("Company ID is required");
      await createMutation.mutateAsync({ ...form, company_id: companyId });
    }
    onOpenChange(false);
    setForm(defaultForm);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Surveyor" : "Add New Surveyor"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update surveyor details below." : "Fill in the details to add a new surveyor."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Full name"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="email@example.com"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+91 XXXXX XXXXX"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Office address"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="bg-slate-700 hover:bg-slate-800 text-white">
              {isPending ? (isEdit ? "Saving..." : "Adding...") : isEdit ? "Save Changes" : "Add Surveyor"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ── Main Page ─────────────────────────────────────────────────

export const SurveyorsPage = () => {
  const { isAdmin, isSuperAdmin, companyId} = useAuth();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSurveyor, setEditingSurveyor] = useState<Surveyor | null>(null);

//   // Get company_id from user metadata
//   const companyId = user?.user_metadata?.company_id || "";

  const { data: surveyors = [], isLoading } = useSurveyorsAdmin(isSuperAdmin, companyId || undefined);
  const deleteMutation = useDeleteSurveyor();

  const filtered = surveyors.filter((s) =>
    [s.name, s.email, s.phone, s.address].some((v) =>
      (v || "").toLowerCase().includes(search.toLowerCase())
    )
  );

  const handleEdit = (surveyor: Surveyor) => {
    setEditingSurveyor(surveyor);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingSurveyor(null);
    setDialogOpen(true);
  };

  const handleDelete = (surveyor: Surveyor) => {
    if (confirm(`Remove "${surveyor.name}"? This action will deactivate the surveyor.`)) {
      deleteMutation.mutate(surveyor.id);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingSurveyor(null);
  };

  if (!isAdmin && !isSuperAdmin) {
    return (
      <div className="min-h-screen p-6 bg-gradient-background flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-destructive">Access Denied</h2>
            <p className="text-muted-foreground mt-2">You don't have permission to manage surveyors.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-gradient-background">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <Card className="bg-white/95 border border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-700 rounded-lg">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl text-slate-800">Surveyors</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {isSuperAdmin ? "All surveyors across companies" : "Surveyors in your company"}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleAdd}
                className="bg-slate-700 hover:bg-slate-800 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Surveyor
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-white/95 border border-slate-200 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Surveyors</p>
                <p className="text-2xl font-bold text-slate-800">{surveyors.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/95 border border-slate-200 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-slate-800">
                  {surveyors.filter((s) => s.is_active).length}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/95 border border-slate-200 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg">
                <Search className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Showing</p>
                <p className="text-2xl font-bold text-slate-800">{filtered.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search + Table */}
        <Card className="bg-white/95 border border-slate-200 shadow-sm">
          <CardContent className="p-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-full md:w-80"
              />
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No surveyors found</p>
                <p className="text-sm mt-1">
                  {search ? "Try a different search term" : "Add your first surveyor to get started"}
                </p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="font-semibold text-slate-700">Name</TableHead>
                      <TableHead className="font-semibold text-slate-700">Contact</TableHead>
                      <TableHead className="font-semibold text-slate-700">Address</TableHead>
                      {isSuperAdmin && (
                        <TableHead className="font-semibold text-slate-700">Company</TableHead>
                      )}
                      <TableHead className="font-semibold text-slate-700">Status</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((surveyor) => (
                      <TableRow key={surveyor.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-medium text-slate-800">
                          {surveyor.name}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            {surveyor.email && (
                              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Mail className="w-3.5 h-3.5" />
                                {surveyor.email}
                              </div>
                            )}
                            {surveyor.phone && (
                              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Phone className="w-3.5 h-3.5" />
                                {surveyor.phone}
                              </div>
                            )}
                            {!surveyor.email && !surveyor.phone && (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {surveyor.address ? (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground max-w-48 truncate">
                              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">{surveyor.address}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        {isSuperAdmin && (
                          <TableCell>
                            <span className="text-xs text-muted-foreground font-mono">
                              {surveyor.company_id?.slice(0, 8) || "—"}
                            </span>
                          </TableCell>
                        )}
                        <TableCell>
                          <Badge
                            className={surveyor.is_active
                              ? "bg-green-100 text-green-700 border-green-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                            }
                            variant="outline"
                          >
                            {surveyor.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(surveyor)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDelete(surveyor)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <SurveyorDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        surveyor={editingSurveyor}
        companyId={companyId || ""}
      />
    </div>
  );
};