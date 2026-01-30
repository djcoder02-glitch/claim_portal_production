import { useState } from "react";
import { 
  useAllPolicyTypes, 
  useCreatePolicyType, 
  useUpdatePolicyType, 
  useDeletePolicyType,
  PolicyType 
} from "@/hooks/usePolicyTypes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, FileText, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";

interface PolicyTypeFormData {
  name: string;
  code: string;
  description: string;
  parent_id: string;
}

const PolicyTypesManagement = () => {
  const { data: policyTypes = [], isLoading } = useAllPolicyTypes();
  const createMutation = useCreatePolicyType();
  const updateMutation = useUpdatePolicyType();
  const deleteMutation = useDeletePolicyType();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<PolicyType | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [policyToDelete, setPolicyToDelete] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<PolicyTypeFormData>();

  const handleCreate = () => {
    setEditingPolicy(null);
    reset({
      name: "",
      code: "",
      description: "",
      parent_id: "",
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (policy: PolicyType) => {
    setEditingPolicy(policy);
    reset({
      name: policy.name,
      code: policy.code || "",
      description: policy.description || "",
      parent_id: policy.parent_id || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setPolicyToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (policyToDelete) {
      await deleteMutation.mutateAsync(policyToDelete);
      setDeleteDialogOpen(false);
      setPolicyToDelete(null);
    }
  };

  const onSubmit = async (data: PolicyTypeFormData) => {
    if (editingPolicy) {
      await updateMutation.mutateAsync({
        id: editingPolicy.id,
        updates: {
          name: data.name,
          code: data.code || null,
          description: data.description || null,
          parent_id: data.parent_id || null,
        },
      });
    } else {
      await createMutation.mutateAsync({
        name: data.name,
        code: data.code || undefined,
        description: data.description || undefined,
        parent_id: data.parent_id || undefined,
      });
    }
    setIsDialogOpen(false);
    reset();
  };

  // Get only parent policies (no parent_id) for the parent selector
  const parentPolicies = policyTypes.filter(p => !p.parent_id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Policy Types</h1>
          <p className="text-gray-600 mt-1">Manage insurance policy types and categories</p>
        </div>
        <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Policy Type
        </Button>
      </div>

      {/* Policy Types Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Policy Types</CardTitle>
        </CardHeader>
        <CardContent>
          {policyTypes.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No policy types found</p>
              <Button onClick={handleCreate} variant="outline" className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Create First Policy Type
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policyTypes.map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell className="font-medium">{policy.name}</TableCell>
                    <TableCell>
                      {policy.code ? (
                        <Badge variant="outline">{policy.code}</Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {policy.description || <span className="text-gray-400">No description</span>}
                    </TableCell>
                    <TableCell>
                      {policy.parent_id ? (
                        <span className="text-sm text-gray-600">
                          {policyTypes.find(p => p.id === policy.parent_id)?.name || 'Unknown'}
                        </span>
                      ) : (
                        <Badge variant="secondary">Parent</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={policy.is_active ? "default" : "secondary"}
                        className={policy.is_active ? "bg-green-600" : ""}
                      >
                        {policy.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(policy)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(policy.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingPolicy ? "Edit Policy Type" : "Create Policy Type"}
            </DialogTitle>
            <DialogDescription>
              {editingPolicy 
                ? "Update the policy type information" 
                : "Add a new insurance policy type"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Policy Name *</Label>
                <Input
                  id="name"
                  placeholder="Marine Cargo Insurance"
                  {...register("name", { required: "Name is required" })}
                />
                {errors.name && (
                  <p className="text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">Policy Code</Label>
                <Input
                  id="code"
                  placeholder="MARINE"
                  {...register("code")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="parent_id">Parent Policy (Optional)</Label>
              <Select
                onValueChange={(value) => setValue("parent_id", value)}
                defaultValue={editingPolicy?.parent_id || ""}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select parent policy (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None (Top Level)</SelectItem>
                  {parentPolicies
                    .filter(p => p.id !== editingPolicy?.id) // Don't allow self as parent
                    .map((policy) => (
                      <SelectItem key={policy.id} value={policy.id}>
                        {policy.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of this policy type"
                rows={3}
                {...register("description")}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : editingPolicy ? (
                  "Update Policy Type"
                ) : (
                  "Create Policy Type"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the policy type. It won't be available for new claims.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PolicyTypesManagement;