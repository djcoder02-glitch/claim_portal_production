import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Upload, 
  Link as LinkIcon, 
  FileText, 
  Copy,
  CheckCircle,
  AlertCircle,
  Loader2, X,
  Plus
} from "lucide-react";
import { UploadedDocumentsGrid } from "./UploadedDocumentsGrid";
import { generateBatchUploadToken } from "@/lib/uploadTokens";
import { uploadDocument, validateFileSize } from "@/lib/uploadDocument";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DocumentSelectorDialog } from "./DocumentSelectorDialog";
import { type Claim } from "@/hooks/useClaims";

interface DocumentsTabProps {
  claim: Claim;
}

interface UploadedDocument {
  id: string;
  file_name: string;
  file_path: string;
  created_at: string;
  file_size: number;
  metadata?: any;
  field_label?: string | null;
}

export const DocumentsTab = ({ claim }: DocumentsTabProps) => {
  const queryClient = useQueryClient();
  const [uploadLink, setUploadLink] = useState<string>("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [viewDocumentUrl, setViewDocumentUrl] = useState<string | null>(null);
  const [selectorOpenFor, setSelectorOpenFor] = useState<string | null>(null);
  const [assignedDocs, setAssignedDocs] = useState<Record<string, { id: string; file_name: string; file_path: string; file_size: number }>>({});
  const [customSections, setCustomSections] = useState<string[]>([]);
  const [newSectionInput, setNewSectionInput] = useState("");


  

  // Fetch uploaded documents
  const { data: uploadedDocuments = [], refetch: refetchDocuments, isLoading } = useQuery<UploadedDocument[]>({
    queryKey: ["claim-documents", claim?.id],
    queryFn: async () => {
      if (!claim?.id) return [];

      console.log('Fetching documents for claim:', claim.id);

      const { data, error } = await supabase
        .from("claim_documents")
        .select("*")
        .eq("claim_id", claim.id)
        .not("file_type", "eq", "placeholder")
        .not("file_name", "like", "__TOKEN_PLACEHOLDER_%")
        .not("file_name", "like", "__BATCH_TOKEN_%")
        .order("created_at", { ascending: false });

      if (error) {
        console.error('Document fetch error:', error);
        throw error;
      }

      console.log('Fetched documents:', data?.length);
      
      return (data || []).map(doc => ({
        id: doc.id,
        file_name: doc.file_name,
        file_path: doc.file_path,
        created_at: doc.created_at || new Date().toISOString(),
        file_size: doc.file_size || 0,
        metadata: doc.metadata as any,
        field_label: doc.field_label,
      }));
    },
    enabled: !!claim?.id,
  });
  

  const { data: requiredDocuments = [] } = useQuery<string[]>({
    queryKey: ["policy-required-docs", claim?.policy_type_id],
    queryFn: async () => {
      if (!claim?.policy_type_id) return [];
      const { data, error } = await supabase
        .from("policy_types")
        .select("required_documents")
        .eq("id", claim.policy_type_id)
        .single();
      if (error) return [];
      return (data?.required_documents as string[]) || [];
    },
    enabled: !!claim?.policy_type_id,
  });

  const { data: claimExtras, refetch: refetchExtras } = useQuery({
    queryKey: ["claim-extras", claim?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("claims")
        .select("custom_doc_sections, doc_assignments")
        .eq("id", claim.id)
        .single();
      if (error) return { custom_doc_sections: [], doc_assignments: {} };
      return data;
    },
    enabled: !!claim?.id,
  });

  const saveCustomSections = async (sections: string[]) => {
    await supabase.from("claims").update({ custom_doc_sections: sections }).eq("id", claim.id);
    refetchExtras();
  };
  const saveAssignment = async (label: string, docId: string) => {
    const current = (claimExtras?.doc_assignments as Record<string, string>) || {};
    const updated = { ...current, [label]: docId };
    await supabase.from("claims").update({ doc_assignments: updated }).eq("id", claim.id);
    refetchExtras();
  };

  const removeAssignment = async (label: string) => {
    const current = (claimExtras?.doc_assignments as Record<string, string>) || {};
    const updated = { ...current };
    delete updated[label];
    await supabase.from("claims").update({ doc_assignments: updated }).eq("id", claim.id);
    refetchExtras();
  };

  useEffect(() => {
    const sections = claimExtras?.custom_doc_sections;
    if (sections && sections.length > 0) {
      setCustomSections(sections as string[]);
    }
  }, [claimExtras]);

  useEffect(() => {
    if (claimExtras?.doc_assignments && uploadedDocuments.length > 0) {
      const assignments = claimExtras.doc_assignments as Record<string, string>;
      const existing: Record<string, { id: string; file_name: string; file_path: string; file_size: number }> = {};
      Object.entries(assignments).forEach(([label, docId]) => {
        const doc = uploadedDocuments.find(d => d.id === docId);
        if (doc) {
          existing[label] = { id: doc.id, file_name: doc.file_name, file_path: doc.file_path, file_size: doc.file_size };
        }
      });
      setAssignedDocs(existing);
    }
  }, [claimExtras, uploadedDocuments]);

  // Generate upload link mutation
  const generateLinkMutation = useMutation({
    mutationFn: async () => {
      if (!claim?.id) throw new Error("Claim ID not available");
      const tokenData = await generateBatchUploadToken(claim.id);
      return tokenData.uploadUrl;
    },
    onSuccess: (url) => {
      setUploadLink(url);
      toast.success("Upload link generated successfully!");
    },
    onError: (error) => {
      console.error("Error generating link:", error);
      toast.error("Failed to generate upload link");
    },
  });

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const { error } = await supabase
        .from("claim_documents")
        .delete()
        .eq("id", documentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["claim-documents", claim?.id] });
      toast.success("Document deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
    },
  });

  // Debug: Log claim data
console.log('DocumentsTab received claim:', claim);
console.log('Claim ID:', claim?.id);

if (!claim) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
        <p className="text-gray-600">Waiting for claim data...</p>
        <p className="text-xs text-gray-400 mt-2">Claim prop is undefined</p>
      </div>
    </div>
  );
}

if (!claim.id) {
  return (
    <div className="flex items-center justify-center h-64 bg-red-50 border-2 border-red-200 rounded">
      <div className="text-center">
        <p className="text-red-600 font-semibold">Error: Claim has no ID</p>
        <p className="text-xs text-gray-600 mt-2">Claim object: {JSON.stringify(claim)}</p>
      </div>
    </div>
  );
}

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="ml-3 text-gray-600">Loading documents...</p>
      </div>
    );
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(uploadLink);
    setLinkCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    const invalidFiles: string[] = [];
    const validFiles: File[] = [];

    files.forEach(file => {
      const validation = validateFileSize(file);
      if (!validation.valid) {
        invalidFiles.push(validation.error!);
      } else {
        validFiles.push(file);
      }
    });

    if (invalidFiles.length > 0) {
      invalidFiles.forEach(error => toast.error(error));
    }

    if (validFiles.length > 0) {
      setSelectedFiles(validFiles);
      setUploadDialogOpen(true);
    }

    e.target.value = '';
  };

  const handleDirectUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      
      if (!userData.user?.id) {
        toast.error("User not authenticated");
        setIsUploading(false);
        return;
      }

      const userName = userData.user.email || "Admin";

      const { data: userProfile } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', userData.user.id)
        .single();

      if (!userProfile?.company_id) {
        toast.error("User has no company");
        setIsUploading(false);
        return;
      }

      for (const file of selectedFiles) {
        try {
          const result = await uploadDocument(
            file,
            claim.id,
            userName,
            userProfile.company_id
          );

          await supabase
            .from("claim_documents")
            .insert({
              claim_id: claim.id,
              company_id: userProfile.company_id,
              file_name: file.name,
              file_path: result.url,
              file_type: file.type,
              file_size: file.size,
              uploaded_by: userData.user.id,
              uploaded_via_link: false,
              is_selected: false,
            });

          toast.success(`${file.name} uploaded successfully`);
        } catch (error) {
          console.error("Upload error:", error);
          toast.error(`Failed to upload ${file.name}`);
        }
      }

      setIsUploading(false);
      setUploadDialogOpen(false);
      setSelectedFiles([]);
      refetchDocuments();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Upload failed");
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Direct Upload
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload documents directly from your computer (max 5MB per file)
              </p>
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
              />
              <Button asChild>
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="w-4 h-4 mr-2" />
                  Choose Files
                </label>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5" />
              Generate Upload Link
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Generate a shareable link for external users to upload documents
            </p>
            <Button
              onClick={() => generateLinkMutation.mutate()}
              disabled={generateLinkMutation.isPending}
            >
              {generateLinkMutation.isPending ? "Generating..." : "Generate Upload Link"}
            </Button>
            {uploadLink && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={uploadLink}
                    readOnly
                    className="flex-1 px-3 py-2 border rounded-md bg-gray-50"
                  />
                  <Button onClick={handleCopyLink} variant="outline" className="gap-2">
                    {linkCopied ? (
                      <><CheckCircle className="w-4 h-4" />Copied!</>
                    ) : (
                      <><Copy className="w-4 h-4" />Copy</>
                    )}
                  </Button>
                </div>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Share this link with external users. Link expires in 7 days.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Uploaded Documents
              <Badge variant="secondary" className="ml-2">{uploadedDocuments.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <UploadedDocumentsGrid
              documents={uploadedDocuments}
              onDelete={(id) => deleteDocumentMutation.mutate(id)}
              onView={(url) => setViewDocumentUrl(url)}
            />
          </CardContent>
        </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Upload Documents
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                These are suggested document types based on your policy type. Upload what you have available.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {requiredDocuments.map((docName, index) => {
                const assigned = assignedDocs[docName];
                return (
                  <div key={index} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{docName}</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setSelectorOpenFor(docName)} className="gap-2">
                        <Upload className="w-4 h-4" />
                        Select Document
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">Upload {docName} document for this claim</p>
                    {assigned ? (
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-red-600" />
                          <span className="text-sm font-medium">{assigned.file_name}</span>
                          <span className="text-xs text-gray-500">{(assigned.file_size / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                        <Button size="sm" variant="ghost" onClick={async () => { await removeAssignment(docName); setAssignedDocs(prev => { const n = {...prev}; delete n[docName]; return n; }); }}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed rounded-lg p-4 text-center">
                        <p className="text-sm text-gray-500">No file chosen</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Supported formats: PDF, DOC, DOCX, JPG, PNG, GIF (Max 10MB per file)
                        </p>
                      </div>
                    )}
                    <DocumentSelectorDialog
                      open={selectorOpenFor === docName}
                      onOpenChange={(open) => !open && setSelectorOpenFor(null)}
                      claimId={claim.id}
                      sectionLabel={docName}
                      onSelect={async (doc) => {
                      await saveAssignment(docName, doc.id);
                      setAssignedDocs(prev => ({ ...prev, [docName]: { id: doc.id, file_name: doc.file_name, file_path: doc.file_path, file_size: doc.file_size } }));
                      setSelectorOpenFor(null);
                      toast.success(`${docName} assigned successfully`);
                      }}  
                    />
                  </div>
                );
              })}
            {customSections.map((docName, index) => {
                const assigned = assignedDocs[docName];
                return (
                  <div key={`custom-${index}`} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{docName}</span>
                        <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                          Custom
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setSelectorOpenFor(docName)} className="gap-2">
                          <Upload className="w-4 h-4" />
                          Select Document
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50"
                          onClick={() => {
                            const updated = customSections.filter((_, i) => i !== index);
                            setCustomSections(updated);
                            saveCustomSections(updated);
                          }}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">Upload {docName} document for this claim</p>
                    {assigned ? (
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-red-600" />
                          <span className="text-sm font-medium">{assigned.file_name}</span>
                          <span className="text-xs text-gray-500">{(assigned.file_size / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                        <Button size="sm" variant="ghost" onClick={async () => { await removeAssignment(docName); setAssignedDocs(prev => { const n = {...prev}; delete n[docName]; return n; }); }}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed rounded-lg p-4 text-center">
                        <p className="text-sm text-gray-500">No file chosen</p>
                        <p className="text-xs text-gray-400 mt-1">Supported formats: PDF, DOC, DOCX, JPG, PNG, GIF (Max 10MB per file)</p>
                      </div>
                    )}
                    <DocumentSelectorDialog
                      open={selectorOpenFor === docName}
                      onOpenChange={(open) => !open && setSelectorOpenFor(null)}
                      claimId={claim.id}
                      sectionLabel={docName}
                      onSelect={async (doc) => {
                        await saveAssignment(docName, doc.id);
                        setAssignedDocs(prev => ({ ...prev, [docName]: { id: doc.id, file_name: doc.file_name, file_path: doc.file_path, file_size: doc.file_size } }));
                        setSelectorOpenFor(null);
                        toast.success(`${docName} assigned successfully`);
                      }}
                    />
                  </div>
                );
              })}

              {/* Add new section */}
              <div className="flex gap-2 pt-2 border-t">
                <input
                  type="text"
                  value={newSectionInput}
                  onChange={(e) => setNewSectionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newSectionInput.trim()) {
                      const updated = [...customSections, newSectionInput.trim()];
                      setCustomSections(updated);
                      saveCustomSections(updated);
                      setNewSectionInput("");
                    }
                  }}
                  placeholder="Add custom document section..."
                  className="flex-1 px-3 py-2 border rounded-md text-sm"
                />
                <Button size="sm" onClick={() => {
                  if (newSectionInput.trim()) {
                    const updated = [...customSections, newSectionInput.trim()];
                    setCustomSections(updated);
                    saveCustomSections(updated);
                    setNewSectionInput("");
                  }
                }}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>

      </div>

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload {selectedFiles.length} File(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <FileText className="w-4 h-4" />
                <span className="flex-1 text-sm">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleDirectUpload} disabled={isUploading}>
                {isUploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewDocumentUrl} onOpenChange={() => setViewDocumentUrl(null)}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Document Viewer</DialogTitle>
          <iframe
            src={viewDocumentUrl || ''}
            className="w-full h-full border-0 pt-10"
            title="Document viewer"
          />
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
};