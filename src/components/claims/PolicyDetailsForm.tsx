import { useEffect, useCallback, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateClaim, useUpdateClaimSilent, type Claim } from "@/hooks/useClaims";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useSurveyors } from "@/hooks/useSurveyors";
import { useAddInsurer, useInsurers } from "@/hooks/useInsurers";
import { toast } from "sonner";
import { Save, Briefcase, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface PolicyDetailsFormProps {
  claim: Claim;
}

interface FormField {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "textarea" | "select" | "checkbox";
  required: boolean;
  options?: string[];
}



export const PolicyDetailsForm = ({ claim }: PolicyDetailsFormProps) => {

  // const updateClaimSilent = useUpdateClaimSilent();
  const queryClient = useQueryClient();
  
  const { register, handleSubmit, formState: { errors }, setValue, watch, reset, control } = useForm({
    defaultValues: {
      registration_id: claim.registration_id || '',
      insured_name: claim.insured_name || '',
      policy_number: claim.policy_number || '',
      sum_insured: claim.sum_insured || '',
      loss_description: claim.loss_description || '',
      intimation_date: claim.intimation_date || '',
      date_of_loss: claim.loss_date || '',
    }
  });

  console.log("[PolicyDetailsForm] Initial claim data:", claim);

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const { data: surveyors = [], isLoading: surveyorsLoading, error: surveyorsError } = useSurveyors();
  const { data: insurers = [], isLoading: insurersLoading, error: insurersError } = useInsurers();
  const addInsurerMutation = useAddInsurer();

  useEffect(() => {
    console.log("[PolicyDetailsForm] Surveyors:", { 
      loading: surveyorsLoading, 
      count: surveyors.length, 
      error: surveyorsError,
      data: surveyors 
    });
    console.log("[PolicyDetailsForm] Insurers:", { 
      loading: insurersLoading, 
      count: insurers.length, 
      error: insurersError,
      data: insurers 
    });
  }, [surveyors, insurers, surveyorsLoading, insurersLoading, surveyorsError, insurersError]);

  const updateClaimSilent = useUpdateClaimSilent();
  const updateClaimMutation = useUpdateClaim();

  const fields = (() => {
    const fieldsProp = claim.policy_types?.fields;
    if (Array.isArray(fieldsProp)) return fieldsProp as FormField[];
    const newClaimFields = (fieldsProp as any)?.new_claim_fields;
    return Array.isArray(newClaimFields) ? (newClaimFields as FormField[]) : [];
  })();

  const [pendingSaves, setPendingSaves] = useState<Set<string>>(new Set());
  const [brokers, setBrokers] = useState<Array<{ id: string; name: string; email: string | null; contact: string | null; company: string | null }>>([]);
  const [selectedBrokerId, setSelectedBrokerId] = useState<string>(claim.broker_id || "");
  const [showBrokerDialog, setShowBrokerDialog] = useState(false);
  const [newBrokerData, setNewBrokerData] = useState({
    name: "",
    email: "",
    contact: "",
    company: "",
  });

  // Reset form data when claim changes
  useEffect(() => {
    const formData = {
      registration_id: claim.registration_id || '',
      insured_name: claim.insured_name || '',
      insurer: claim.insurer_name || '',
      assigned_surveyor: claim.surveyor_name || '',
      policy_number: claim.policy_number || '',
      sum_insured: claim.sum_insured || '',
      loss_description: claim.loss_description || '',
      intimation_date: claim.intimation_date || '',
      date_of_loss: claim.loss_date || '',
    };
    console.log("[PolicyDetailsForm] Resetting form with data:", formData);
    reset(formData);
  }, [claim, reset]);

  // Reset broker ONLY when navigating to a different claim
  useEffect(() => {
    setSelectedBrokerId(claim.broker_id || "");
  }, [claim.id]);

  // Fetch brokers
  useEffect(() => {
    const fetchBrokers = async () => {
      const { data, error } = await supabase
        .from('brokers')
        .select('*')
        .order('name');
      
      if (!error && data) {
        setBrokers(data);
      }
    };
    fetchBrokers();
  }, []);

  const saveField = async (fieldName: string) => {
    if (!isMountedRef.current) return;
    
    console.log('💾 Saving field:', fieldName);
    
    try {
      const fieldValue = watch(fieldName);
      
      // Map form fields to database columns
      const updateData: any = {};
      
      // Handle standard fields that map directly to columns
      const directMappings: Record<string, string> = {
        registration_id: 'registration_id',
        insured_name: 'insured_name',
        policy_number: 'policy_number',
        sum_insured: 'sum_insured',
        loss_description: 'loss_description',
        intimation_date: 'intimation_date',
        date_of_loss: 'loss_date',
      };
      
      if (directMappings[fieldName]) {
        updateData[directMappings[fieldName]] = fieldValue === undefined || fieldValue === '' ? null : fieldValue;
      }

      // Handle surveyor field - need to find surveyor ID and update both columns
      if (fieldName === 'assigned_surveyor') {
        const surveyor = surveyors.find(s => s.name === fieldValue);
        updateData.surveyor_id = surveyor?.id || null;
        updateData.surveyor_name = fieldValue || null;
      }

      // Handle insurer field - need to find insurer ID and update both columns
      if (fieldName === 'insurer') {
        const insurer = insurers.find(i => i.name === fieldValue);
        updateData.insurer_id = insurer?.id || null;
        updateData.insurer_name = fieldValue || null;
      }

      // Use direct Supabase update
      const { error } = await supabase
        .from('claims')
        .update(updateData)
        .eq("id", claim.id);
        
      if (error) {
        console.error('❌ Save field error:', error);
        throw error;
      }
      
      if (isMountedRef.current) {
        setPendingSaves((prev) => {
          const newSet = new Set(prev);
          newSet.delete(fieldName);
          return newSet;
        });

        // Invalidate the claim query to refresh the UI
        queryClient.invalidateQueries({ queryKey: ["claim", claim.id] });

        toast.success("Policy detail saved", { duration: 1800 }); 
        console.log('✅ Field saved successfully');
      }
    } catch (error) {
      if (isMountedRef.current) {
        console.error("Failed to save field:", error);
        toast.error("Failed to save field", { duration: 1800 });
      }
    }
  };

  const renderField = (field: FormField) => {
    const fieldValue = watch(field.name);

    switch (field.type) {
      case "text":
        return (
          <div key={field.name} className="relative transition-all duration-200 rounded-lg py-1">
            <div className="flex items-start gap-4">
              <div className="w-[250px] flex-shrink-0 pt-2">
                <Label>{field.label}{field.required && <span className="text-destructive">*</span>}</Label>
              </div>
              <div className="flex-1 max-w-full">
                <Input
                  id={field.name}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  {...register(field.name, {
                    required: field.required ? `${field.label} is required` : false,
                    onChange: (e) => {
                      const fieldKey = field.name as keyof Claim;
                      const currentValue = claim[fieldKey] || "";
                      if (e.target.value !== currentValue) {
                        setPendingSaves((prev) => new Set([...prev, field.name]));
                      }
                    },
                    onBlur: () => pendingSaves.has(field.name) && saveField(field.name)
                  })}
                />
                {errors[field.name as keyof typeof errors] && (
                  <p className="text-sm text-destructive mt-1">
                    {String(errors[field.name as keyof typeof errors]?.message || '')}
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case "number":
        return (
          <div key={field.name} className="relative transition-all duration-200 rounded-lg py-1">
            <div className="flex items-start gap-4">
              <div className="w-[250px] flex-shrink-0 pt-2">
                <Label>{field.label}{field.required && <span className="text-destructive">*</span>}</Label>
              </div>
              <div className="flex-1 max-w-full">
                <Input
                  id={field.name}
                  type="number"
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  {...register(field.name, {
                    required: field.required ? `${field.label} is required` : false,
                    valueAsNumber: true,
                    onChange: (e) => {
                      const fieldKey = field.name as keyof Claim;
                      const currentValue = String(claim[fieldKey] ?? "");
                      if (e.target.value !== currentValue) {
                        setPendingSaves((prev) => new Set([...prev, field.name]));
                      }
                    },
                    onBlur: () => pendingSaves.has(field.name) && saveField(field.name)
                  })}
                />
                {errors[field.name as keyof typeof errors] && (
                  <p className="text-sm text-destructive mt-1">
                    {String(errors[field.name as keyof typeof errors]?.message || '')}
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case "date":
        return (
          <div key={field.name} className="relative transition-all duration-200 rounded-lg py-1">
            <div className="flex items-start gap-4">
              <div className="w-[250px] flex-shrink-0 pt-2">
                <Label>{field.label}{field.required && <span className="text-destructive">*</span>}</Label>
              </div>
              <div className="flex-1 max-w-full">
                <Input
                  id={field.name}
                  type="date"
                  {...register(field.name, {
                    required: field.required ? `${field.label} is required` : false,
                    onChange: (e) => {
                      const fieldKey = field.name as keyof Claim;
                      const currentValue = claim[fieldKey] || "";
                      if (e.target.value !== currentValue) {
                        setPendingSaves((prev) => new Set([...prev, field.name]));
                      }
                    },
                    onBlur: () => pendingSaves.has(field.name) && saveField(field.name)
                  })}
                />
                {errors[field.name as keyof typeof errors] && (
                  <p className="text-sm text-destructive mt-1">
                    {String(errors[field.name as keyof typeof errors]?.message || '')}
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case "textarea":
        return (
          <div key={field.name} className="relative transition-all duration-200 rounded-lg py-1">
            <div className="flex items-start gap-4">
              <div className="w-[250px] flex-shrink-0 pt-2">
                <Label>{field.label}{field.required && <span className="text-destructive">*</span>}</Label>
              </div>
              <div className="flex-1 max-w-full">
                <Textarea
                  id={field.name}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  rows={4}
                  {...register(field.name, {
                    required: field.required ? `${field.label} is required` : false,
                    onChange: (e) => {
                      const fieldKey = field.name as keyof Claim;
                      const currentValue = claim[fieldKey] || "";
                      if (e.target.value !== currentValue) {
                        setPendingSaves((prev) => new Set([...prev, field.name]));
                      }
                    },
                    onBlur: () => pendingSaves.has(field.name) && saveField(field.name)
                  })}
                />
                {errors[field.name as keyof typeof errors] && (
                  <p className="text-sm text-destructive mt-1">
                    {String(errors[field.name as keyof typeof errors]?.message || '')}
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case "select":
        // Special handling for surveyor field
        if (field.name === "assigned_surveyor") {
          return (
            <div key={field.name} className="relative transition-all duration-200 rounded-lg py-1">
              <div className="flex items-start gap-4">
                <div className="w-[250px] flex-shrink-0 pt-2">
                  <Label>{field.label}{field.required && <span className="text-destructive">*</span>}</Label>
                </div>
                <div className="flex-1 max-w-full">
                  {surveyorsError && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded mb-2">
                      Failed to load surveyors: {surveyorsError.message}
                    </div>
                  )}
                  <SearchableSelect
                    options={surveyors.map((s) => s.name)}
                    value={fieldValue || ""}
                    placeholder={surveyorsLoading ? "Loading surveyors..." : "Select surveyor..."}
                    searchPlaceholder="Search surveyors..."
                    onValueChange={(val) => {
                      setValue(field.name, val);
                      const fieldKey = field.name as keyof Claim;
                      if (val !== (claim[fieldKey] || "")) {
                        setPendingSaves((prev) => new Set([...prev, field.name]));
                        setTimeout(() => saveField(field.name), 500);
                      }
                    }}
                    disabled={surveyorsLoading || !!surveyorsError}
                    allowClear
                    allowCreate={false}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          );
        }

        // Special handling for insurer field
        if (field.name === "insurer") {
          return (
            <div key={field.name} className="relative transition-all duration-200 rounded-lg py-1">
              <div className="flex items-start gap-4">
                <div className="w-[250px] flex-shrink-0 pt-2">
                  <Label>{field.label}{field.required && <span className="text-destructive">*</span>}</Label>
                </div>
                <div className="flex-1 max-w-full">
                  {insurersError && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded mb-2">
                      Failed to load insurers: {insurersError.message}
                    </div>
                  )}
                  <SearchableSelect
                    options={insurers.map((i) => i.name)}
                    value={fieldValue || ""}
                    placeholder={insurersLoading ? "Loading insurers..." : "Select or add insurer..."}
                    searchPlaceholder="Search or add insurer..."
                    onValueChange={(val) => {
                      setValue(field.name, val);
                      const fieldKey = field.name as keyof Claim;
                      if (val !== (claim[fieldKey] || "")) {
                        setPendingSaves((prev) => new Set([...prev, field.name]));
                        setTimeout(() => saveField(field.name), 500);
                      }
                    }}
                    allowClear
                    allowCreate
                    onCreateOption={async (val) => {
                      await addInsurerMutation.mutateAsync(val);
                    }}
                    createOptionText="Add insurer"
                    disabled={insurersLoading || addInsurerMutation.isPending || !!insurersError}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          );
        }

        // Regular select for other fields
        return (
          <div key={field.name} className="relative transition-all duration-200 rounded-lg py-1">
            <div className="flex items-start gap-4">
              <div className="w-[250px] flex-shrink-0 pt-2">
                <Label>{field.label}{field.required && <span className="text-destructive">*</span>}</Label>
              </div>
              <div className="flex-1 max-w-full">
                <Select
                  value={typeof fieldValue === "string" ? fieldValue : ""}
                  onValueChange={(value) => {
                    setValue(field.name, value);
                    const fieldKey = field.name as keyof Claim;
                    if (value !== (claim[fieldKey] || "")) {
                      setPendingSaves((prev) => new Set([...prev, field.name]));
                    }
                  }}
                  onOpenChange={(open) => {
                    if (!open && pendingSaves.has(field.name)) {
                      setTimeout(() => saveField(field.name), 100);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors[field.name as keyof typeof errors] && (
                  <p className="text-sm text-destructive mt-1">
                    {String(errors[field.name as keyof typeof errors]?.message || '')}
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case "checkbox":
        return (
          <div key={field.name} className="relative transition-all duration-200 rounded-lg py-1">
            <div className="flex items-center gap-4">
              <div className="w-[250px] flex-shrink-0">
                <Label htmlFor={field.name}>{field.label}</Label>
              </div>
              <div className="flex-1 max-w-full">
                <Checkbox
                  id={field.name}
                  checked={fieldValue || false}
                  onCheckedChange={(checked) => {
                    setValue(field.name, !!checked);
                    const fieldKey = field.name as keyof Claim;
                    if (checked !== (claim[fieldKey] || false)) {
                      setPendingSaves((prev) => new Set([...prev, field.name]));
                      setTimeout(() => pendingSaves.has(field.name) && saveField(field.name), 500);
                    }
                  }}
                />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Define the standard fields including insurer and surveyor
  const standardFields = [
    { name: "registration_id", label: "Registration ID", type: "text" as const, required: true },
    { name: "insured_name", label: "Insured Name", type: "text" as const, required: true },
    { name: "insurer", label: "Insurer", type: "select" as const, required: false },
    { name: "assigned_surveyor", label: "Assigned Surveyor", type: "select" as const, required: false },
    { name: "policy_number", label: "Policy Number", type: "text" as const, required: false },
    { name: "sum_insured", label: "Sum Insured", type: "number" as const, required: false },
    { name: "date_of_loss", label: "Date of Loss", type: "date" as const, required: false },
    { name: "loss_description", label: "Loss Description", type: "textarea" as const, required: false },
    { name: "intimation_date", label: "Intimation Date", type: "date" as const, required: false },
  ];

  const onSubmit = async (data: Record<string, any>) => {
    console.log('🔥 onSubmit CALLED with data:', data);
    
    try {
      // Find surveyor and insurer IDs
      const surveyor = surveyors.find(s => s.name === data.assigned_surveyor);
      const insurer = insurers.find(i => i.name === data.insurer);

      const updateData: any = {
        registration_id: data.registration_id || null,
        insured_name: data.insured_name || null,
        surveyor_id: surveyor?.id || null,
        surveyor_name: data.assigned_surveyor || null,
        insurer_id: insurer?.id || null,
        insurer_name: data.insurer || null,
        policy_number: data.policy_number || null,
        sum_insured: data.sum_insured ? parseFloat(data.sum_insured) : null,
        loss_date: data.date_of_loss || null,
        loss_description: data.loss_description || null,
        intimation_date: data.intimation_date || null,
      };
      
      console.log('✅ Updating claims table with:', updateData);
      
      const { error, data: result } = await supabase
        .from('claims')
        .update(updateData)
        .eq("id", claim.id)
        .select();

      console.log('📤 Supabase response:', { error, result });

      if (error) throw error;
      
      toast.success("Policy details updated successfully!");
    } catch (error) {
      console.error("❌ Failed to update:", error);
      toast.error("Failed to update policy details");
    }
  };

  const handleBrokerChange = async (brokerId: string) => {
    if (brokerId === "new") {
      setShowBrokerDialog(true);
      return;
    }

    const previousBrokerId = selectedBrokerId;
    setSelectedBrokerId(brokerId);

    try {
      const { error } = await supabase
        .from('claims')
        .update({ broker_id: brokerId || null })
        .eq("id", claim.id);

      if (error) throw error;
      
      toast.success("Broker assigned successfully");
    } catch (error) {
      console.error("Error:", error);
      setSelectedBrokerId(previousBrokerId);
      toast.error("Failed to assign broker");
    }
  };

  const handleCreateBroker = async () => {
    if (!newBrokerData.name.trim()) {
      toast.error("Broker name is required");
      return;
    }

    try {
      const { data, error } = await supabase
        .from('brokers')
        .insert([newBrokerData])
        .select()
        .single();

      if (error) throw error;

      setBrokers([...brokers, data]);
      setSelectedBrokerId(data.id);
      
      const { error: updateError } = await supabase
        .from('claims')
        .update({ broker_id: data.id })
        .eq("id", claim.id);

      if (updateError) throw updateError;

      toast.success("Broker created and assigned successfully");
      setShowBrokerDialog(false);
      setNewBrokerData({ name: "", email: "", contact: "", company: "" });
    } catch (error) {
      console.error("Error creating broker:", error);
      toast.error("Failed to create broker");
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="bg-white/90 backdrop-blur-sm border-white/30 shadow-lg">
        <CardHeader className="bg-slate-700 text-white rounded-t-lg">
          <CardTitle className="flex items-center gap-2">
            <Save className="w-5 h-5" />
            Policy Information
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-primary rounded-full"></div>
                <h3 className="text-lg font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Policy Details
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-1 gap-2">
                {standardFields.map(renderField)}
                {/* Add any additional dynamic fields from policy type */}
                {fields.map(renderField)}
              </div>
            </div>
            
            {/* Broker/Agent Details Section */}
            <div className="space-y-6 pt-6 border-t border-border/50">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-purple-500 rounded-full"></div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Agent/Broker Details
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Broker Selection Dropdown */}
                <div className="space-y-2">
                  <Label htmlFor="broker-select">Select Broker / Agent</Label>
                  <Select 
                    value={selectedBrokerId} 
                    onValueChange={handleBrokerChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select broker..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">
                        <div className="flex items-center gap-2">
                          <Plus className="w-4 h-4" />
                          <span>Add New Broker</span>
                        </div>
                      </SelectItem>
                      {brokers.map((broker) => (
                        <SelectItem key={broker.id} value={broker.id}>
                          {broker.name} {broker.company ? `(${broker.company})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Show broker details fields when a broker is selected */}
                {selectedBrokerId && selectedBrokerId !== "new" && (() => {
                  const broker = brokers.find(b => b.id === selectedBrokerId);
                  return broker ? (
                    <>
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input 
                          value={broker.name} 
                          disabled 
                          className="bg-gray-50"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Company</Label>
                        <Input 
                          value={broker.company || ''} 
                          disabled 
                          placeholder="No company"
                          className="bg-gray-50"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Contact Number</Label>
                        <Input 
                          value={broker.contact || ''} 
                          disabled 
                          placeholder="No contact"
                          className="bg-gray-50"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input 
                          value={broker.email || ''} 
                          disabled 
                          placeholder="No email"
                          className="bg-gray-50"
                        />
                      </div>
                    </>
                  ) : null;
                })()}
              </div>

              {/* Empty state when no broker selected */}
              {!selectedBrokerId && (
                <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <Briefcase className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">No broker selected</p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-border/50">
              <Button
                type="submit"
                disabled={updateClaimMutation.isPending}
                className="w-full bg-slate-700 hover:bg-slate-800 text-white shadow-sm transition-all duration-200"
              >
                {updateClaimMutation.isPending ? "Saving..." : "Save Policy Details"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* New Broker Dialog */}
      <Dialog open={showBrokerDialog} onOpenChange={setShowBrokerDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              Add New Broker / Agent
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-broker-name">Name *</Label>
              <Input
                id="new-broker-name"
                placeholder="Enter broker name"
                value={newBrokerData.name}
                onChange={(e) => setNewBrokerData({ ...newBrokerData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-broker-company">Company</Label>
              <Input
                id="new-broker-company"
                placeholder="Enter company name"
                value={newBrokerData.company}
                onChange={(e) => setNewBrokerData({ ...newBrokerData, company: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-broker-contact">Contact Number</Label>
              <Input
                id="new-broker-contact"
                placeholder="+91 98765 43210"
                value={newBrokerData.contact}
                onChange={(e) => setNewBrokerData({ ...newBrokerData, contact: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-broker-email">Email</Label>
              <Input
                id="new-broker-email"
                type="email"
                placeholder="broker@example.com"
                value={newBrokerData.email}
                onChange={(e) => setNewBrokerData({ ...newBrokerData, email: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowBrokerDialog(false);
                setNewBrokerData({ name: "", email: "", contact: "", company: "" });
                setSelectedBrokerId("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateBroker}>
              Create Broker
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PolicyDetailsForm;