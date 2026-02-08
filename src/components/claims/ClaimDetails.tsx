import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Json } from "@/integrations/supabase/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, FileText, Info, Eye, Upload, CheckCircle2, Clock, AlertCircle, IndianRupee } from "lucide-react";
import { useClaimById, useUpdateClaim, useUpdateClaimSilent } from "@/hooks/useClaims";
import { PolicyDetailsForm } from "./PolicyDetailsForm";
import { AdditionalInformationForm } from "./AdditionalInformationForm";
import { ReportPreview } from "./ReportPreview";
import { DocumentManager } from "./DocumentManager";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useAuth } from '../auth/AuthProvider';
import {SelectiveDocumentExtractor} from "./SelectiveDocumentExtractor"
import { FeeBillForm } from "./FeeBillForm";
import { Assessment } from "./Assessment";
import { DocumentsTab } from "../documents/DocumentsTab";



const statusConfig = {
  submitted: { color: "bg-slate-600", icon: Clock, label: "Submitted" },
  under_review: { color: "bg-amber-600", icon: AlertCircle, label: "Under Review" },
  approved: { color: "bg-green-700", icon: CheckCircle2, label: "Approved" },
  rejected: { color: "bg-red-600", icon: AlertCircle, label: "Rejected" },
  paid: { color: "bg-green-800", icon: CheckCircle2, label: "Paid" },
  pending:{color: "bg-blue-600", icon: AlertCircle, label:"Pending"},
};

type ClaimDocumentRow = Tables<'claim_documents'>;
type ClaimStatus = "pending" | "submitted" | "under_review" | "approved" | "rejected" | "paid";

interface ExtractedBillData {
  consignee_name?: string;
  consignee_importer?: string;
  applicant_survey?: string;
  underwriter_name?: string;
  cha_name?: string;
  certificate_no?: string;
  endorsement_no?: string;
  invoice_no?: string;
  invoice_date?: string;
  invoice_value?: string;
  invoice_pcs?: string;
  invoice_gross_wt?: string;
  invoice_net_wt?: string;
}


export const ClaimDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { data: claim, isLoading } = useClaimById(id!);
  const [activeTab, setActiveTab] = useState("policy-details");
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadedBillOfEntry, setUploadedBillOfEntry] = useState<ClaimDocumentRow | null>(null);
  const queryClient = useQueryClient();
  const {isAdmin, user, isSuperAdmin} = useAuth();


  // console.log('[ClaimDetails] User:', user?.id);
  // console.log('[ClaimDetails] isAdmin:', isAdmin);
  // console.log('[ClaimDetails] Claim user_id:', claim?.user_id);
  // console.log('[ClaimDetails] Claim exists:', !!claim);

//   const POLICY_DOCUMENT_FIELDS = [
//   'policy_type',
//   'policy_id',
// ];


const handlePolicyDocumentExtracted = async (extractedData: Record<string, any>) => {
  console.log('✅ Policy Document Data Extracted:', extractedData);
  
  try {
    // Get current form data
    const currentFormData = claim?.sections || {};
    
    // Merge with extracted data
    const updatedFormData = {
      ...currentFormData,
      ...extractedData
    };

    // Save to database
    await updateClaimSilentMutation.mutateAsync({
      id: claim!.id,
      updates: {
        sections: updatedFormData as Json
      }
    });

    // Show success message
    toast.success(`✅ Successfully saved ${Object.keys(extractedData).length} fields from Policy Document!`);
    
    // Refresh claim data
    queryClient.invalidateQueries({ queryKey: ["claim", id] });
    
  } catch (error) {
    console.error('❌ Failed to save extracted data:', error);
    toast.error('Failed to save extracted data to database');
  }
};

const handleBillOfEntryExtracted = async (extractedData: Record<string, any>) => {
  console.log('✅ Bill of Entry Data Extracted:', extractedData);
  
  try {
    // Get current form data
    const currentFormData = claim?.sections || {};
    
    // Merge with extracted data
    const updatedFormData = {
      ...currentFormData,
      ...extractedData
    };

    // Save to database
    await updateClaimSilentMutation.mutateAsync({
      id: claim!.id,
      updates: {
        sections: updatedFormData as Json
      }
    });

    // Show success message
    toast.success(`✅ Successfully saved ${Object.keys(extractedData).length} fields from Bill of Entry!`);
    
    // Refresh claim data
    queryClient.invalidateQueries({ queryKey: ["claim", id] });
    
  } catch (error) {
    console.error('❌ Failed to save extracted data:', error);
    toast.error('Failed to save extracted data to database');
  }
};


  useEffect(() => {
    const loadExistingDocuments = async () => {
      if (!id) return;
      
      try {
        const { data: documents, error } = await supabase
          .from('claim_documents')
          .select('*')
          .eq('claim_id', id)
          .eq('field_label', 'Bill of Entry')
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) {
          console.error('Error loading documents:', error);
          return;
        }

        if (documents && documents.length > 0) {
          setUploadedBillOfEntry(documents[0]);
        }
      } catch (error) {
        console.error('Failed to load existing documents:', error);
      }
    };

    loadExistingDocuments();
  }, [id]);

  

  const handleTabChange = (value: string) => {
    const sectionNames: Record<string, string> = {
      "policy-details": "Policy Details",
      "additional-info": "Additional Information", 
      "report-preview": "View Report",
      "documents": "Documents",
      "fee-bill": "Fee Bill Details",
      "assessment": "Assessment",
    };
    
    if (activeTab !== value) {
      const currentSectionName = sectionNames[activeTab];
      if (currentSectionName && (activeTab === "policy-details" || activeTab === "additional-info")) {
        toast.success(`${currentSectionName} saved successfully`);
      }
    }
    
    setActiveTab(value);
  };
  

  const updateClaimMutation = useUpdateClaim();
  const updateClaimSilentMutation = useUpdateClaimSilent();

  const populateFormFields = async (extractedData: ExtractedBillData) => {
    console.log('populateFormFields called with:', extractedData);
    
    // Map the extracted data to your form field names
    const mappedData: Record<string, unknown> = {};
    
    Object.entries(extractedData).forEach(([key, value]) => {
      if (value) {
        // Map extracted keys to actual form field names
        switch (key) {
          case 'consignee_name':
            mappedData['consigner_name'] = (value);
            break;
          case 'consignee_importer':
            mappedData['consignee_name'] = (value);
            break;
          case 'applicant_survey':
            mappedData['applicant_survey'] = (value);
            break;
          case 'underwriter_name':
            mappedData['underwriter_name'] = (value);
            break;
          case 'cha_name':
            mappedData['cha_name'] = (value);
            break;
          case 'certificate_no':
            mappedData['certificate_no'] = (value);
            break;
          case 'endorsement_no':
            mappedData['endorsement_no'] = (value);
            break;
          case 'invoice_no':
            mappedData['invoice_no'] = (value);
            break;
          case 'invoice_date':
            mappedData['invoice_date'] = (value);
            break;
          case 'invoice_value':
            mappedData['invoice_value'] = (value);
            break;
          case 'invoice_pcs':
            mappedData['invoice_pkg_count'] = (value);
            break;
          case 'invoice_gross_wt':
            mappedData['invoice_gross_wt'] = (value);
            break;
          case 'invoice_net_wt':
            mappedData['invoice_net_wt'] = (value);
            break;
          default:
            mappedData[key] = (value);
        }
      }
    });

    try {
      // Get current form data and merge with extracted data
      const currentFormData = (claim?.sections as Record<string, unknown>) || {};
      const updatedFormData = {
        ...currentFormData,
        ...mappedData
      };

      // Update the claim in the database
      await updateClaimSilentMutation.mutateAsync({
        id: claim!.id,
        updates: {
          sections: updatedFormData as unknown as Json
        }
      });

      console.log(`Successfully saved ${Object.keys(mappedData).length} fields to database`);
      toast.success(`Extracted and saved ${Object.keys(mappedData).length} fields to database!`);
      
      // Refresh the claim data to show updated fields
      queryClient.invalidateQueries({ queryKey: ["claim", id] });
      
    } catch (error) {
      console.error('Failed to save extracted data:', error);
      toast.error('Failed to save extracted data to database');
    }
  };

  const handleStatusUpdate = async (newStatus: ClaimStatus) => {
    try {
      await updateClaimMutation.mutateAsync({
        id: claim!.id,
        updates: { status: newStatus }
      });
      toast.success(`Claim status updated to ${newStatus}`);
    } catch (error) {
      toast.error("Failed to update claim status");
    }
  };

  // Upload Bill of Entry mutation
  const uploadBillOfEntryMutation = useMutation<ClaimDocumentRow, Error, File>({
    mutationFn: async (file: File): Promise<ClaimDocumentRow> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${user.id}/${id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from("claim-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from("claim_documents")
        .insert({
          claim_id: id!,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: user.id,
          field_label: 'Bill of Entry',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data: ClaimDocumentRow) => {
      queryClient.invalidateQueries({ queryKey: ["claim-documents", id] });
      setUploadedBillOfEntry(data);
      toast.success("Bill of Entry uploaded successfully!");
    },
    onError: (error) => {
      toast.error("Failed to upload Bill of Entry: " + error.message);
    },
  });

  const extractBillDataMutation = useMutation({
    mutationFn: async (documentData: ClaimDocumentRow) => {
      const { data: fileData, error } = await supabase.storage
        .from('claim-documents')
        .download(documentData.file_path);

      if (error) throw new Error(`Failed to download file: ${error.message}`);

      const arrayBuffer = await fileData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64Data = btoa(binary);

      const response = await fetch('https://mlkkk63swrqairyiahlk357sui0argkn.lambda-url.ap-south-1.on.aws/extract-bill-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pdfData: base64Data,
          claimId: id
        })
      });

      if (!response.ok) throw new Error('Extraction failed');
      return response.json();
    },
    onSuccess: (result) => {
      if (result.success && result.extractedData) {
        populateFormFields(result.extractedData);
      } else {
        toast.error("Extraction failed: " + result.message);
      }
    },
    onError: (error) => {
      toast.error("Failed to extract data: " + error.message);
    },
  });

  const handleExtractData = async () => {
    if (!uploadedBillOfEntry) return;
    
    setIsExtracting(true);
    try {
      await extractBillDataMutation.mutateAsync(uploadedBillOfEntry);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleReUpload = () => {
    setUploadedBillOfEntry(null);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleBillOfEntryUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      await uploadBillOfEntryMutation.mutateAsync(files[0]);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-6 bg-gradient-background">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gradient-to-r from-primary/20 to-accent/20 rounded-lg w-64"></div>
            <div className="h-32 bg-gradient-to-r from-secondary/30 to-muted/30 rounded-lg"></div>
            <div className="h-96 bg-gradient-to-r from-muted/20 to-secondary/20 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="min-h-screen p-6 bg-gradient-background">
        <div className="max-w-7xl mx-auto text-center py-12">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/20">
            <h1 className="text-2xl font-bold text-destructive">Claim not found</h1>
            <p className="text-muted-foreground mt-2">
              The claim you're looking for doesn't exist or you don't have access to it.
            </p>
            <Button asChild className="w-full bg-slate-600 hover:bg-slate-700 text-white shadow-sm transition-all duration-200">
              <Link to="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (claim && !isAdmin && !isSuperAdmin && claim.user_id !== user?.id) {
  return (
    <div className="min-h-screen p-6 bg-gradient-background">
      <div className="max-w-7xl mx-auto text-center py-12">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/20">
          <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
          <p className="text-muted-foreground mt-2">
            You don't have permission to view this claim.
          </p>
          <Button asChild className="w-full bg-slate-600 hover:bg-slate-700 text-white shadow-sm transition-all duration-200">
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

  const currentStatus = statusConfig[claim.status as keyof typeof statusConfig];
  const StatusIcon = currentStatus?.icon || Clock;

  return (
    <div className="min-h-screen p-6 bg-gradient-background">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Enhanced Header */}
        <Card className="bg-white/95 backdrop-blur-sm border border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button variant="ghost" size="sm" asChild className="hover:bg-slate-100">
                  <Link to="/">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Dashboard
                  </Link>
                </Button>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-slate-800">
                      {claim.title}
                    </h1>
                    <Select
                      value={claim.status}
                      onValueChange={(newStatus: ClaimStatus) => handleStatusUpdate(newStatus)}
                    >
                      <SelectTrigger className="w-48">
                        <Badge className={`${currentStatus?.color} text-white px-3 py-1 flex items-center gap-1 shadow-sm`}>
                          <StatusIcon className="w-3 h-3" />
                          {currentStatus?.label}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="submitted">Submitted</SelectItem>
                        <SelectItem value="under_review">Under Review</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-muted-foreground flex items-center gap-2 mt-1">
                    <span className="font-medium">Claim #{claim.claim_number}</span>
                    <span>•</span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs">{claim.policy_types?.name}</span>
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Main Content Layout with Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Fixed Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Claim Overview */}
            <Card className="bg-white/95 backdrop-blur-sm border border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Claim Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm">
                  <p className="text-muted-foreground">Amount</p>
                  <p className="font-semibold">
                    {claim.claim_amount ? `Rs. ${Number(claim.claim_amount).toLocaleString()}` : 'Not specified'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Bill of Entry Upload */}
            <SelectiveDocumentExtractor
              claimId={id!}
              policyTypeId={claim.policy_type_id}
              documentLabel="Bill of Entry"
              documentTitle="Bill of Entry"
              documentDescription="Upload your Bill of Entry document (PDF format required for field extraction)"
              onDataExtracted={handleBillOfEntryExtracted}
            />

            {/* Policy Document Upload & Extraction */}
            <SelectiveDocumentExtractor
              claimId={id!}
              policyTypeId={claim.policy_type_id}
              documentLabel="Policy Document"
              documentTitle="Policy Document"
              documentDescription="Upload your policy document (PDF format required for field extraction)"
              onDataExtracted={handlePolicyDocumentExtracted}
            />

          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
              <Card className="bg-white/95 backdrop-blur-sm border border-slate-200 shadow-sm p-2">
                <TabsList className="grid w-full grid-cols-6 bg-slate-100 h-14">
                  <TabsTrigger 
                    value="policy-details" 
                    className="flex items-center space-x-2 data-[state=active]:bg-slate-700 data-[state=active]:text-white transition-all duration-200"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Policy Details</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="additional-info" 
                    className="flex items-center space-x-2 data-[state=active]:bg-slate-600 data-[state=active]:text-white transition-all duration-200"
                  >
                    <Info className="w-4 h-4" />
                    <span>Additional Info</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="report-preview" 
                    className="flex items-center space-x-2 data-[state=active]:bg-slate-800 data-[state=active]:text-white transition-all duration-200"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View Report</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="fee-bill" 
                    className="flex items-center space-x-2 data-[state=active]:bg-green-600 data-[state=active]:text-white transition-all duration-200"
                  >
                    <IndianRupee className="w-4 h-4" />
                    <span>Fee Bill</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="documents" 
                    className="flex items-center space-x-2 data-[state=active]:bg-slate-500 data-[state=active]:text-white transition-all duration-200"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Documents</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="assessment" 
                    className="flex items-center space-x-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all duration-200"
                  >
                    <Info className="w-4 h-4" />
                    <span>Assessment</span>
                  </TabsTrigger>
                </TabsList>
              </Card>

              <TabsContent value="policy-details" className="space-y-6">
                <PolicyDetailsForm claim={claim} />
              </TabsContent>

              <TabsContent value="additional-info" className="space-y-6">
                <AdditionalInformationForm claim={claim} />
              </TabsContent>

              <TabsContent value="report-preview" className="space-y-6">
                <ReportPreview claim={claim} />
              </TabsContent>

              <TabsContent value="fee-bill" className="space-y-6">
                <FeeBillForm claim={claim} />
              </TabsContent>

              <TabsContent value="documents" className="space-y-6">
                <DocumentsTab claimId={claim.id} />
              </TabsContent>
              <TabsContent value="assessment" className="space-y-6">
                <Assessment claim={claim} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};