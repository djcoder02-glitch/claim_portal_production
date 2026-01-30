import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit, Plus, Settings, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface PolicyType {
  id: string;
  company_id: string;
  name: string;
  code: string | null;
  description: string | null;
  parent_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  companies?: {
    name: string;
  };
}

export const PolicyTypesManager = () => {
  const { user, isSuperadmin, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<PolicyType | null>(null);
  const [newType, setNewType] = useState({ name: "", code: "", description: "", parent_id: "", company_id: "" });
  const [loading, setLoading] = useState(false);

  // Fetch companies (for superadmin)
  const { data: companies } = useQuery({
    queryKey: ["all-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .order("name");
      
      if (error) throw error;
      return data;
    },
    enabled: isSuperadmin,
  });

  // Fetch policy types based on role
  const { data: policyTypes, isLoading } = useQuery({
    queryKey: ["policy-types", isSuperadmin ? "all" : "company"],
    queryFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");

      if (isSuperadmin) {
        // Superadmin: Fetch ALL policy types from ALL companies
        const { data, error } = await supabase
          .from("policy_types")
          .select(`
            *,
            companies (
              name
            )
          `)
          .order("name");

        if (error) throw error;
        return data as PolicyType[];
      } else {
        // Admin: Fetch only their company's policy types
        const { data: userData } = await supabase
          .from('users')
          .select('company_id')
          .eq('id', user.id)
          .single();

        if (!userData?.company_id) throw new Error('No company found');

        const { data, error } = await supabase
          .from("policy_types")
          .select("*")
          .eq('company_id', userData.company_id)
          .order("name");

        if (error) throw error;
        return data as PolicyType[];
      }
    },
    enabled: !!user?.id && (isSuperadmin || isAdmin),
  });

  // Group policy types by parent
  const mainPolicyTypes = policyTypes?.filter(pt => !pt.parent_id) || [];
  const getSubtypes = (parentId: string) => 
    policyTypes?.filter(pt => pt.parent_id === parentId) || [];

  const handleAddPolicyType = async () => {
    if (!newType.name.trim()) {
      toast.error("Policy type name is required");
      return;
    }

    setLoading(true);
    try {
      let targetCompanyId = newType.company_id;

      // If admin, use their company_id (ignore selection)
      if (!isSuperadmin) {
        const { data: userData } = await supabase
          .from('users')
          .select('company_id')
          .eq('id', user?.id)
          .single();

        if (!userData?.company_id) {
          throw new Error("No company associated with your account");
        }
        targetCompanyId = userData.company_id;
      } else if (!targetCompanyId) {
        toast.error("Please select a company");
        return;
      }

      const { error } = await supabase
        .from("policy_types")
        .insert({
          company_id: targetCompanyId,
          name: newType.name,
          code: newType.code || null,
          description: newType.description || null,
          parent_id: newType.parent_id || null,
          is_active: true
        });

      if (error) throw error;

      toast.success("Policy type added successfully");
      setNewType({ name: "", code: "", description: "", parent_id: "", company_id: "" });
      setIsAddDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["policy-types"] });
    } catch (error) {
      toast.error("Failed to add policy type");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePolicyType = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    setLoading(true);
    try {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from("policy_types")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;

      toast.success("Policy type deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["policy-types"] });
    } catch (error) {
      toast.error("Failed to delete policy type");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePolicyType = async () => {
    if (!editingType || !editingType.name.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("policy_types")
        .update({
          name: editingType.name,
          code: editingType.code || null,
          description: editingType.description || null,
          parent_id: editingType.parent_id || null
        })
        .eq("id", editingType.id);

      if (error) throw error;

      toast.success("Policy type updated successfully");
      setEditingType(null);
      queryClient.invalidateQueries({ queryKey: ["policy-types"] });
    } catch (error) {
      toast.error("Failed to update policy type");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Check if user has access
  if (!isSuperadmin && !isAdmin) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">You don't have permission to manage policy types.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Policy Types Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Policy Types Management
              {isSuperadmin && <Badge variant="secondary">Superadmin</Badge>}
            </CardTitle>
            <CardDescription>
              {isSuperadmin 
                ? "Manage policy types across all companies" 
                : "Manage your company's policy types"}
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Policy Type
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Policy Type</DialogTitle>
                <DialogDescription>
                  Create a new insurance policy type or subtype
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Company selector - only for superadmin */}
                {isSuperadmin && (
                  <div className="space-y-2">
                    <Label htmlFor="company">Company *</Label>
                    <select
                      id="company"
                      value={newType.company_id}
                      onChange={(e) => setNewType(prev => ({ ...prev, company_id: e.target.value }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select a company...</option>
                      {companies?.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={newType.name}
                    onChange={(e) => setNewType(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Marine Cargo, Fire"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    value={newType.code}
                    onChange={(e) => setNewType(prev => ({ ...prev, code: e.target.value }))}
                    placeholder="e.g., MARINE, FIRE"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newType.description}
                    onChange={(e) => setNewType(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of this policy type"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parent">Parent Category (Optional)</Label>
                  <select
                    id="parent"
                    value={newType.parent_id}
                    onChange={(e) => setNewType(prev => ({ ...prev, parent_id: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">None (Main Category)</option>
                    {mainPolicyTypes
                      .filter(pt => isSuperadmin ? pt.company_id === newType.company_id : true)
                      .map((pt) => (
                        <option key={pt.id} value={pt.id}>
                          {pt.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddPolicyType} disabled={loading}>
                    {loading ? "Adding..." : "Add Policy Type"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {policyTypes && policyTypes.length > 0 ? (
          <div className="space-y-6">
            {mainPolicyTypes.map((mainType) => (
              <Card key={mainType.id} className="border-2">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg">{mainType.name}</h3>
                        {mainType.code && (
                          <Badge variant="outline">{mainType.code}</Badge>
                        )}
                        {isSuperadmin && mainType.companies && (
                          <Badge variant="secondary" className="ml-2">
                            <Building2 className="w-3 h-3 mr-1" />
                            {mainType.companies.name}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {mainType.description}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingType(mainType)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeletePolicyType(mainType.id, mainType.name)}
                        disabled={loading}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Subtypes */}
                  <div className="ml-4 space-y-2">
                    {getSubtypes(mainType.id).map((subtype) => (
                      <Card key={subtype.id} className="border border-muted">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-sm">{subtype.name}</h4>
                                {subtype.code && (
                                  <Badge variant="secondary" className="text-xs">{subtype.code}</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {subtype.description}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingType(subtype)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeletePolicyType(subtype.id, subtype.name)}
                                disabled={loading}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Alert>
            <AlertDescription>
              No policy types found. Add your first policy type to get started.
            </AlertDescription>
          </Alert>
        )}

        {/* Edit Dialog - same as before, no changes needed */}
        <Dialog open={!!editingType} onOpenChange={() => setEditingType(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Policy Type</DialogTitle>
              <DialogDescription>
                Update the policy type details
              </DialogDescription>
            </DialogHeader>
            {editingType && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input
                    id="edit-name"
                    value={editingType.name}
                    onChange={(e) => setEditingType(prev => prev ? { ...prev, name: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-code">Code</Label>
                  <Input
                    id="edit-code"
                    value={editingType.code || ""}
                    onChange={(e) => setEditingType(prev => prev ? { ...prev, code: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={editingType.description || ""}
                    onChange={(e) => setEditingType(prev => prev ? { ...prev, description: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-parent">Parent Category</Label>
                  <select
                    id="edit-parent"
                    value={editingType.parent_id || ""}
                    onChange={(e) => setEditingType(prev => prev ? { ...prev, parent_id: e.target.value || null } : null)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">None (Main Category)</option>
                    {mainPolicyTypes
                      .filter(pt => pt.id !== editingType?.id && pt.company_id === editingType?.company_id)
                      .map((pt) => (
                        <option key={pt.id} value={pt.id}>
                          {pt.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setEditingType(null)}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleUpdatePolicyType} disabled={loading}>
                    {loading ? "Updating..." : "Update Policy Type"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
