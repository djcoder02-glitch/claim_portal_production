import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, FileText, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePolicyTypes } from "@/hooks/useClaims";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/components/auth/AuthProvider";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface PolicyType {
  id: string;
  name: string;
  description: string;
  parent_id?: string;
  required_documents?: string[];
}

export const DocumentRequirementsManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: allPolicyTypes = [], isLoading, refetch } = useQuery({
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
      return data;
    },
    enabled: !!user?.id,
  });
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>("");
  const [documentInput, setDocumentInput] = useState("");
  const [documents, setDocuments] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const selectedPolicy = allPolicyTypes.find((pt) => pt.id === selectedPolicyId);

  const handlePolicySelect = (policyId: string) => {
    setSelectedPolicyId(policyId);
    const policy = allPolicyTypes.find((pt) => pt.id === policyId);
    setDocuments(policy?.required_documents || []);
  };

  const handleAddDocument = () => {
    const trimmed = documentInput.trim();
    if (trimmed && !documents.includes(trimmed)) {
      setDocuments([...documents, trimmed]);
      setDocumentInput("");
    }
  };

  const handleRemoveDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!selectedPolicyId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("policy_types")
        .update({ required_documents: documents })
        .eq("id", selectedPolicyId);

      if (error) throw error;

      toast.success("Document requirements updated successfully");
      refetch();
    } catch (error) {
      console.error("Error saving requirements:", error);
      toast.error("Failed to update document requirements");
    } finally {
      setSaving(false);
    }
  };

  const mainPolicyTypes = allPolicyTypes.filter((pt) => !pt.parent_id);
  const getSubtypes = (parentId: string) =>
    allPolicyTypes.filter((pt) => pt.parent_id === parentId);

  if (isLoading) {
    return <div>Loading policy types...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Manage Document Requirements by Policy Type
        </CardTitle>
        <CardDescription>
          Define which documents are required for each policy type/subtype. These will be shown to users when creating claims.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Select Policy Type / Subtype</Label>
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
                <p className="text-sm text-muted-foreground">{selectedPolicy.description}</p>
              </div>
              <Badge variant={documents.length > 0 ? "default" : "secondary"}>
                {documents.length} documents
              </Badge>
            </div>

            <div className="space-y-2">
              <Label>Add Required Document</Label>
              <div className="flex gap-2">
                <Input
                  value={documentInput}
                  onChange={(e) => setDocumentInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddDocument();
                    }
                  }}
                  placeholder="e.g., Bill of Lading, Survey Report, Invoice..."
                  className="flex-1"
                />
                <Button onClick={handleAddDocument} type="button" size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Required Documents ({documents.length})</Label>
              {documents.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    No documents required yet. Add documents using the input above.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-white border rounded-lg hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span>{doc}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveDocument(index)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedPolicyId("");
                  setDocuments([]);
                  setDocumentInput("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Saving..." : "Save Requirements"}
              </Button>
            </div>
          </div>
        )}

        {!selectedPolicy && (
          <Alert>
            <AlertDescription>
              Select a policy type above to configure its required documents.
            </AlertDescription>
          </Alert>
        )}

        <div className="pt-6 border-t">
          <h3 className="font-semibold mb-4">All Policy Type Requirements</h3>
          <div className="grid gap-3">
            {allPolicyTypes
              .filter((pt) => pt.required_documents && pt.required_documents.length > 0)
              .map((pt) => (
                <Card key={pt.id} className="bg-white">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium">{pt.name}</p>
                        {pt.parent_id && (
                          <p className="text-xs text-muted-foreground">
                            Parent: {allPolicyTypes.find((p) => p.id === pt.parent_id)?.name}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline">{pt.required_documents?.length} docs</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {pt.required_documents?.map((doc, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {doc}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};