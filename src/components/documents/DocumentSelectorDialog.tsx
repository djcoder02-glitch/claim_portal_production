import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Document {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  created_at: string;
}

interface DocumentSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claimId: string;
  sectionLabel: string;
  onSelect: (document: Document) => void;
  multiSelect?: boolean;
}

export const DocumentSelectorDialog = ({
  open,
  onOpenChange,
  claimId,
  sectionLabel,
  onSelect,
  multiSelect = false,
}: DocumentSelectorDialogProps) => {
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);

  // Fetch uploaded documents
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['documents-selector', claimId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claim_documents')
        .select('*')
        .eq('claim_id', claimId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      // Filter out placeholders from the selection dialog
      return data?.filter(doc => 
        doc.file_type !== 'placeholder' &&
        !doc.file_name.startsWith('__BATCH_TOKEN_') &&
        !doc.file_name.startsWith('__TOKEN_PLACEHOLDER_')
      ) || [];
    },
    enabled: open,
  });

  const toggleSelection = (docId: string) => {
    if (multiSelect) {
      setSelectedDocs(prev =>
        prev.includes(docId)
          ? prev.filter(id => id !== docId)
          : [...prev, docId]
      );
    } else {
      setSelectedDocs([docId]);
    }
  };

  const handleConfirm = () => {
    const selectedDocument = documents.find(doc => doc.id === selectedDocs[0]);
    if (selectedDocument) {
      onSelect(selectedDocument);
      onOpenChange(false);
      setSelectedDocs([]);
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const colors: Record<string, string> = {
      pdf: 'bg-red-100 text-red-700',
      doc: 'bg-blue-100 text-blue-700',
      docx: 'bg-blue-100 text-blue-700',
      xls: 'bg-green-100 text-green-700',
      xlsx: 'bg-green-100 text-green-700',
      jpg: 'bg-purple-100 text-purple-700',
      jpeg: 'bg-purple-100 text-purple-700',
      png: 'bg-purple-100 text-purple-700',
    };
    return colors[ext || ''] || 'bg-gray-100 text-gray-700';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Document for {sectionLabel}</DialogTitle>
          <DialogDescription>
            Choose a document from your uploaded files
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[60vh] pr-2">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading documents...</div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No documents uploaded yet. Upload documents first.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {documents.map((doc) => (
                <Card
                  key={doc.id}
                  className={`cursor-pointer transition-all ${
                    selectedDocs.includes(doc.id)
                      ? 'ring-2 ring-blue-500 border-blue-500'
                      : 'hover:border-gray-400'
                  }`}
                  onClick={() => toggleSelection(doc.id)}
                >
                  <CardContent className="p-3">
                    <div className="relative">
                      {selectedDocs.includes(doc.id) && (
                        <div className="absolute -top-1 -right-1 bg-blue-500 text-white rounded-full p-1">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                      
                      <div className={`p-3 rounded-lg ${getFileIcon(doc.file_name)} mb-2 flex items-center justify-center`}>
                        <FileText className="w-8 h-8" />
                      </div>
                      
                      <p className="text-xs font-semibold truncate" title={doc.file_name}>
                        {doc.file_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(doc.file_size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedDocs.length === 0}
          >
            Assign Document
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};