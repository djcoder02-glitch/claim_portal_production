import { useEffect, useState, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import type { FieldErrors, UseFormSetValue } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useUpdateClaimSilent, type Claim } from "@/hooks/useClaims";
import { useAutosave } from "@/hooks/useAutosave";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, X, Info, Check, Edit, Table } from "lucide-react";
import { SearchableSelect} from "@/components/ui/searchable-select";
import { useFieldOptions, useAddFieldOption } from "@/hooks/useFieldOptions";
import { useFormTemplates, useSaveTemplate, useUpdateTemplate, type DynamicSection, type FormTemplate, type TemplateField, type TableData} from "@/hooks/useFormTemplates";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Save, Plus, Download, Upload, Palette, Trash2 } from "lucide-react";
import { useSectionTemplates, type SectionTemplate } from "@/hooks/useSectionTemplates";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EditableTable, TableModal } from './TableComponents';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const ADDITIONAL_INFO_SECTIONS = [
  {
    id: "basic-information",
    name: "Basic Information",
    order: 1,
    fields: [
      { name: "cha_name", label: "CHA Name" },
      { name: "consignee_name", label: "Consignee Name" },
      { name: "consigner_name", label: "Consigner Name" },
      { name: "underwriter_name", label: "Underwriter Name" },
    ]
  },
  {
    id: "invoice-details",
    name: "Invoice Details",
    order: 2,
    fields: [
      { name: "invoice_no", label: "Invoice No" },
      { name: "invoice_date", label: "Invoice Date" },
      { name: "invoice_value", label: "Invoice Value" },
    ]
  },
  {
    id: "goods-details",
    name: "Goods Details",
    order: 3,
    fields: [
      { name: "invoice_net_wt", label: "Invoice Net Weight" },
      { name: "invoice_gross_wt", label: "Invoice Gross Weight" },
      { name: "invoice_pkg_count", label: "Invoice Package Count" },
    ]
  },
  {
    id: "certificate-details",
    name: "Certificate Details",
    order: 4,
    fields: [
      { name: "certificate_no", label: "Certificate No" },
      { name: "endorsement_no", label: "Endorsement No" },
    ]
  },
  {
    id: "survey-notes",
    name: "Survey Notes",
    order: 5,
    fields: [
      { name: "applicant_survey", label: "Applicant Survey" },
    ]
  }
];

interface AdditionalInformationFormProps {
  claim: Claim;
}

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox';
  required: boolean;
  options?: string[];
  isCustom?: boolean;
  section?: 'section1' | 'section2' | 'section3' | 'section4';
}

interface ImageGridProps {
  sectionKey: string;
  images: string[];
  setImages: (urls: string[]) => void;
  claimId: string;
  claim: Claim;
  claimFormData: Record<string, unknown>;
  updateClaim: ReturnType<typeof useUpdateClaimSilent>;
  customFields: FormField[];
  hiddenFields: Set<string>;
  fieldLabels: Record<string, string>;
  sectionImages: Record<string, string[]>;
  queryClient: ReturnType<typeof useQueryClient>;
  customFieldsRef: React.MutableRefObject<FormField[]>;
  hiddenFieldsRef: React.MutableRefObject<Set<string>>;
  fieldLabelsRef: React.MutableRefObject<Record<string, string>>;
}
// Add color options for sections
const colorOptions = [
  { value: 'bg-gradient-primary', label: 'Blue', class: 'bg-gradient-primary' },
];

const ImageGrid: React.FC<ImageGridProps> = ({ sectionKey, images, setImages, claimId, claim, claimFormData, updateClaim, customFields, hiddenFields, fieldLabels, sectionImages, queryClient, customFieldsRef, hiddenFieldsRef, fieldLabelsRef }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleMultipleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;

    const files = Array.from(e.target.files);
    const availableSlots = 6 - images.filter(Boolean).length;
    
    if (files.length > availableSlots) {
      toast.error(`Can only upload ${availableSlots} more image(s). Maximum 6 images allowed.`);
      return;
    }

    const toastId = toast.loading(`Uploading ${files.length} image(s)...`);

    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("https://mlkkk63swrqairyiahlk357sui0argkn.lambda-url.ap-south-1.on.aws/upload-image", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        return data.url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      
      // Find empty slots and fill them
      const updated = [...images];
      let urlIndex = 0;
      for (let i = 0; i < 6 && urlIndex < uploadedUrls.length; i++) {
        if (!updated[i]) {
          updated[i] = uploadedUrls[urlIndex];
          urlIndex++;
        }
      }
      
      setImages(updated);

      // Save to database
      const tableName = (claim as any).claim_type === 'vas' 
        ? 'vas_reports' 
        : (claim as any).claim_type === 'client' 
          ? 'client_reports' 
          : 'claims';

      const { error: uploadError } = await supabase
        .from(tableName)
        .update({
          sections: {
            ...claimFormData,
            [`${sectionKey}_images`]: updated,
            custom_fields_metadata: customFields,
            hidden_fields: Array.from(hiddenFields),
            field_labels: fieldLabels,
          }
        })
        .eq('id', claimId);

      if (uploadError) throw uploadError;

      toast.success(`${files.length} image(s) uploaded successfully!`, { id: toastId, duration: 2000 });
    } catch (err) {
      console.error("Image upload failed", err);
      toast.error("Image upload failed. Please try again.", { id: toastId, duration: 2500 });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

 const handleRemove = async (index: number) => {
    const toastId = toast.loading("Removing image...");

    try {
      const updated = [...images];
      updated[index] = "";
      setImages(updated);

      const tableName = (claim as any).claim_type === 'vas' 
        ? 'vas_reports' 
        : (claim as any).claim_type === 'client' 
          ? 'client_reports' 
          : 'claims';

      const { error: removeError } = await supabase
        .from(tableName)
        .update({
          sections: {
            ...claimFormData,
            [`${sectionKey}_images`]: updated,
            custom_fields_metadata: customFieldsRef.current,
            hidden_fields: Array.from(hiddenFieldsRef.current),
            field_labels: fieldLabelsRef.current,
          }
        })
        .eq('id', claimId);

      if (removeError) throw removeError;

      // Invalidate query to refresh claim data
      queryClient.invalidateQueries({ queryKey: ["claim", claimId] });

      toast.success("Image removed successfully.", { id: toastId, duration: 2000 });
    } catch (error) {
      console.error("Failed to remove image:", error);
      toast.error("Failed to remove image.", { id: toastId, duration: 2500 });
    }
  };

  const uploadedImages = images.filter(Boolean);
  const remainingSlots = 6 - uploadedImages.length;

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Section Images ({uploadedImages.length}/6)</p>
        {remainingSlots > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Upload Images ({remainingSlots} slots available)
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleMultipleUpload}
      />

      {uploadedImages.length > 0 ? (
        <div className="relative">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {images.map((img, i) => 
              img ? (
                <div
                  key={`${sectionKey}-img-${i}`}
                  className="relative flex-shrink-0 w-40 h-40 rounded-lg border-2 border-gray-200 overflow-hidden group cursor-pointer"
                  onClick={() => {
                    console.log('Image clicked:', img);
                    setSelectedImage(img);
                  }}
                >
                  <img
                    src={img}
                    alt={`Upload ${i + 1}`}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(i);
                    }}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"
                    title="Remove image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : null
            )}
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <Upload className="w-10 h-10 text-gray-400" />
            <p className="text-sm text-gray-500">No images uploaded yet</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload Images
            </Button>
          </div>
        </div>
      )}

      {/* Image Preview Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/15 backdrop-blur-sm border-2 border-[#ccc] rounded-lg">
          <div className="relative w-full h-[95vh] flex items-center justify-center p-4">
            <img
              src={selectedImage || ''}
              alt="Enlarged view"
              className="max-w-full max-h-full object-contain"
            />
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 bg-white/90 hover:bg-white text-gray-800 rounded-full p-2 shadow-lg transition-colors"
              title="Close"
            >
              
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export const AdditionalInformationForm = ({ claim }: AdditionalInformationFormProps) => {
  const updateClaimMutation = useUpdateClaimSilent();
    const queryClient = useQueryClient();
    const customFieldsRef = useRef<FormField[]>([]);
const hiddenFieldsRef = useRef<Set<string>>(new Set());
const fieldLabelsRef = useRef<Record<string, string>>({});
    
  const { register, handleSubmit, formState: { errors }, setValue, watch, reset, control } = useForm({
    defaultValues: claim.sections || {}
    
  });

  const addFieldOptionMutation = useAddFieldOption();
  const [selectedTemplate, setSelectedTemplate] = useState<SectionTemplate | null>(null);
  const { data: sectionTemplates = [], isLoading: templatesLoading } = useSectionTemplates(claim.policy_type_id);
  
  const handleCreateFieldOption = async (fieldName: string, newValue: string) : Promise<void> => {
    await addFieldOptionMutation.mutateAsync({ fieldName, optionValue: newValue });
  };

  const [activeTab, setActiveTab] = useState<string>("template");
  const [showTableModal, setShowTableModal] = useState(false);
  const [selectedSectionForTable, setSelectedSectionForTable] = useState<string>('');
  const [currentTableSectionId, setCurrentTableSectionId] = useState<string | null>(null);
  const saveTemplateMutation = useSaveTemplate();
  const updateTemplateMutation = useUpdateTemplate();
  // State for collapsible sections
  const [openSections, setOpenSections] = useState<Record<string,boolean>>({
    section1: true,
    section2: false,
    section3: false,
    section4: false,
  });

  const [sectionEditMode, setSectionEditMode] = useState<Record<string, boolean>>({
    section1: false,
    section2: false,
    section3: false,
    section4: false,
  });

  const [sectionImages, setSectionImages] = useState<Record<string, string[]>>({});

  // Add these new state variables
  const [dynamicSections, setDynamicSections] = useState<DynamicSection[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<FormTemplate | null>(null);
  const [isTemplateModified, setIsTemplateModified] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showNewSectionDialog, setShowNewSectionDialog] = useState(false);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionColor, setNewSectionColor] = useState('bg-slate-400');
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const initialTemplateState = useRef<{
    sections: any;
    customFields: any;
    hiddenFields: any;
  } | null>(null);
  //Section editing states
  const [editingSection, setEditingSection]= useState <string |null>(null);
  
  // State for managing custom fields and hidden fields
  const [customFields, setCustomFields] = useState<FormField[]>([]);
  const [hiddenFields, setHiddenFields] = useState<Set<string>>(new Set());
  const [pendingSaves, setPendingSaves] = useState<Set<string>>(new Set());
  const [fieldLabels, setFieldLabels] = useState<Record<string, string>>({});
  const [editingLabels, setEditingLabels] = useState<Set<string>>(new Set());

  const { data: templates = [] } = useFormTemplates(claim.policy_type_id);
  

  // Load custom fields from sections on mount
  // Remove the old useEffect with watch and replace with this:
useEffect(() => {
  if (!currentTemplate) {
    setIsTemplateModified(false);
  }
}, [currentTemplate]);
// Update refs whenever state changes
useEffect(() => {
  customFieldsRef.current = customFields;
  hiddenFieldsRef.current = hiddenFields;
  fieldLabelsRef.current = fieldLabels;
}, [customFields, hiddenFields, fieldLabels]);

// Load saved data including custom fields and hidden fields
useEffect(() => {
  if (!claim?.sections) return;

  const savedCustomFields = (claim.sections?.custom_fields_metadata || []) as FormField[];
  const savedHiddenFieldsArray = Array.isArray(claim.sections?.hidden_fields) ? (claim.sections!.hidden_fields as string[]) : [];
  const savedHiddenFields = new Set<string>(savedHiddenFieldsArray);
  const savedFieldLabels = (claim.sections?.field_labels || {}) as Record<string, string>;

  // Filter out hidden fields when loading
  const visibleCustomFields = savedCustomFields.filter(field => !savedHiddenFields.has(field.name));

  setCustomFields(visibleCustomFields);
  setHiddenFields(savedHiddenFields);
  setFieldLabels(savedFieldLabels);

  // Load section images
  const images: Record<string, string[]> = {};
  Object.entries(claim.sections).forEach(([key, value]) => {
    if (key.endsWith('_images') && Array.isArray(value)) {
      images[key.replace('_images', '')] = value;
    }
  });
  setSectionImages(images);

  // Load form field values, skipping hidden fields
  Object.entries(claim.sections).forEach(([key, value]) => {
    if (savedHiddenFields.has(key)) {
      return; // Skip hidden fields
    }
    
    if (!key.endsWith('_metadata') && 
        !key.endsWith('_images') && 
        !key.includes('hidden_fields') && 
        !key.includes('field_labels')) {
      setValue(key, value);
    }
  });
}, [claim.id, setValue]);

  //autosave handler
  const handleAutosave = useCallback(async (data: Record<string, unknown>) => {
  const standardData = Object.fromEntries(
    Object.entries(data).filter(([k]) => !k.startsWith("custom_"))
  );

  const tableName = (claim as any).claim_type === 'vas' 
    ? 'vas_reports' 
    : (claim as any).claim_type === 'client' 
      ? 'client_reports' 
      : 'claims';

  console.log('💾 Autosave to table:', tableName, 'claim_type:', claim.claim_type);

  const { error } = await supabase
    .from(tableName)
    .update({
      sections: {
        ...standardData,
        custom_fields_metadata: customFieldsRef.current,
        hidden_fields: Array.from(hiddenFieldsRef.current),
        field_labels: fieldLabelsRef.current,
        additional_info_sections: ADDITIONAL_INFO_SECTIONS,
      } as any
    })
    .eq('id', claim.id);

  if (error) {
    console.error('❌ Autosave error:', error);
    throw error;
  }

  queryClient.invalidateQueries({ queryKey: ["claim", claim.id] });

  console.log('✅ Autosave completed');
}, [claim.id, claim.claim_type]);

  useAutosave({
    control,
    onSave: handleAutosave,
    delay: 1500,
    enabled: true,
  });

  const toggleSection = (section : string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      reset(claim.sections || {});
    }
  }, [claim.id]); // Don't depend on claim.sections to prevent reset on every change

  const onSubmit = async (data: Record<string, unknown>) => {
  console.log('🔥 onSubmit called with data:', data);
  
  try {
    console.log('🔍 Current dynamicSections:', dynamicSections);

      const pendingFieldNames = Array.from(pendingSaves);
      if (pendingFieldNames.length > 0) {
        for (const fieldName of pendingFieldNames) {
          await saveCustomField(fieldName);
        }
      }

      const standardData = Object.fromEntries(
        Object.entries(data).filter(([k]) => !k.startsWith("custom_"))
      );
      const existingCustomEntries = Object.fromEntries(
        Object.entries(claim.sections || {}).filter(([k]) => k.startsWith("custom_"))
      );

      const imagesData: Record<string, string[]> = {};
      Object.entries(sectionImages).forEach(([sectionKey, images]) => {
        imagesData[`${sectionKey}_images`] = images;
      });

      const dataWithMetadata = {
        ...standardData,
        custom_fields_metadata: customFields,  // Current custom fields from state
        hidden_fields: Array.from(hiddenFields),
        field_labels: fieldLabels,
        additional_info_sections: ADDITIONAL_INFO_SECTIONS,
        current_template_name: currentTemplate?.name, // ADD THIS LINE
        is_template_modified: isTemplateModified, // ADD THIS LINE
        dynamic_sections_metadata: JSON.parse(JSON.stringify( dynamicSections.map(section => {
  // Merge custom fields that belong to this section into section.fields
          const sectionCustomFields = customFields
            .filter(f => f.section === section.id)
            .map(field => ({
              id: field.name,
              name: field.name,
              label: fieldLabels[field.name] || field.label,
              type: field.type as TemplateField['type'],
              required: field.required,
              options: field.options,
              order_index: (section.fields?.length || 0) + 1
            }));
          
          // Combine existing fields with custom fields, avoiding duplicates
          const existingFieldNames = new Set(section.fields.map(f => f.name));
          const newCustomFields = sectionCustomFields.filter(f => !existingFieldNames.has(f.name));
          
            return {
              ...section,
              fields: [...section.fields, ...newCustomFields],
              tables: section.tables || []
            };
          })
        )),
        ...existingCustomEntries,  // ← Move this AFTER to preserve old custom field VALUES
        ...imagesData, 
      };

      console.log('💾 Data being saved:', dataWithMetadata);
      console.log('📦 dynamic_sections_metadata:', dataWithMetadata.dynamic_sections_metadata);

      // CRITICAL: Detect table type using service_id/company_id
      const tableName = (claim as any).claim_type === 'vas' 
  ? 'vas_reports' 
  : (claim as any).claim_type === 'client' 
    ? 'client_reports' 
    : 'claims';
      
      console.log('💾 Saving to table:', tableName);

      const { error } = await supabase
        .from(tableName)  // ← Use dynamic tableName
        .update({ sections: dataWithMetadata })
        .eq('id', claim.id);

      if (error) {
        console.error('❌ Save error:', error);
        toast.error(`Failed to save: ${error.message}`);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["claim", claim.id] });
      console.log('✅ Save completed');
      toast.success("Additional information saved successfully!");

    } catch (error) {
      console.error("Failed to update claim:", error);
      toast.error("Failed to update additional information");
    }
  };

  const addCustomField = (sectionKey: string) => {
    const newField: FormField = {
      name: `custom_${Date.now()}`,
      label: 'New Field',
      type: 'text',
      required: false,
      isCustom: true,
      section: sectionKey as FormField['section'],
    };
    setCustomFields(prev => [...prev, newField]);
    setPendingSaves(prev => new Set([...prev, newField.name]));
    setIsTemplateModified(true); // MARK AS MODIFIED
  };


  const saveCustomField = async (fieldName: string) => {
    try {
      const fieldValue = watch(fieldName);
      const existingData = claim.sections || {};
      const dataWithMetadata = {
        ...existingData,
        [fieldName]: fieldValue,
        custom_fields_metadata: customFields,
        hidden_fields: Array.from(hiddenFields),
        field_labels: fieldLabels,
        additional_info_sections: ADDITIONAL_INFO_SECTIONS,
      };
      
      // CRITICAL: Detect table type using service_id/company_id
      const tableName = (claim as any).claim_type=== 'vas' 
  ? 'vas_reports' 
  : (claim as any).claim_type === 'client' 
    ? 'client_reports' 
    : 'claims';

      console.log('💾 Saving custom field to table:', tableName);

      const { error } = await supabase
        .from(tableName)
        .update({ sections: dataWithMetadata })
        .eq('id', claim.id);

      if (error) {
        console.error('❌ Save error:', error);
        toast.error(`Failed to save: ${error.message}`);
        return;
      }
      
      setPendingSaves(prev => {
        const newSet = new Set(prev);
        newSet.delete(fieldName);
        return newSet;
      });
      queryClient.invalidateQueries({ queryKey: ["claim", claim.id] });
      toast.success("Field saved successfully!", {
        duration: 2000,
      });
    } catch (error) {
      console.error('Failed to save custom field:', error);
      toast.error("Failed to save field", {
        duration: 2000,
      });
    }
  };
  // const saveFieldLabel = async (fieldName: string) => {
  //   try {
  //     const existingData = claim.sections
  //     const updatedLabels = { ...(typeof existingData.field_labels === "object" && existingData.field_labels !== null ? existingData.field_labels : {}), ...fieldLabels };
  //     await updateClaimMutation.mutateAsync({
  //       id: claim.id,
  //       updates: {
  //         sections: {
  //           ...existingData,
  //           field_labels: updatedLabels,
  //           custom_fields_metadata: customFields as unknown[],
  //           hidden_fields: Array.from(hiddenFields),
  //         } as any,
  //         // intimation_date: ""
  //       },
  //     });
  //     setEditingLabels(prev => {
  //       const next = new Set(prev);
  //       next.delete(fieldName);
  //       return next;
  //     });
  //     toast.success("Label updated", { duration: 1500 });
  //   } catch (err) {
  //     console.error("Failed to save label", err);
  //     toast.error("Failed to save label", { duration: 1500 });
  //   }
  // };

  const saveFieldLabel = async (fieldName: string) => {
  try {
    const existingData = claim.sections || {};
    const updatedLabels = { ...(typeof existingData.field_labels === "object" && existingData.field_labels !== null ? existingData.field_labels : {}), ...fieldLabels };
    
    // Update dynamic sections metadata with the new label
    const updatedSections = dynamicSections.map(section => ({
      ...section,
      fields: section.fields.map(field => 
        field.name === fieldName 
          ? { ...field, label: fieldLabels[fieldName] || field.label } as TemplateField
          : field
      )
    }));
    
    // CRITICAL: Detect table type using service_id/company_id
    const tableName = (claim as any).claim_type === 'vas' 
  ? 'vas_reports' 
  : (claim as any).claim_type === 'client' 
    ? 'client_reports' 
    : 'claims';
    console.log('💾 Saving label to table:', tableName);

    const { error } = await supabase
      .from(tableName)
      .update({
        sections: {
          ...existingData,
          field_labels: updatedLabels,
          additional_info_sections: ADDITIONAL_INFO_SECTIONS,
          custom_fields_metadata: customFields as unknown[],
          hidden_fields: Array.from(hiddenFields),
          dynamic_sections_metadata: updatedSections,
        }
      })
      .eq('id', claim.id);
    
    if (error) {
      console.error('❌ Save label error:', error);
      throw error;
    }
    
    setEditingLabels(prev => {
      const next = new Set(prev);
      next.delete(fieldName);
      return next;
    });
    toast.success("Label updated", { duration: 1500 });
  } catch (err) {
    console.error("Failed to save label", err);
    toast.error("Failed to save label", { duration: 1500 });
  }
};

  const removeField = async (fieldName: string) => {
  const updatedHiddenFields = new Set([...hiddenFields, fieldName]);
  setHiddenFields(updatedHiddenFields);
  setIsTemplateModified(true);
  
  try {
    const currentFormData = watch();
    const dataWithMetadata = {
      ...currentFormData,
      custom_fields_metadata: customFields,
      additional_info_sections: ADDITIONAL_INFO_SECTIONS,
      hidden_fields: Array.from(updatedHiddenFields),
    };
    
    // CRITICAL: Detect table type using service_id/company_id
    const tableName =(claim as any).claim_type === 'vas' 
  ? 'vas_reports' 
  : (claim as any).claim_type === 'client' 
    ? 'client_reports' 
    : 'claims';

    console.log('💾 Removing field from table:', tableName);

    const { error } = await supabase
      .from(tableName)
      .update({ sections: dataWithMetadata })
      .eq('id', claim.id);
    
    if (error) {
      console.error('❌ Remove field error:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to save field removal:', error);
  }
};

  const removeCustomField = (fieldName: string) => {
    setCustomFields(prev => prev.filter(field => field.name !== fieldName));
    setValue(fieldName, undefined);
    setPendingSaves(prev => {
      const newSet = new Set(prev);
      newSet.delete(fieldName);
      return newSet;
    });
    setIsTemplateModified(true);
  };

  // const updateCustomField = (fieldName: string, updates: Partial<FormField>) => {
  //   setCustomFields(prev => prev.map(field => 
  //     field.name === fieldName ? { ...field, ...updates } : field
  //   ));
  //   if (updates.label === undefined) {
  //     setPendingSaves(prev => new Set([...prev, fieldName]));
  //   }
  // };

 const updateCustomField = (fieldName: string, updates: Partial<FormField>) => {
  // If name is being changed, we need to handle the rename
  if (updates.name && updates.name !== fieldName) {
    const oldName = fieldName;
    const newName = updates.name;
    
    // Update custom fields metadata
    setCustomFields(prev => prev.map(field => 
      field.name === oldName ? { ...field, ...updates } : field
    ));
    
    // Update dynamic sections metadata - find and update the field in sections
    setDynamicSections(prev => prev.map(section => ({
      ...section,
      fields: section.fields.map(field => 
        field.name === oldName 
          ? { ...field, name: newName, label: updates.label || field.label }
          : field
      )
    })));

    console.log("Renaming field from", oldName, "to", newName);
    
    // Copy the value from old field to new field
    const currentValue = watch(oldName);
    setValue(newName, currentValue);
    setValue(oldName, undefined);
    
    // Update field labels
    setFieldLabels(prev => {
      const newLabels = { ...prev };
      if (prev[oldName]) {
        newLabels[newName] = prev[oldName];
        delete newLabels[oldName];
      }
      return newLabels;
    });
    
    // Mark for save
    setPendingSaves(prev => new Set([...prev, newName]));
    setIsTemplateModified(true);
    // Immediately save the renamed field
    setTimeout(async () => {
      try {
        const fieldValue = watch(newName);
        const existingData = claim.sections || {};
        const dataWithMetadata = {
          ...existingData,
          [newName]: fieldValue,
          custom_fields_metadata: customFields.map(f => 
            f.name === oldName ? { ...f, name: newName } : f
          ),
          hidden_fields: Array.from(hiddenFields),
          field_labels: fieldLabels,
        };
        
        const tableName = (claim as any).claim_type === 'vas' 
  ? 'vas_reports' 
  :(claim as any).claim_type === 'client' 
    ? 'client_reports' 
    : 'claims';

        const { error } = await supabase
          .from(tableName)
          .update({ sections: dataWithMetadata })
          .eq('id', claim.id);

        if (error) throw error;
        
        setPendingSaves(prev => {
          const newSet = new Set(prev);
          newSet.delete(newName);
          return newSet;
        });
        
        toast.success("Field renamed successfully!", { duration: 2000 });
      } catch (error) {
        console.error('Failed to save renamed field:', error);
        toast.error("Failed to save field rename", { duration: 2000 });
      }
    }, 100);
  } else if (updates.label) {
    // If only label is being changed, update it in dynamic sections too
    setCustomFields(prev => prev.map(field => 
      field.name === fieldName ? { ...field, ...updates } : field
    ));
    
    setDynamicSections(prev => prev.map(section => ({
      ...section,
      fields: section.fields.map(field => 
        field.name === fieldName 
          ? { ...field, label: updates.label! }
          : field
      )
    })));

    console.log("Updating label for", fieldName, "to", updates.label);
    
    setPendingSaves(prev => new Set([...prev, fieldName]));
  } else {
    // Normal update (label, type, etc.)
    setCustomFields(prev => prev.map(field => 
      field.name === fieldName ? { ...field, ...updates } : field
    ));
    if (updates.label === undefined) {
      setPendingSaves(prev => new Set([...prev, fieldName]));
    }
  }
};

  const toggleSectionEdit = (sectionKey: string) => {
    if (editingSection === sectionKey) {
      setEditingSection(null);
      setSectionEditMode(prev => ({
        ...prev,
        [sectionKey]: false
      }));
    } else {
      setEditingSection(sectionKey);
      setSectionEditMode({
        section1: false,
        section2: false,
        section3: false,
        section4: false,
        [sectionKey]: true
      });
    }
  };

  // Additional details fields based on policy type - MOVED HERE
  const getAdditionalDetailsFields = () => {
    const policyTypeName = claim.policy_types?.name?.toLowerCase() || '';
    
    const commonFields = [
      { name: 'consigner_name', label: 'Name of Consigner of Goods (Exporter)', type: 'text' as const, required: false },
      { name: 'consignee_name', label: 'Name of Consignee of Goods (Importer)', type: 'text' as const, required: false },
      { name: 'applicant_survey', label: 'Applicant of Survey', type: 'text' as const, required: false },
      { name: 'underwriter_name', label: 'Name of Underwriter / Insurer', type: 'text' as const, required: false },
      { name: 'cha_name', label: 'Name of CHA / Clearing Agent / Forwarder', type: 'text' as const, required: false },
      { name: 'certificate_no', label: 'Certificate No (if Applicable)', type: 'text' as const, required: false },
      { name: 'endorsement_no', label: 'Endorsement No (if Any)', type: 'text' as const, required: false },
      { name: 'invoice_no', label: 'Invoice Details Invoice No', type: 'text' as const, required: false },
      { name: 'invoice_date', label: 'Invoice Details Invoice Date', type: 'date' as const, required: false },
      { name: 'invoice_value', label: 'Invoice Details Invoice Value', type: 'number' as const, required: false },
      { name: 'invoice_pkg_count', label: 'Invoice Details No of PKG', type: 'number' as const, required: false },
      { name: 'invoice_gross_wt', label: 'Invoice Details Gross WT', type: 'text' as const, required: false },
      { name: 'invoice_net_wt', label: 'Invoice Details Net WT', type: 'text' as const, required: false },
      { name: 'goods_description', label: 'Description of Goods', type: 'textarea' as const, required: false },
      { name: 'intimation_date', label: 'Date of Intimation of Survey', type: 'date' as const, required: false },
      { name: 'survey_date_place', label: 'Date and Place of Survey', type: 'textarea' as const, required: false },
      { name: 'external_condition_review', label: 'External Condition Upon Reviewing the Consignment as per Consignee', type: 'textarea' as const, required: false },
      { name: 'packing_nature', label: 'Nature of Packing', type: 'textarea' as const, required: false },
      { name: 'packing_condition', label: 'External Condition of Packing at the Time of Survey', type: 'textarea' as const, required: false },
      { name: 'damage_description', label: 'Description of Loss / Damage', type: 'textarea' as const, required: false },
      { name: 'loss_cause', label: 'Cause of Loss', type: 'textarea' as const, required: false },
      { name: 'joint_survey', label: 'Was Any Joint Survey Held', type: 'textarea' as const, required: false },
      { name: 'consignee_notice', label: 'Has Consignee Given Notice of Loss / Damage to or Made Claim Against Carriers?', type: 'textarea' as const, required: false },
      { name: 'transporter_name', label: 'Name of the Transporter', type: 'text' as const, required: false },
      { name: 'vehicle_number', label: 'Vehicle Number', type: 'text' as const, required: false },
      { name: 'lr_date_issuance', label: 'LR & Date of Issuance', type: 'text' as const, required: false },
      { name: 'consignment_note', label: 'Consignment Note No / Docket No & Date', type: 'text' as const, required: false },
      { name: 'delivery_challan', label: 'Delivery Challan No', type: 'text' as const, required: false },
      { name: 'dispatch_condition', label: 'External Condition While Dispatching the Consignment from Port / CFS / Warehouse', type: 'textarea' as const, required: false },
      { name: 'survey_address', label: 'Address of Survey', type: 'textarea' as const, required: false },
      { name: 'number_packages', label: 'Number of Packages', type: 'select' as const, required: false, options: ['BULK/RM', '1-10', '11-50', '51-100', '100+'] },
      { name: 'packing_contents', label: 'Whats Inside Packing Consignment', type: 'textarea' as const, required: false },
      { name: 'content_industry_use', label: 'Use of Content Industry it is Utilised in', type: 'select' as const, required: false, options: ['Manufacturing', 'Construction', 'Electronics', 'Textiles', 'Automotive', 'Food Processing', 'Other'] },
      { name: 'arrival_details', label: 'How Did it Arrive to the Premises Spot of Survey Mention Container No and or Vehicle No if Applicable', type: 'select' as const, required: false, options: ['By Road Transport', 'By Sea Container', 'By Air Cargo', 'By Rail', 'Other'] },
      { name: 'external_condition_tag', label: 'External Condition Tag', type: 'textarea' as const, required: false },
    ];

    if (policyTypeName.includes('marine') || policyTypeName.includes('cargo')) {
      return [
        ...commonFields,
        { name: 'vessel_name', label: 'Vessel Name', type: 'text' as const, required: false },
        { name: 'port_loading', label: 'Port of Loading', type: 'text' as const, required: false },
        { name: 'port_discharge', label: 'Port of Discharge', type: 'text' as const, required: false },
        { name: 'bl_number', label: 'Bill of Lading Number', type: 'text' as const, required: false },
      ];
    }

    if (policyTypeName.includes('fire') || policyTypeName.includes('property')) {
      return [
        ...commonFields,
        { name: 'building_type', label: 'Building Type', type: 'select' as const, required: false, options: ['Residential', 'Commercial', 'Industrial', 'Warehouse'] },
        { name: 'fire_brigade_called', label: 'Was Fire Brigade Called?', type: 'select' as const, required: false, options: ['Yes', 'No'] },
        { name: 'sprinkler_system', label: 'Sprinkler System Present?', type: 'select' as const, required: false, options: ['Yes', 'No'] },
      ];
    }

    return commonFields;
  };

  const addNewSection = () => {
    if (!newSectionName.trim()) return;
    
    const newSection: DynamicSection = {
      id: `custom_${Date.now()}`,
      name: newSectionName,
      order_index: dynamicSections.length + 1,
      color_class: newSectionColor,
      fields: [],
      isCustom: true
    };
    
    setDynamicSections([...dynamicSections, newSection]);

    setNewSectionName('');
    setNewSectionColor('bg-slate-400');
    setShowNewSectionDialog(false);
    toast.success(`Section "${newSectionName}" added!`);
  };

  const createSectionFromTemplate = () => {
  if (!selectedTemplate) {
    toast.error("Please select a template");
    return;
  }
  
  const sectionName = newSectionName.trim() || selectedTemplate.name;
  
  const newSection: DynamicSection = {
    id: `custom_${Date.now()}`,
    name: sectionName,
    order_index: dynamicSections.length + 1,
    color_class: selectedTemplate.color_class,
    fields: selectedTemplate.preset_fields.map((field) => ({
      id: `${field.name}_${Date.now()}`,
      name: field.name,
      label: field.label,
      type: field.type as TemplateField['type'],
      required: field.required,
      options: field.options,
      order_index: field.order_index
    })),
    isCustom: true
  };
  
  setDynamicSections([...dynamicSections, newSection]);
  setIsTemplateModified(true); // MARK AS MODIFIED
  setShowNewSectionDialog(false);
  setSelectedTemplate(null);
  setNewSectionName('');
  toast.success(`Section "${sectionName}" created with ${newSection.fields.length} fields!`);
};

  const removeSection = (sectionId: string) => {
    setDynamicSections(prev => prev.filter(section => section.id !== sectionId));
    setIsTemplateModified(true); // MARK AS MODIFIED
    toast.success("Section removed");
  };

  const addFieldToSection = (sectionId: string) => {
    const newField: FormField = {
      name: `custom_${Date.now()}`,
      label: 'New Field',
      type: 'text',
      required: false,
      isCustom: true,
      section: sectionId as FormField['section'],
      
    };
    
    setCustomFields(prev => [...prev, newField]);
    setPendingSaves(prev => new Set([...prev, newField.name]));
    setIsTemplateModified(true); 
  }
  const addTableToSection = async (sectionId: string, rows: number, cols: number, name: string) => {
  const newTable: TableData = {
    id: `table-${Date.now()}`,
    name,
    data: Array(rows).fill(null).map(() => 
      Array(cols).fill(null).map(() => ({ value: '' }))
    ),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  const updatedSections = dynamicSections.map(section =>
    section.id === sectionId
      ? { ...section, tables: [...(section.tables || []), newTable] }
      : section
  );
  
  setDynamicSections(updatedSections);
  setIsTemplateModified(true);
  
  // Save to database immediately
  try {
    await updateClaimMutation.mutateAsync({
      id: claim.id,
      updates: {
        sections: {
          ...claim.sections,
          dynamic_sections_metadata: updatedSections,
        } as any,
      },
    });
    toast.success(`Table "${name}" created successfully`);
  } catch (error) {
    console.error('Failed to save new table:', error);
    toast.error('Failed to create table');
  }
  
  setShowTableModal(false);
};

  const updateTableData = async (sectionId: string, tableId: string, newData: Array<Array<{ value: string }>>) => {
  // Update local state first
  const updatedSections = dynamicSections.map(section =>
    section.id === sectionId
      ? {
          ...section,
          tables: (section.tables || []).map(table =>
            table.id === tableId 
              ? { ...table, data: newData, updatedAt: new Date().toISOString() } 
              : table
          )
        }
      : section
  );
  
  setDynamicSections(updatedSections);
  
  // Save to database
  try {
    await updateClaimMutation.mutateAsync({
      id: claim.id,
      updates: {
        sections: {
          ...claim.sections,
          dynamic_sections_metadata: updatedSections,
        } as any,
      },
    });
  } catch (error) {
    console.error('Failed to save table update:', error);
    toast.error('Failed to save table changes');
  }
};

  const updateTableName = (sectionId: string, tableId: string, newName: string) => {
    setDynamicSections(prev =>
      prev.map(section =>
        section.id === sectionId
          ? {
              ...section,
              tables: (section.tables || []).map(table =>
                table.id === tableId ? { ...table, name: newName } : table
              ),
            }
          : section
      )
    );
  };

  const deleteTable = (sectionId: string, tableId: string) => {
    setDynamicSections(prev =>
      prev.map(section =>
        section.id === sectionId
          ? { ...section, tables: (section.tables || []).filter(t => t.id !== tableId) }
          : section
      )
    );

    toast.success('Table deleted');
    setIsTemplateModified(true);
  };
const saveAsTemplate = async () => {
  if (!templateName.trim()) {
    toast.error("Please enter a template name");
    return;
  }
  
  // Check if a template with this name already exists
  const existingTemplate = templates.find(t => t.name === templateName);
  
  try {
    const sectionsWithCustomFields = (dynamicSections || []).map(section => {
      const sectionCustomFields = (customFields || []).filter(f => f.section === section.id);
      
      const customTemplateFields: TemplateField[] = sectionCustomFields.map((field, index) => ({
        id: field.name,
        name: field.name,
        label: fieldLabels[field.name] || field.label,
        type: field.type as TemplateField['type'],
        required: field.required,
        options: field.options,
        order_index: (section.fields?.length || 0) + index + 1
      }));
      
      const updatedFields = (section.fields || [])
        .filter(field => !hiddenFields.has(field.name))
        .map(field => ({
          ...field,
          label: fieldLabels[field.name] || field.label
        }));
      
      return {
        ...section,
        fields: [...updatedFields, ...customTemplateFields.filter(f => !hiddenFields.has(f.name))],
        tables: section.tables || []
      };
    });
    
    // Prevent overwriting the DEFAULT template
    if (existingTemplate && existingTemplate.is_default) {
      toast.error("Cannot overwrite the DEFAULT template. Please save with a different name.");
      return;
    }
    
    // If replacing a non-default template, delete the old one first
    if (existingTemplate) {
      await supabase
        .from('form_templates')
        .delete()
        .eq('id', existingTemplate.id);
      
      console.log('🗑️ Deleted existing template:', existingTemplate.id);
    }
    
    // Create new template
    const savedTemplate = await saveTemplateMutation.mutateAsync({
      name: templateName,
      description: templateDescription,
      policyTypeId: claim.policy_type_id,
      sections: sectionsWithCustomFields,
    });
    
    setCurrentTemplate({
      id: savedTemplate.id,
      name: templateName,
      description: templateDescription,
      policy_type_id: claim.policy_type_id,
      is_default: false,
      created_at: savedTemplate.created_at || new Date().toISOString(),
      sections: sectionsWithCustomFields as any
    });
    
    setTemplateName('');
    setTemplateDescription('');
    setIsTemplateModified(false);
    setShowSaveTemplateDialog(false);
    
    // Update the initial template state ref
    initialTemplateState.current = {
      sections: JSON.parse(JSON.stringify(dynamicSections)),
      customFields: JSON.parse(JSON.stringify(customFields)),
      hiddenFields: new Set(hiddenFields)
    };
    
    toast.success(existingTemplate ? "Template replaced successfully!" : "Template saved successfully!");
  } catch (error) {
    console.error('Failed to save template:', error);
    toast.error("Failed to save template. Please try again.");
  }
};


const loadTemplate = (template: FormTemplate) => {
  const convertedSections: DynamicSection[] = (template.sections || []).map(section => ({
    id: section.id,
    name: section.name,
    order_index: section.order_index,
    color_class: section.color_class,
    fields: section.fields || [],
    tables: (section.tables || []).map(table => ({
      ...table,
      // Reset table data to empty cells while keeping structure
      data: Array(table.data.length).fill(null).map(() => 
        Array(table.data[0]?.length || 5).fill(null).map(() => ({ value: '' }))
      ),
      updatedAt: new Date().toISOString()
    })),
    isCustom: !section.name.startsWith('Section ')
  }));
  
  // Extract ONLY truly custom fields (not in section.fields) and field labels
  const loadedCustomFields: FormField[] = [];
  const loadedFieldLabels: Record<string, string> = {};
  
  // Collect all field names that are already in section.fields
  const sectionFieldNames = new Set<string>();
  template.sections.forEach(section => {
    section.fields.forEach(field => {
      sectionFieldNames.add(field.name);
      loadedFieldLabels[field.name] = field.label;
    });
  });
  
  // Note: We don't add anything to loadedCustomFields because all fields are already in section.fields
  // Custom fields will only come from user adding new fields after loading the template
  
  setDynamicSections(convertedSections);
  setCustomFields([]); // Start with empty custom fields - they're all in section.fields now
  setFieldLabels(loadedFieldLabels);
    setPendingSaves(new Set());  // ← ADD THIS LINE

  
  // Preserve existing form data
  Object.entries(claim.sections || {}).forEach(([key, value]) => {
    if (!key.endsWith('_metadata') && 
        !key.endsWith('_images') && 
        !key.includes('hidden_fields') && 
        !key.includes('field_labels')) {
      setValue(key, value);
    } 
  });
  
  setCurrentTemplate(template);
  setIsTemplateModified(false);
  setShowTemplateDialog(false);
  toast.success(`Template "${template.name}" loaded! Your existing data has been preserved.`);
};


  // Initialize dynamic sections from existing structure
  useEffect(() => {
    // GUARD: Don't reinitialize if sections already loaded
    if (dynamicSections.length > 0) {
      console.log('⏭️ Skipping initialization - sections already loaded');
      return;
    }
    
    // Check if we have saved sections in the claim data
    const savedDynamicSections = claim.sections?.dynamic_sections_metadata as DynamicSection[] | undefined;
    console.log('🔄 Initializing dynamic sections from claim data:', savedDynamicSections);
    
    if (savedDynamicSections && savedDynamicSections.length > 0) {
      // Load saved sections
      console.log('✅ Loading saved sections from claim data');
      setDynamicSections(savedDynamicSections);
      
      // Restore template state from saved data
      const savedTemplateName = claim.sections?.current_template_name as string | undefined;
      const savedIsModified = claim.sections?.is_template_modified as boolean | undefined;
      
      if (savedTemplateName) {
        const template = templates.find(t => t.name === savedTemplateName);
        if (template) {
          setCurrentTemplate(template);
        }
      }
      
      if (savedIsModified !== undefined) {
        setIsTemplateModified(savedIsModified);
      }
      
      return;
    }

    // Check if there's a DEFAULT template for this policy type
    const defaultTemplate = templates.find(t => t.is_default && t.policy_type_id === claim.policy_type_id);
    
    if (defaultTemplate && defaultTemplate.sections && defaultTemplate.sections.length > 0) {
      console.log('✅ Loading DEFAULT template:', defaultTemplate.name);
      const convertedSections: DynamicSection[] = defaultTemplate.sections.map(section => ({
        id: section.id,
        name: section.name,
        order_index: section.order_index,
        color_class: section.color_class,
        fields: section.fields || [],
        tables: section.tables || [],
        isCustom: false
      }));
      setDynamicSections(convertedSections);
      setCurrentTemplate(defaultTemplate);
      setIsTemplateModified(false); // ADD THIS LINE
      return;
    }

    // Create default sections if no saved sections and no default template
    console.log('✅ Creating default sections (no saved data or template found)');
    const additionalFields = getAdditionalDetailsFields();
    const section1Fields = additionalFields.slice(0, 13);
    const section2Fields = additionalFields.slice(13, 23);
    const section3Fields = additionalFields.slice(23, 29);
    const section4Fields = additionalFields.slice(29);

    const defaultSections: DynamicSection[] = [
      {
        id: 'section1',
        name: 'Section 1 - Basic Information',
        order_index: 1,
        color_class: 'bg-gradient-primary',
        fields: section1Fields.map((f, idx) => ({
          id: f.name,
          name: f.name,
          label: f.label,
          type: f.type as TemplateField['type'],
          required: f.required,
          options: f.options,
          order_index: idx + 1
        })),
        tables: [],
        isCustom: false
      },
      {
        id: 'section2',
        name: 'Section 2 - Invoice & Goods Details',
        order_index: 2,
        color_class: 'bg-gradient-primary',
        fields: section2Fields.map((f, idx) => ({
          id: f.name,
          name: f.name,
          label: f.label,
          type: f.type as TemplateField['type'],
          required: f.required,
          options: f.options,
          order_index: idx + 1
        })),
        tables: [],
        isCustom: false
      },
      {
        id: 'section3',
        name: 'Section 3 - Transportation Details',
        order_index: 3,
        color_class: 'bg-gradient-primary',
        fields: section3Fields.map((f, idx) => ({
          id: f.name,
          name: f.name,
          label: f.label,
          type: f.type as TemplateField['type'],
          required: f.required,
          options: f.options,
          order_index: idx + 1
        })),
        tables: [],
        isCustom: false
      },
      {
        id: 'section4',
        name: 'Section 4 - Report Section',
        order_index: 4,
        color_class: 'bg-gradient-primary',
        fields: section4Fields.map((f, idx) => ({
          id: f.name,
          name: f.name,
          label: f.label,
          type: f.type as TemplateField['type'],
          required: f.required,
          options: f.options,
          order_index: idx + 1
        })),
        tables: [],
        isCustom: false
      }
    ];
    
    setDynamicSections(defaultSections);
  }, [templates, claim.policy_type_id, dynamicSections.length]); // Only reinitialize when these change

  
  // Now define these after useEffect where getAdditionalDetailsFields is available
  const additionalFields = getAdditionalDetailsFields();
  const section1Fields = additionalFields.slice(0, 13);
  const section2Fields = additionalFields.slice(13, 23);
  const section3Fields = additionalFields.slice(23, 29);
  const section4Fields = additionalFields.slice(29);

  const section1Custom = customFields.filter((f) => f.section === 'section1');
  const section2Custom = customFields.filter((f) => f.section === 'section2');
  const section3Custom = customFields.filter((f) => f.section === 'section3');
  const section4Custom = customFields.filter((f) => f.section === 'section4');

 const renderField = (field: FormField, isEditing = false) => {
    const showActions = isEditing; 
    const fieldValue = watch(field.name);
    const displayedLabel = fieldLabels[field.name] ?? field.label;
    const isEditingLabel = editingLabels.has(field.name);

    if (hiddenFields.has(field.name)) {
      return null;
    }

    switch (field.type) {
      case 'text':
        return (
          <div key={field.name} className={`relative transition-all duration-200 rounded-lg ${
            isEditing 
              ? 'border-l-4 border-blue-400 pl-4 pr-2 py-3 bg-gradient-to-r from-blue-50/50 to-transparent hover:from-blue-50/80' 
              : 'py-1'
          }`}>
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-between w-[250px] flex-shrink-0 pt-2">
                {field.isCustom ? (
                  <Input
                    value={field.name}
                    onChange={(e) => updateCustomField(field.name, { name: e.target.value })}
                    onBlur={() => {
                      // Save when done editing the name
                      if (pendingSaves.has(field.name)) {
                        saveCustomField(field.name);
                      }
                    }}
                    className="text-sm font-medium w-auto max-w-xs"
                    placeholder="Field name"
                  />
                ) : isEditingLabel ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={fieldLabels[field.name] ?? displayedLabel}
                      onChange={(e) => setFieldLabels(prev => ({ ...prev, [field.name]: e.target.value }))}
                      onBlur={() => saveFieldLabel(field.name)}
                      className="text-sm font-medium w-auto max-w-xs"
                      placeholder="Field label"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => saveFieldLabel(field.name)}
                      className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                      title="Save label"
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Label 
                    htmlFor={field.name} 
                    className={isEditing ? "cursor-pointer" : ""}
                    onClick={isEditing ? () => setEditingLabels(prev => { const next = new Set(prev); next.add(field.name); return next; }) : undefined}
                  >
                    {displayedLabel} {field.required && <span className="text-destructive">*</span>}
                  </Label>
                )}
                {showActions && (
                  <div className="flex items-center gap-1">
                    {pendingSaves.has(field.name) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => saveCustomField(field.name)}
                        className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                        title="Save field"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => field.isCustom ? removeCustomField(field.name) : removeField(field.name)}
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex-1 max-w-full">
                <Input
                  id={field.name}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  {...register(field.name, { 
                    required: field.required ? `${field.label} is required` : false,
                    onChange: (e) => {
                      if (e.target.value !== (claim.sections?.[field.name] || '')) {
                        setPendingSaves(prev => new Set([...prev, field.name]));
                      }
                    },
                    onBlur: () => {
                    }
                  })}
                />
                {errors[field.name] && (
                  <p className="text-sm text-destructive mt-1">
                    {errors[field.name]?.message as string}
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case 'number':
        return (
          <div key={field.name} className={`relative transition-all duration-200 rounded-lg ${
            isEditing 
              ? 'border-l-4 border-blue-400 pl-4 pr-2 py-3 bg-gradient-to-r from-blue-50/50 to-transparent hover:from-blue-50/80' 
              : 'py-1'
          }`}>
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-between w-[250px] flex-shrink-0 pt-2">
                {field.isCustom ? (
                  <Input
                    value={field.label}
                    onChange={(e) => updateCustomField(field.name, { label: e.target.value })}
                    className="text-sm font-medium w-auto max-w-xs"
                    placeholder="Field label"
                  />
                ) : isEditingLabel ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={fieldLabels[field.name] ?? displayedLabel}
                      onChange={(e) => setFieldLabels(prev => ({ ...prev, [field.name]: e.target.value }))}
                      onBlur={() => saveFieldLabel(field.name)}
                      className="text-sm font-medium w-auto max-w-xs"
                      placeholder="Field label"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => saveFieldLabel(field.name)}
                      className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                      title="Save label"
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Label 
                    htmlFor={field.name} 
                    className={isEditing ? "cursor-pointer" : ""}
                    onClick={isEditing ? () => setEditingLabels(prev => { const next = new Set(prev); next.add(field.name); return next; }) : undefined}
                  >
                    {displayedLabel} {field.required && <span className="text-destructive">*</span>}
                  </Label>
                )}
                {showActions && (
                  <div className="flex items-center gap-1">
                    {pendingSaves.has(field.name) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => saveCustomField(field.name)}
                        className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                        title="Save field"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => field.isCustom ? removeCustomField(field.name) : removeField(field.name)}
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
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
                      const newValue = e.target.valueAsNumber || e.target.value;
                      if (newValue !== (claim.sections?.[field.name] || '')) {
                        setPendingSaves(prev => new Set([...prev, field.name]));
                      }
                    },
                    onBlur: (e) => {
                      if (pendingSaves.has(field.name)) {
                        saveCustomField(field.name);
                      }
                    }
                  })}
                />
                {errors[field.name] && (
                  <p className="text-sm text-destructive mt-1">
                    {errors[field.name]?.message as string}
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case 'date':
        return (
          <div key={field.name} className={`relative transition-all duration-200 rounded-lg ${
            isEditing 
              ? 'border-l-4 border-blue-400 pl-4 pr-2 py-3 bg-gradient-to-r from-blue-50/50 to-transparent hover:from-blue-50/80' 
              : 'py-1'
          }`}>
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-between w-[250px] flex-shrink-0 pt-2">
                {field.isCustom ? (
                  <Input
                    value={field.label}
                    onChange={(e) => updateCustomField(field.name, { label: e.target.value })}
                    className="text-sm font-medium w-auto max-w-xs"
                    placeholder="Field label"
                  />
                ) : isEditingLabel ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={fieldLabels[field.name] ?? displayedLabel}
                      onChange={(e) => setFieldLabels(prev => ({ ...prev, [field.name]: e.target.value }))}
                      onBlur={() => saveFieldLabel(field.name)}
                      className="text-sm font-medium w-auto max-w-xs"
                      placeholder="Field label"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => saveFieldLabel(field.name)}
                      className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                      title="Save label"
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Label 
                    htmlFor={field.name} 
                    className={isEditing ? "cursor-pointer" : ""}
                    onClick={isEditing ? () => setEditingLabels(prev => { const next = new Set(prev); next.add(field.name); return next; }) : undefined}
                  >
                    {displayedLabel} {field.required && <span className="text-destructive">*</span>}
                  </Label>
                )}
                {showActions && (
                  <div className="flex items-center gap-1">
                    {pendingSaves.has(field.name) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => saveCustomField(field.name)}
                        className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                        title="Save field"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => field.isCustom ? removeCustomField(field.name) : removeField(field.name)}
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex-1 max-w-full">
                <Input
                  id={field.name}
                  type="date"
                  {...register(field.name, { 
                    required: field.required ? `${field.label} is required` : false,
                    onChange: (e) => {
                      if (e.target.value !== (claim.sections?.[field.name] || '')) {
                        setPendingSaves(prev => new Set([...prev, field.name]));
                      }
                    },
                    onBlur: (e) => {
                      if (pendingSaves.has(field.name)) {
                        saveCustomField(field.name);
                      }
                    }
                  })}
                />
                {errors[field.name] && (
                  <p className="text-sm text-destructive mt-1">
                    {errors[field.name]?.message as string}
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case 'textarea':
        return (
          <div key={field.name} className={`relative transition-all duration-200 rounded-lg ${
            isEditing 
              ? 'border-l-4 border-blue-400 pl-4 pr-2 py-3 bg-gradient-to-r from-blue-50/50 to-transparent hover:from-blue-50/80' 
              : 'py-1'
          }`}>
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-between w-[250px] flex-shrink-0 pt-2">
                {field.isCustom ? (
                  <Input
                    value={field.label}
                    onChange={(e) => updateCustomField(field.name, { label: e.target.value })}
                    className="text-sm font-medium w-auto max-w-xs"
                    placeholder="Field label"
                  />
                ) : isEditingLabel ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={fieldLabels[field.name] ?? displayedLabel}
                      onChange={(e) => setFieldLabels(prev => ({ ...prev, [field.name]: e.target.value }))}
                      onBlur={() => saveFieldLabel(field.name)}
                      className="text-sm font-medium w-auto max-w-xs"
                      placeholder="Field label"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => saveFieldLabel(field.name)}
                      className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                      title="Save label"
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Label 
                    htmlFor={field.name} 
                    className={isEditing ? "cursor-pointer" : ""}
                    onClick={isEditing ? () => setEditingLabels(prev => { const next = new Set(prev); next.add(field.name); return next; }) : undefined}
                  >
                    {displayedLabel} {field.required && <span className="text-destructive">*</span>}
                  </Label>
                )}
                {showActions && (
                  <div className="flex items-center gap-1">
                    {pendingSaves.has(field.name) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => saveCustomField(field.name)}
                        className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                        title="Save field"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => field.isCustom ? removeCustomField(field.name) : removeField(field.name)}
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex-1 max-w-full">
                <Textarea
                  id={field.name}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  rows={3}
                  {...register(field.name, { 
                    required: field.required ? `${field.label} is required` : false,
                    onChange: (e) => {
                      if (e.target.value !== (claim.sections?.[field.name] || '')) {
                        setPendingSaves(prev => new Set([...prev, field.name]));
                      }
                    },
                    onBlur: (e) => {
                      if (pendingSaves.has(field.name)) {
                        saveCustomField(field.name);
                      }
                    }
                  })}
                />
                {errors[field.name] && (
                  <p className="text-sm text-destructive mt-1">
                    {errors[field.name]?.message as string}
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case 'select':
        if (['content_industry_use', 'arrival_details', 'number_packages'].includes(field.name)) {
          return (
            <SearchableSelectField
              key={field.name}
              field={field}
              fieldValue={fieldValue}
              displayedLabel={displayedLabel}
              isEditingLabel={isEditingLabel}
              showActions={showActions}
              claim={claim}
              isEditing={isEditing}
              fieldLabels={fieldLabels}
              setFieldLabels={setFieldLabels}
              editingLabels={editingLabels}
              setEditingLabels={setEditingLabels}
              pendingSaves={pendingSaves}
              setPendingSaves={setPendingSaves}
              setValue={setValue}
              errors={errors}
              saveCustomField={saveCustomField}
              saveFieldLabel={saveFieldLabel}
              removeField={removeField}
              removeCustomField={removeCustomField}
              updateCustomField={updateCustomField}
              handleCreateFieldOption={handleCreateFieldOption}
              addFieldOptionMutation={addFieldOptionMutation}
            />
          );
        }

        return (
          <div key={field.name} className={`relative transition-all duration-200 rounded-lg ${
            isEditing 
              ? 'border-l-4 border-blue-400 pl-4 pr-2 py-3 bg-gradient-to-r from-blue-50/50 to-transparent hover:from-blue-50/80' 
              : 'py-1'
          }`}>
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-between w-[250px] flex-shrink-0 pt-2">
                {field.isCustom ? (
                  <Input
                    value={field.label}
                    onChange={(e) => updateCustomField(field.name, { label: e.target.value })}
                    className="text-sm font-medium w-auto max-w-xs"
                    placeholder="Field label"
                  />
                ) : isEditingLabel ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={fieldLabels[field.name] ?? displayedLabel}
                      onChange={(e) => setFieldLabels(prev => ({ ...prev, [field.name]: e.target.value }))}
                      onBlur={() => saveFieldLabel(field.name)}
                      className="text-sm font-medium w-auto max-w-xs"
                      placeholder="Field label"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => saveFieldLabel(field.name)}
                      className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                      title="Save label"
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Label 
                    htmlFor={field.name} 
                    className={isEditing ? "cursor-pointer" : ""}
                    onClick={isEditing ? () => setEditingLabels(prev => { const next = new Set(prev); next.add(field.name); return next; }) : undefined}
                  >
                    {displayedLabel} {field.required && <span className="text-destructive">*</span>}
                  </Label>
                )}
                {showActions && (
                  <div className="flex items-center gap-1">
                    {pendingSaves.has(field.name) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => saveCustomField(field.name)}
                        className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                        title="Save field"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => field.isCustom ? removeCustomField(field.name) : removeField(field.name)}
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <Select
                  value={typeof fieldValue === "string" ? fieldValue : ""}
                  onValueChange={(value) => {
                    setValue(field.name, value);
                    if (value !== (claim.sections?.[field.name] || '')) {
                      setPendingSaves(prev => new Set([...prev, field.name]));
                    }
                  }}
                  onOpenChange={(open) => {
                    if (!open && pendingSaves.has(field.name)) {
                      setTimeout(() => saveCustomField(field.name), 100);
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
                {errors[field.name] && (
                  <p className="text-sm text-destructive mt-1">
                    {errors[field.name]?.message as string}
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case 'checkbox':
        return (
          <div key={field.name} className={`relative transition-all duration-200 rounded-lg ${
            isEditing 
              ? 'border-l-4 border-blue-400 pl-4 pr-2 py-3 bg-gradient-to-r from-blue-50/50 to-transparent hover:from-blue-50/80' 
              : 'py-1'
          }`}>
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-between w-[250px] flex-shrink-0">
                {field.isCustom ? (
                  <Input
                    value={field.label}
                    onChange={(e) => updateCustomField(field.name, { label: e.target.value })}
                    className="text-sm font-medium w-auto max-w-xs"
                    placeholder="Field label"
                  />
                ) : (
                  <Label htmlFor={field.name} className="text-sm font-normal">
                    {field.label}
                  </Label>
                )}
                {showActions && (
                  <div className="flex items-center gap-1">
                    {pendingSaves.has(field.name) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => saveCustomField(field.name)}
                        className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                        title="Save field"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => field.isCustom ? removeCustomField(field.name) : removeField(field.name)}
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <Checkbox
                  id={field.name}
                  checked={typeof fieldValue === "boolean" ? fieldValue : false}
                  onCheckedChange={(checked) => {
                    setValue(field.name, checked);
                    if (checked !== (claim.sections?.[field.name] || false)) {
                      setPendingSaves(prev => new Set([...prev, field.name]));
                      setTimeout(() => {
                        if (pendingSaves.has(field.name)) {
                          saveCustomField(field.name);
                        }
                      }, 500);
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

  const renderDynamicSection = (section: DynamicSection) => {
    const convertedSectionFields = section.fields.map(field => ({
  name: field.name,
  label: field.label,
  type: field.type as FormField['type'],
  required: field.required,
  options: field.options,
  isCustom: false
})).filter(field => !hiddenFields.has(field.name));

const sectionCustomFields = customFields.filter(f => f.section === section.id);

// Remove duplicates - if a field exists in both arrays, keep only the custom one
const customFieldNames = new Set(sectionCustomFields.map(f => f.name));
const uniqueConvertedFields = convertedSectionFields.filter(f => !customFieldNames.has(f.name));

const allFields = [...uniqueConvertedFields, ...sectionCustomFields];

    const isOpen = section.id in openSections ? openSections[section.id as keyof typeof openSections] : true;
    const isEditing = section.id in sectionEditMode ? sectionEditMode[section.id as keyof typeof sectionEditMode] : false;

    return (
      <Collapsible 
        open={isOpen} 
        onOpenChange={() => {
          setOpenSections(prev => ({
            ...prev,
            [section.id]: !isOpen
          }));
        }}
      >
        <Card className={`bg-white/95 backdrop-blur-sm border shadow-sm transition-all duration-200 ${
          isEditing ? 'border-blue-400 shadow-blue-100' : 'border-slate-200'
        }`}>
          <div className="flex items-stretch">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className={`flex-1 justify-between p-4 h-auto text-left text-white hover:opacity-90 transition-all duration-200 rounded-tl-lg rounded-tr-none`}
style={{ backgroundColor: '#6B7FB8' }}
              >
                <h4 className="text-lg font-semibold flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  {section.name}
                </h4>
                {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </Button>
            </CollapsibleTrigger>
            
            <div className="flex">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setSectionEditMode(prev => ({
                    ...prev,
                    [section.id]: !isEditing
                  }));
                }}
                className={`h-auto px-3 py-2 transition-all duration-200 ${
                  isEditing 
                    ? 'bg-white text-blue-600 hover:bg-blue-50 border-l border-blue-200' 
                    : 'text-white hover:bg-white/20 border-l border-white/20'
                }`}
                style={!isEditing ? { backgroundColor: '#6B7FB8' } : undefined}
                title={isEditing ? 'Exit edit mode' : 'Edit section'}
              >
                <Edit className="w-4 h-4" />
              </Button>
              
              {section.isCustom && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSection(section.id);
                  }}
                  className={`h-auto px-3 py-2 rounded-tr-lg rounded-tl-none transition-all duration-200 text-white hover:bg-red-500 border-l border-white/20`}
                  style={{ backgroundColor: '#6B7FB8' }}
                  title="Remove section"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          
          <CollapsibleContent className="animate-accordion-down">
            <div className="grid grid-cols-1 md:grid-cols-1 gap-2 p-6 bg-slate-50/50">
              {allFields.map((field, index) => (
                <div key={`${section.id}-${field.name}-${index}`}>
                  {renderField(field, isEditing)}
                </div>
              ))}
            </div>
              <div className="px-6 pb-6 bg-slate-50/50 space-y-4">
                {/* Render Tables */}
                {section.tables && section.tables.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-700">Data Tables</h4>
                    {section.tables.map((table) => (
                      // Make sure your EditableTable usage looks EXACTLY like this:
                      <EditableTable
                        key={table.id}
                        tableId={table.id}
                        tableName={table.name}
                        data={table.data}
                        sectionName={section.name}  // ← This prop must be here
                        onUpdate={(newData) => updateTableData(section.id, table.id, newData)}
                        onDelete={async () => {
                          if (confirm(`Delete table "${table.name}"?`)) {
                            const updatedSections = dynamicSections.map(s =>
                              s.id === section.id
                                ? { ...s, tables: (s.tables || []).filter(t => t.id !== table.id) }
                                : s
                            );
                            setDynamicSections(updatedSections);
                            
                            try {
                              await updateClaimMutation.mutateAsync({
                                id: claim.id,
                                updates: {
                                  sections: {
                                    ...claim.sections,
                                    dynamic_sections_metadata: updatedSections,
                                  } as any,
                                },
                              });
                              toast.success(`Table "${table.name}" deleted`);
                            } catch (error) {
                              console.error('Failed to delete table:', error);
                              toast.error('Failed to delete table');
                            }
                          }
                        }}
                        onNameChange={async (newName) => {
                          const updatedSections = dynamicSections.map(s =>
                            s.id === section.id
                              ? {
                                  ...s,
                                  tables: (s.tables || []).map(t =>
                                    t.id === table.id ? { ...t, name: newName } : t
                                  )
                                }
                              : s
                          );
                          setDynamicSections(updatedSections);
                          
                          try {
                            await updateClaimMutation.mutateAsync({
                              id: claim.id,
                              updates: {
                                sections: {
                                  ...claim.sections,
                                  dynamic_sections_metadata: updatedSections,
                                } as any,
                              },
                            });
                          } catch (error) {
                            console.error('Failed to save table name:', error);
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
                <div className="flex gap-3">
                {/* Only Add Field Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addFieldToSection(section.id)}
                  className="flex items-center gap-2 border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  <Plus className="h-3 w-3" />
                  Add Field
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedSectionForTable(section.id);
                    setShowTableModal(true);
                  }}
                  className="flex items-center gap-2 border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  <Table className="h-3 w-3" />
                  Add Table
                </Button>
                </div>
              </div>
            <div className="px-6 pb-6 bg-slate-50/50">
              <ImageGrid
                sectionKey={section.id}
                images={sectionImages[section.id] || (Array(6).fill("") as string[])}
                setImages={(urls) =>
                  setSectionImages((prev) => ({
                    ...prev,
                    [section.id]: urls,
                  }))
                }
                claimId={claim.id}
                claim={claim}
                claimFormData={claim.sections || {}}
                updateClaim={updateClaimMutation}
                customFields={customFields}
                hiddenFields={hiddenFields}
                fieldLabels={fieldLabels}
                sectionImages={sectionImages}
                queryClient={queryClient}
                customFieldsRef={customFieldsRef}
                hiddenFieldsRef={hiddenFieldsRef}
                fieldLabelsRef={fieldLabelsRef}
              />
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="bg-white/90 backdrop-blur-sm border-white/30 shadow-lg">
        <CardHeader className="bg-slate-700 text-white rounded-t-lg">
      <div className="flex justify-between items-center">
        <CardTitle className="flex items-center gap-2">
          <Info className="w-5 h-5" />
          Additional Information
        </CardTitle>
        {/* Template Status Badge */}
        {currentTemplate && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-white">
                {currentTemplate?.name}
                  {isTemplateModified && currentTemplate && (
                    <span className="text-orange-600 ml-1">- EDITED*</span>
                  )}
            </Badge>
          </div>
        )}
            <div className="flex gap-2">
              <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
                <DialogTrigger asChild>
                  <Button variant="secondary" size="sm">
                    <Upload className="w-4 h-4 mr-1" />
                    Load Template
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Load Form Template</DialogTitle>
                </DialogHeader>
                <DialogDescription className="sr-only">
                  Select a saved template to load its field structure
                </DialogDescription>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
  {templates.map(template => (
    <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => loadTemplate(template)}>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <h3 className="font-medium">{template.name}</h3>
            {template.is_default && (
              <Badge variant="outline" className="text-xs">Default</Badge>
            )}
          </div>
          {template.description && (
            <p className="text-sm text-muted-foreground">{template.description}</p>
          )}
          
          {/* Summary line */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{(template.sections || []).length} sections</span>
            <span>•</span>
            <span>{(template.sections || []).reduce((acc, section) => acc + (section.fields?.length || 0), 0)} fields total</span>
          </div>

          {/* Expandable details */}
          <details 
            className="group" 
            onClick={(e) => e.stopPropagation()}
          >
            <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-700 list-none flex items-center gap-1">
              <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
              View sections & fields
            </summary>
            <div className="mt-2 space-y-2 pl-4 max-h-40 overflow-y-auto">
              {(template.sections || []).map((section, index) => (
                <div key={index} className="text-xs">
                  <p className="font-semibold text-gray-700">{section.name}</p>
                  <p className="text-muted-foreground text-[11px] ml-2">
                    {(section.fields || []).map(f => f.label).join(', ')}
                  </p>
                </div>
              ))}
            </div>
          </details>
        </div>
      </CardContent>
    </Card>
  ))}
</div>
                </DialogContent>
              </Dialog>

              <Dialog open={showSaveTemplateDialog} onOpenChange={setShowSaveTemplateDialog}>
                <DialogTrigger asChild>
                  <Button variant="secondary" size="sm">
                    <Save className="w-4 h-4 mr-1" />
                    Save Template
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Save as Template</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    {/* Show checkbox to overwrite current template */}
                    {currentTemplate && !currentTemplate.is_default && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="overwrite-template" className="text-sm font-medium cursor-pointer">
                            Replace existing template "{currentTemplate.name}"
                          </Label>
                          <Checkbox
                            id="overwrite-template"
                            checked={templateName === currentTemplate.name}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setTemplateName(currentTemplate.name);
                                setTemplateDescription(currentTemplate.description || '');
                              } else {
                                setTemplateName('');
                                setTemplateDescription('');
                              }
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Check this to replace the current template instead of creating a new one
                        </p>
                      </div>
                    )}
                    
                    <div>
                      <Label htmlFor="template-name">Template Name *</Label>
                      <Input
                        id="template-name"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="Enter template name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="template-description">Description</Label>
                      <Textarea
                        id="template-description"
                        value={templateDescription}
                        onChange={(e) => setTemplateDescription(e.target.value)}
                        placeholder="Optional description"
                        rows={3}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowSaveTemplateDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={saveAsTemplate} disabled={!templateName.trim() || saveTemplateMutation.isPending}>
                        {saveTemplateMutation.isPending ? "Saving..." : "Save Template"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {dynamicSections
              .sort((a, b) => a.order_index - b.order_index)
              .map((section) => (
                <div key={section.id}>
                  {renderDynamicSection(section)}
                </div>
              ))}

            <div className="flex justify-center pt-4">
              <Dialog open={showNewSectionDialog} onOpenChange={setShowNewSectionDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add New Section
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                  <DialogHeader>
                    <DialogTitle>Create New Section</DialogTitle>
                    <DialogDescription className="sr-only">
                      Choose a template or create from scratch
                    </DialogDescription>
                  </DialogHeader>
                  
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                    <TabsList className="grid w-full grid-cols-2 bg-muted p-1 rounded-lg mb-4">
                      <TabsTrigger 
                        value="template" 
                        className="data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 py-2.5 font-medium"
                      >
                        From Template
                      </TabsTrigger>
                      <TabsTrigger 
                        value="scratch" 
                        className="data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 py-2.5 font-medium"
                      >
                        From Scratch
                      </TabsTrigger>
                    </TabsList>
                    
                    {/* TAB 1: From Template */}
                    <TabsContent value="template" className="flex-1 min-h-0 flex flex-col">
                      {templatesLoading ? (
                        <div className="flex-1 flex items-center justify-center">
                          <div className="text-center">
                            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
                            <p className="text-muted-foreground">Loading templates...</p>
                          </div>
                        </div>
                      ) : sectionTemplates.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center">
                          <div className="text-center space-y-4">
                            <p className="text-muted-foreground">
                              No templates available for this policy type.
                            </p>
                            <Button 
                              variant="outline" 
                              onClick={() => setActiveTab("scratch")}
                              className="hover:bg-primary hover:text-primary-foreground transition-colors"
                            >
                              Create from Scratch Instead
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 min-h-0 flex flex-col space-y-4">
                          {/* Fixed height scrollable grid */}
                          <div className="flex-1 min-h-0">
                            <div 
                              className="h-full overflow-y-auto pr-2 space-y-3"
                              style={{ 
                                scrollbarWidth: 'thin',
                                scrollbarColor: 'rgb(203 213 225) transparent' 
                              }}
                            >
                              <div className="grid grid-cols-2 gap-4 pb-4">
                                {sectionTemplates.map(template => (
                                  <Card 
                                    key={template.id}
                                    onClick={() => setSelectedTemplate(template)}
                                    className={`cursor-pointer transition-all duration-200 hover:shadow-lg border-2 ${
                                      selectedTemplate?.id === template.id 
                                        ? 'border-primary shadow-lg bg-primary/5' 
                                        : 'border-border hover:border-primary/50'
                                    }`}
                                  >
                                    <CardContent className="p-4 space-y-3">
                                      <div className={`w-full h-3 rounded-full ${template.color_class}`} />
                                      <div className="space-y-2">
                                        <div className="flex items-start justify-between">
                                          <h4 className="font-semibold text-sm leading-tight">{template.name}</h4>
                                          {selectedTemplate?.id === template.id && (
                                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0 ml-2">
                                              <svg className="w-3 h-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                              </svg>
                                            </div>
                                          )}
                                        </div>
                                        {template.description && (
                                          <p className="text-xs text-muted-foreground leading-relaxed">
                                            {template.description}
                                          </p>
                                        )}
                                        <Badge variant="secondary" className="text-xs">
                                          {template.preset_fields.length} fields
                                        </Badge>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </div>
                          </div>
                          
                          {/* Fixed bottom section for selected template */}
                          {selectedTemplate && (
                            <div className="border-t bg-muted/30 -mx-6 px-6 py-4 space-y-4">
                              <div>
                                <Label htmlFor="template-section-name" className="text-sm font-medium">
                                  Section Name
                                </Label>
                                <Input
                                  id="template-section-name"
                                  value={newSectionName}
                                  onChange={(e) => setNewSectionName(e.target.value)}
                                  placeholder={selectedTemplate.name}
                                  className="mt-1.5"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                  Leave empty to use: "{selectedTemplate.name}"
                                </p>
                              </div>
                              
                              <div className="flex justify-end gap-3">
                                <Button 
                                  variant="outline" 
                                  onClick={() => {
                                    setSelectedTemplate(null);
                                    setNewSectionName('');
                                  }}
                                  className="hover:bg-muted"
                                >
                                  Clear Selection
                                </Button>
                                <Button 
                                  onClick={createSectionFromTemplate}
                                  className="bg-primary hover:bg-primary/90"
                                >
                                  <Plus className="w-4 h-4 mr-2" />
                                  Create with {selectedTemplate.preset_fields.length} Fields
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </TabsContent>
                    
                    {/* TAB 2: From Scratch */}
                    <TabsContent value="scratch" className="flex-1 space-y-6">
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="section-name" className="text-sm font-medium">Section Name *</Label>
                          <Input
                            id="section-name"
                            value={newSectionName}
                            onChange={(e) => setNewSectionName(e.target.value)}
                            placeholder="Enter section name"
                            className="mt-1.5"
                          />
                        </div>
                        {/* <div>
                          <Label htmlFor="section-color" className="text-sm font-medium">Section Color</Label>
                          <Select value={newSectionColor} onValueChange={setNewSectionColor}>
                            <SelectTrigger className="mt-1.5">
                              <SelectValue placeholder="Choose a color" />
                            </SelectTrigger>
                            <SelectContent>
                              {colorOptions.map(color => (
                                <SelectItem key={color.value} value={color.value}>
                                  <div className="flex items-center gap-2">
                                    <div className={`w-4 h-4 rounded ${color.class}`} />
                                    {color.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div> */}
                      </div>
                      
                      <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setShowNewSectionDialog(false);
                            setNewSectionName('');
                          }}
                          className="hover:bg-muted"
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={addNewSection} 
                          disabled={!newSectionName.trim()}
                          className="bg-primary hover:bg-primary/90"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Section
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
              {/* Add Table Button - Opens modal to select section */}
              <Button 
                variant="outline" 
                className="flex items-center gap-2"
                onClick={() => {
                  if (dynamicSections.length === 0) {
                    toast.error("Please create a section first before adding a table");
                    return;
                  }
                  setShowTableModal(true);
                }}
              >
                <Table className="w-4 h-4" />
                Add Table
              </Button>
            </div>

            <div className="pt-6 border-t border-border/50">
              <Button 
                type="submit" 
                disabled={updateClaimMutation.isPending}
                className="w-full bg-slate-700 hover:bg-slate-800 text-white shadow-sm transition-all duration-200"
              >
                {updateClaimMutation.isPending ? "Saving..." : "Save Additional Information"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <TableModal
          isOpen={showTableModal}
          onClose={() => setShowTableModal(false)}
          onCreateTable={(sectionId, rows, cols, name) => {
            addTableToSection(sectionId, rows, cols, name);
          }}
          preSelectedSectionId={selectedSectionForTable}
          sections={dynamicSections.map(s => ({ id: s.id, name: s.name }))}
        />
    </div>
  );
};

interface SearchableSelectFieldProps {
  field: FormField;
  fieldValue: unknown;
  displayedLabel: string;
  isEditingLabel: boolean;
  showActions: boolean;
  isEditing: boolean;
  claim: Claim;
  fieldLabels: Record<string, string>;
  setFieldLabels: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  editingLabels: Set<string>;
  setEditingLabels: React.Dispatch<React.SetStateAction<Set<string>>>;
  pendingSaves: Set<string>;
  setPendingSaves: React.Dispatch<React.SetStateAction<Set<string>>>;
  setValue: UseFormSetValue<Record<string, unknown>>;
  errors: FieldErrors<Record<string, unknown>>;
  saveCustomField: (fieldName: string) => Promise<void> | void;
  saveFieldLabel: (fieldName: string) => Promise<void> | void;
  removeField: (fieldName: string) => void;
  removeCustomField: (fieldName: string) => void;
  updateCustomField: (fieldName: string, updates: Partial<FormField>) => void;
  handleCreateFieldOption: (fieldName: string, newValue: string) => Promise<void>;
  addFieldOptionMutation: {
    isPending: boolean;
    mutateAsync: (payload: { fieldName: string; optionValue: string }) => Promise<void>;
  };
}

const SearchableSelectField: React.FC<SearchableSelectFieldProps> = ({ 
  field, 
  fieldValue, 
  displayedLabel, 
  isEditingLabel, 
  showActions,
  isEditing,
  claim,
  fieldLabels,
  setFieldLabels,
  editingLabels,
  setEditingLabels,
  pendingSaves,
  setPendingSaves,
  setValue,
  errors,
  saveCustomField,
  saveFieldLabel,
  removeField,
  removeCustomField,
  updateCustomField,
  handleCreateFieldOption,
  addFieldOptionMutation
}) => {
  const { data: dynamicOptions = [], isLoading } = useFieldOptions(field.name);
  
  const allOptions = [
    ...(field.options || []),
    ...dynamicOptions.filter(option => !(field.options || []).includes(option))
  ];

  return (
    <div className={`relative transition-all duration-200 rounded-lg ${
      isEditing 
        ? 'border-l-4 border-blue-400 pl-4 pr-2 py-3 bg-gradient-to-r from-blue-50/50 to-transparent hover:from-blue-50/80' 
        : 'py-1'
    }`}>
      <div className="flex items-start gap-4">
        <div className="flex items-center justify-between w-[250px] flex-shrink-0 pt-2">
        {field.isCustom ? (
          <Input
            value={field.label}
            onChange={(e) => updateCustomField(field.name, { label: e.target.value })}
            className="text-sm font-medium w-auto max-w-xs"
            placeholder="Field label"
          />
        ) : isEditingLabel ? (
          <div className="flex items-center gap-2">
            <Input
              value={fieldLabels[field.name] ?? displayedLabel}
              onChange={(e) => setFieldLabels(prev => ({ ...prev, [field.name]: e.target.value }))}
              onBlur={() => saveFieldLabel(field.name)}
              className="text-sm font-medium w-auto max-w-xs"
              placeholder="Field label"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => saveFieldLabel(field.name)}
              className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
              title="Save label"
            >
              <Check className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <Label 
            htmlFor={field.name} 
            className={isEditing ? "cursor-pointer" : ""}
            onClick={isEditing ? () => setEditingLabels(prev => { const next = new Set(prev); next.add(field.name); return next; }) : undefined}
          >
            {displayedLabel} {field.required && <span className="text-destructive">*</span>}
          </Label>
        )}
        
        {showActions && (
          <div className="flex items-center gap-1">
            {pendingSaves.has(field.name) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => saveCustomField(field.name)}
                className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                title="Save field"
              >
                <Check className="h-3 w-3" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => field.isCustom ? removeCustomField(field.name) : removeField(field.name)}
              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
        </div>
        <div className="flex-1 max-w-[67%]">
          {isLoading && (
        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
          <div className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full"></div>
          <span>Loading options...</span>
        </div>
      )}

      {!isLoading && (
        <SearchableSelect
          options={allOptions}
          value={typeof fieldValue === "string" ? fieldValue : ""}
          placeholder={`Select ${field.label.toLowerCase()}...`}
          searchPlaceholder={`Search or add ${field.label.toLowerCase()}...`}
          onValueChange={(value) => {
            setValue(field.name, value);
            if (value !== (claim.sections?.[field.name] || '')) {
              setPendingSaves(prev => new Set([...prev, field.name]));
            }
          }}
          allowClear={true}
          allowCreate={true}
          onCreateOption={(newValue) => handleCreateFieldOption(field.name, newValue)}
          createOptionText={`Add ${field.label.toLowerCase()}`}
          className="w-full"
          disabled={addFieldOptionMutation.isPending}
          onOpenChange={(open) => {
            if (!open && pendingSaves.has(field.name)) {
              setTimeout(() => saveCustomField(field.name), 100);
            }
          }}
        />
      )}

      {addFieldOptionMutation.isPending && (
        <div className="text-xs text-muted-foreground flex items-center space-x-1">
          <div className="animate-spin h-3 w-3 border-2 border-green-600 border-t-transparent rounded-full"></div>
          <span>Adding new option...</span>
        </div>
      )}

      {errors[field.name] && (
            <p className="text-sm text-destructive mt-1">
              {errors[field.name]?.message as string}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};