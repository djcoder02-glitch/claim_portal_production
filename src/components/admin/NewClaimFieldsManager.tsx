import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Edit2, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

interface ClaimField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  required: boolean;
  options?: string[];
  placeholder?: string;
  order: number;
}

interface PolicyType {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  claim_fields?: ClaimField[];
}

export const NewClaimFieldsManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>("");
  const [fields, setFields] = useState<ClaimField[]>([]);
  const [editingField, setEditingField] = useState<ClaimField | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state for new/edit field
  const [fieldForm, setFieldForm] = useState({
    label: "",
    type: "text" as ClaimField['type'],
    required: false,
    placeholder: "",
    options: "",
  });

  // Fetch policy types for the user's company
  const { data: policyTypes = [], isLoading } = useQuery({
    queryKey: ["company-policy-types"],
    queryFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");

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
        .eq('is_active', true)
        .order("name");

      if (error) throw error;
      return data as PolicyType[];
    },
    enabled: !!user?.id,
  });

  const selectedPolicy = policyTypes.find(pt => pt.id === selectedPolicyId);

  // Load fields when policy selected
  useEffect(() => {
    if (selectedPolicy) {
      setFields(selectedPolicy.claim_fields || []);
    } else {
      setFields([]);
    }
  }, [selectedPolicy]);

  const handlePolicySelect = (policyId: string) => {
    setSelectedPolicyId(policyId);
  };

  const handleAddField = () => {
    setEditingField(null);
    setFieldForm({
      label: "",
      type: "text",
      required: false,
      placeholder: "",
      options: "",
    });
    setIsDialogOpen(true);
  };

  const handleEditField = (field: ClaimField) => {
    setEditingField(field);
    setFieldForm({
      label: field.label,
      type: field.type,
      required: field.required,
      placeholder: field.placeholder || "",
      options: field.options?.join(", ") || "",
    });
    setIsDialogOpen(true);
  };

  const handleSaveField = () => {
    const newField: ClaimField = {
      id: editingField?.id || `field_${Date.now()}`,
      label: fieldForm.label,
      type: fieldForm.type,
      required: fieldForm.required,
      placeholder: fieldForm.placeholder || undefined,
      options: fieldForm.type === 'select' 
        ? fieldForm.options.split(',').map(o => o.trim()).filter(Boolean)
        : undefined,
      order: editingField?.order || fields.length,
    };

    if (editingField) {
      // Update existing field
      setFields(fields.map(f => f.id === editingField.id ? newField : f));
    } else {
      // Add new field
      setFields([...fields, newField]);
    }

    setIsDialogOpen(false);
    toast.success(editingField ? "Field updated" : "Field added");
  };

  const handleRemoveField = (fieldId: string) => {
    setFields(fields.filter(f => f.id !== fieldId));
    toast.success("Field removed");
  };

  const handleSaveToDatabase = async () => {
    if (!selectedPolicyId) {
      toast.error("Please select a policy type");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("policy_types")
        .update({ claim_fields: fields })
        .eq("id", selectedPolicyId);

      if (error) throw error;

      toast.success("Claim fields saved successfully!");
      queryClient.invalidateQueries({ queryKey: ["company-policy-types"] });
    } catch (error) {
      console.error("Error saving fields:", error);
      toast.error("Failed to save claim fields");
    } finally {
      setSaving(false);
    }
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...fields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newFields.length) return;
    
    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
    
    // Update order values
    newFields.forEach((field, idx) => {
      field.order = idx;
    });
    
    setFields(newFields);
  };

  // Group policy types by parent
  const mainPolicyTypes = policyTypes.filter(pt => !pt.parent_id);
  const getSubtypes = (parentId: string) =>
    policyTypes.filter(pt => pt.parent_id === parentId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Claim Fields Manager</CardTitle>
        <CardDescription>
          Configure custom fields for the new claim dialog based on policy type
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Policy Type Selector */}
        <div className="space-y-2">
          <Label>Select Policy Type</Label>
          <Select value={selectedPolicyId} onValueChange={handlePolicySelect}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a policy type..." />
            </SelectTrigger>
            <SelectContent>
              {mainPolicyTypes.map((mainType) => {
                const subtypes = getSubtypes(mainType.id);
                return (
                  <div key={mainType.id}>
                    <SelectItem value={mainType.id}>
                      <span className="font-semibold">{mainType.name}</span>
                    </SelectItem>
                    {subtypes.map((subtype) => (
                      <SelectItem key={subtype.id} value={subtype.id}>
                        <span className="ml-4">└─ {subtype.name}</span>
                      </SelectItem>
                    ))}
                  </div>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {selectedPolicy && (
          <div className="space-y-4 border rounded-lg p-4 bg-slate-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">{selectedPolicy.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedPolicy.description}
                </p>
              </div>
              <Badge variant={fields.length > 0 ? "default" : "secondary"}>
                {fields.length} fields
              </Badge>
            </div>

            {/* Fields List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Custom Fields ({fields.length})</Label>
                <Button onClick={handleAddField} size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Field
                </Button>
              </div>

              {fields.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                  No custom fields defined. Click "Add Field" to create one.
                </div>
              ) : (
                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="flex items-center gap-2 p-3 bg-white border rounded-lg"
                    >
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveField(index, 'up')}
                          disabled={index === 0}
                          className="h-4 p-0 hover:bg-transparent"
                        >
                          <GripVertical className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveField(index, 'down')}
                          disabled={index === fields.length - 1}
                          className="h-4 p-0 hover:bg-transparent"
                        >
                          <GripVertical className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{field.label}</span>
                          <Badge variant="outline" className="text-xs">
                            {field.type}
                          </Badge>
                          {field.required && (
                            <Badge variant="destructive" className="text-xs">
                              Required
                            </Badge>
                          )}
                        </div>
                        {field.placeholder && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Placeholder: {field.placeholder}
                          </p>
                        )}
                        {field.options && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Options: {field.options.join(", ")}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditField(field)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveField(field.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedPolicyId("");
                  setFields([]);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveToDatabase} disabled={saving}>
                {saving ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </div>
        )}

        {!selectedPolicy && (
          <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
            Select a policy type above to configure its claim fields.
          </div>
        )}
      </CardContent>

      {/* Add/Edit Field Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingField ? "Edit Field" : "Add New Field"}
            </DialogTitle>
            <DialogDescription>
              Configure the custom field for this policy type
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="label">Field Label *</Label>
              <Input
                id="label"
                value={fieldForm.label}
                onChange={(e) =>
                  setFieldForm({ ...fieldForm, label: e.target.value })
                }
                placeholder="e.g., Vehicle Registration Number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Field Type *</Label>
              <Select
                value={fieldForm.type}
                onValueChange={(value) =>
                  setFieldForm({ ...fieldForm, type: value as ClaimField['type'] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="select">Dropdown</SelectItem>
                  <SelectItem value="textarea">Text Area</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="placeholder">Placeholder</Label>
              <Input
                id="placeholder"
                value={fieldForm.placeholder}
                onChange={(e) =>
                  setFieldForm({ ...fieldForm, placeholder: e.target.value })
                }
                placeholder="Enter placeholder text"
              />
            </div>

            {fieldForm.type === 'select' && (
              <div className="space-y-2">
                <Label htmlFor="options">Options (comma-separated) *</Label>
                <Input
                  id="options"
                  value={fieldForm.options}
                  onChange={(e) =>
                    setFieldForm({ ...fieldForm, options: e.target.value })
                  }
                  placeholder="Option 1, Option 2, Option 3"
                />
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Switch
                id="required"
                checked={fieldForm.required}
                onCheckedChange={(checked) =>
                  setFieldForm({ ...fieldForm, required: checked })
                }
              />
              <Label htmlFor="required">Required field</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveField}
              disabled={!fieldForm.label.trim() || (fieldForm.type === 'select' && !fieldForm.options.trim())}
            >
              {editingField ? "Update Field" : "Add Field"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};