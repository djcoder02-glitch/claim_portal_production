import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/AuthProvider";

export const ParsingConfigManager = () => {
  const { user } = useAuth();
  const [selectedPolicyType, setSelectedPolicyType] = useState<string>("");
  const [billFields, setBillFields] = useState<string[]>([]);
  const [policyFields, setPolicyFields] = useState<string[]>([]);
  const [newBillField, setNewBillField] = useState("");
  const [newPolicyField, setNewPolicyField] = useState("");
  
  const queryClient = useQueryClient();

  // Replace the policy types query
  const { data: policyTypes } = useQuery({
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

  // Load parsing config when policy type selected
  useEffect(() => {
    if (selectedPolicyType) {
      type ParsingConfig = {
        bill_of_entry?: any[];  // Adjust types as needed
        policy_document?: any[];
      };
      const policy = policyTypes?.find(p => p.id === selectedPolicyType);
        if (policy?.parsing_config) {
          const config = policy.parsing_config as ParsingConfig;
          setBillFields(config.bill_of_entry || []);
          setPolicyFields(config.policy_document || []);
        } else {
          setBillFields([]);
          setPolicyFields([]);  // Added for consistency
        }
    }
  }, [selectedPolicyType, policyTypes]);

  // Save mutation
  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("policy_types")
        .update({
          parsing_config: {
            bill_of_entry: billFields,
            policy_document: policyFields
          }
        })
        .eq("id", selectedPolicyType);
      
      if (error) throw error;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["policy-types"] });
      
      // ADD THIS - Log what was saved
      const { data } = await supabase
        .from("policy_types")
        .select("name, parsing_config")
        .eq("id", selectedPolicyType)
        .single();
      console.log("✅ Saved parsing config:", data);
      
      toast.success("Parsing configuration saved!");
    },
  });
  

  const addBillField = () => {
    if (newBillField.trim()) {
      // Split by comma and clean up each field
      const fieldsToAdd = newBillField
        .split(',')
        .map(f => f.trim())
        .filter(f => f.length > 0 && !billFields.includes(f));
      
      if (fieldsToAdd.length > 0) {
        setBillFields([...billFields, ...fieldsToAdd]);
        setNewBillField("");
        toast.success(`Added ${fieldsToAdd.length} field(s)`);
      } else {
        toast.error("No new fields to add (duplicates or empty)");
      }
    }
  };

  const addPolicyField = () => {
    if (newPolicyField.trim()) {
      // Split by comma and clean up each field
      const fieldsToAdd = newPolicyField
        .split(',')
        .map(f => f.trim())
        .filter(f => f.length > 0 && !policyFields.includes(f));
      
      if (fieldsToAdd.length > 0) {
        setPolicyFields([...policyFields, ...fieldsToAdd]);
        setNewPolicyField("");
        toast.success(`Added ${fieldsToAdd.length} field(s)`);
      } else {
        toast.error("No new fields to add (duplicates or empty)");
      }
    }
  };

  const removeBillField = (field: string) => {
    setBillFields(billFields.filter(f => f !== field));
  };

  const removePolicyField = (field: string) => {
    setPolicyFields(policyFields.filter(f => f !== field));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Document Parsing Configuration
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure which fields to extract from Bill of Entry and Policy Documents for each policy type
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Policy Type Selector */}
          <div>
            <Label>Select Policy Type / Subtype</Label>
            <select
              className="w-full mt-2 p-2 border rounded-md"
              value={selectedPolicyType}
              onChange={(e) => setSelectedPolicyType(e.target.value)}
            >
              <option value="">Choose a policy type...</option>
              {policyTypes?.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {pt.parent_type ? `${pt.parent_type} - ${pt.name}` : pt.name}
                </option>
              ))}
            </select>
          </div>

          {selectedPolicyType && (
            <>
              {/* Bill of Entry Fields */}
              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-lg">Bill of Entry Fields</h3>
                <p className="text-sm text-muted-foreground">
                  Only these fields will be extracted from Bill of Entry documents
                </p>
                
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., consignee_name, invoice_no, certificate_no"
                    value={newBillField}
                    onChange={(e) => setNewBillField(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && addBillField()}
                  />
                  <Button onClick={addBillField} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {billFields.map((field) => (
                    <div
                      key={field}
                      className="flex items-center gap-2 bg-blue-100 px-3 py-1 rounded-full"
                    >
                      <span className="text-sm font-mono">{field}</span>
                      <button
                        onClick={() => removeBillField(field)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Policy Document Fields */}
              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-lg">Policy Document Fields</h3>
                <p className="text-sm text-muted-foreground">
                  Only these fields will be extracted from Policy documents
                </p>
                
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., policy_number, insured_name, sum_insured"
                    value={newPolicyField}
                    onChange={(e) => setNewPolicyField(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && addPolicyField()}
                  />
                  <Button onClick={addPolicyField} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {policyFields.map((field) => (
                    <div
                      key={field}
                      className="flex items-center gap-2 bg-green-100 px-3 py-1 rounded-full"
                    >
                      <span className="text-sm font-mono">{field}</span>
                      <button
                        onClick={() => removePolicyField(field)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <Button 
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="w-full"
              >
                {saveMutation.isPending ? "Saving..." : "Save Configuration"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};