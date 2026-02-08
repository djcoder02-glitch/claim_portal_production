import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { GripVertical, Eye, EyeOff } from "lucide-react";
import { type Claim } from "@/hooks/useClaims";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* =========================
   Types
========================= */

interface ReportSection {
  id: string;
  name: string;
  content: any;
  isVisible: boolean;
  order: number;
}

interface SortableSectionProps {
  section: ReportSection;
  onVisibilityChange: (id: string, visible: boolean) => void;
  claim: Claim;
}

interface ReportPreviewProps {
  claim: Claim;
}

interface ClaimDocument {
  id: string;
  claim_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
  field_label?: string;
  upload_token?: string;
  token_expires_at?: string;
  is_selected?: boolean;
  uploaded_via_link?: boolean;
}

interface AdditionalInfoSection {
  id: string;
  name: string;
  order: number;
  fields: Array<{ name: string; label: string }>;
}

/* =========================
   Config
========================= */

const API_BASE = "https://mlkkk63swrqairyiahlk357sui0argkn.lambda-url.ap-south-1.on.aws";

/* =========================
   Utilities
========================= */

const labelize = (k: string) =>
  k
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .replace(/_/g, " ");

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/* =========================
   Helper: Check if Section Has Content
========================= */

const sectionHasContent = (section: ReportSection, claim: Claim): boolean => {
  const sectionsData = claim.sections || {};
  const metas = (claim.sections?.dynamic_sections_metadata as any[]) || [];
  const additionalInfoSections = (claim.sections?.additional_info_sections as AdditionalInfoSection[]) || [];

  // Overview always has content
  if (section.id === "overview") {
    return true;
  }

  // Check policy details
  if (section.id === "policy-details") {
    return !!(
      claim.registration_id || 
      claim.insured_name || 
      claim.insurer_name ||
      claim.surveyor_name ||
      claim.policy_number || 
      claim.sum_insured || 
      claim.loss_date || 
      claim.loss_description
    );
  }

  // Check additional information sub-sections
  const additionalInfoSection = additionalInfoSections.find(s => s.id === section.id);
  if (additionalInfoSection) {
    const fields = additionalInfoSection.fields || [];
    
    return fields.some(field => {
      const val = sectionsData[field.name];
      return val != null && String(val).trim() !== "";
    });
  }

  // Check dynamic sections
  const meta = metas.find((m) => m.id === section.id);
  if (!meta) return false;

  const hasFields = meta.fields?.some((f: any) => {
    const val = sectionsData[f.name];
    return val != null && String(val).trim() !== "";
  });

  const imageKey = `${section.id}_images`;
  const hasImages = Array.isArray(sectionsData[imageKey]) && sectionsData[imageKey].some(Boolean);

  const hasTables = meta.tables?.some((table: any) => 
    Array.isArray(table.data) && table.data.length > 0
  );

  return hasFields || hasImages || hasTables;
};

/* =========================
   SortableSection
========================= */

const SortableSection = ({ section, onVisibilityChange, claim }: SortableSectionProps) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const renderSectionContent = (section: ReportSection) => {
    const sectionsData = claim.sections || {};
    const metas = (claim.sections?.dynamic_sections_metadata as any[]) || [];
    const additionalInfoSections = (claim.sections?.additional_info_sections as AdditionalInfoSection[]) || [];

    // --- Static: Overview ---
    if (section.id === "overview") {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Claim Number</p>
              <p className="font-medium">{claim.claim_number}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Policy Type</p>
              <p className="font-medium">{claim.policy_types?.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant="outline">{claim.status.replace("_", " ")}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date Created</p>
              <p className="font-medium">{format(new Date(claim.created_at), "MMM dd, yyyy")}</p>
            </div>
          </div>
        </div>
      );
    }

    // --- Static: Policy Details ---
    if (section.id === "policy-details") {
      const policyData = [
        ["Registration ID", claim.registration_id],
        ["Insured Name", claim.insured_name],
        ["Insurer", claim.insurer_name],
        ["Assigned Surveyor", claim.surveyor_name],
        ["Policy Number", claim.policy_number],
        ["Sum Insured", claim.sum_insured],
        ["Date of Loss", claim.loss_date ? format(new Date(claim.loss_date), "MMM dd, yyyy") : null],
        ["Loss Description", claim.loss_description],
      ].filter(([_, v]) => v != null && String(v).trim() !== "");

      if (policyData.length === 0) return null;

      return (
        <div className="space-y-2">
          {policyData.map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium">{String(value)}</span>
            </div>
          ))}
        </div>
      );
    }

    // --- Additional Information Sub-sections ---
    const additionalInfoSection = additionalInfoSections.find(s => s.id === section.id);
    if (additionalInfoSection) {
      const fields = additionalInfoSection.fields || [];
      
      const fieldData = fields
        .map(field => {
          const value = sectionsData[field.name];
          return { label: field.label, value };
        })
        .filter(({ value }) => value != null && String(value).trim() !== "");

      if (fieldData.length === 0) return null;

      return (
        <div className="space-y-2">
          {fieldData.map(({ label, value }) => (
            <div key={label} className="flex justify-between">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium">{String(value)}</span>
            </div>
          ))}
        </div>
      );
    }

    // --- Dynamic Sections ---
    const meta = metas.find((m) => m.id === section.id);
    if (!meta) return null;

    const entries =
      (meta.fields || [])
        .map((f: any) => ({ label: f.label || labelize(f.name), value: sectionsData[f.name] }))
        .filter(({ value }) => value != null && String(value).trim() !== "");

    const imageKey = `${section.id}_images`;
    const imageUrls = Array.isArray(sectionsData[imageKey]) ? sectionsData[imageKey].filter(Boolean) : [];

    const hasTables = meta?.tables && meta.tables.length > 0;

    if (entries.length === 0 && imageUrls.length === 0 && !hasTables) {
      return null;
    }

    return (
      <div className="space-y-4">
        {entries.length > 0 && (
          <div className="space-y-2">
            {entries.map(({ label, value }) => (
              <div key={label} className="flex justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{String(value)}</span>
              </div>
            ))}
          </div>
        )}

        {imageUrls.length > 0 && (
          <div className="grid grid-cols-2 gap-2 justify-center">
            {imageUrls.map((url: string, i: number) => (
              <img
                key={i}
                src={url}
                alt={`Section ${section.id} image ${i + 1}`}
                className="rounded-md object-contain w-[45%] max-h-[40vh] mx-auto"
              />
            ))}
          </div>
        )}

        {hasTables && (
          <div className="space-y-4 mt-4">
            <h4 className="text-sm font-semibold text-gray-700">Data Tables</h4>
            {meta.tables.map((table: any) => (
              <div key={table.id} className="border rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-3 py-2 font-medium">{table.name || "Unnamed Table"}</div>
                <table className="w-full text-sm border-collapse">
                  <tbody>
                    {Array.isArray(table.data) && table.data.length > 0 ? (
                      table.data.map((row: any[], rowIndex: number) => (
                        <tr key={rowIndex} className="border-t">
                          {row.map((cell: any, colIndex: number) => (
                            <td key={colIndex} className="p-2 border-l">
                              {cell?.value ?? ""}
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="p-2 text-muted-foreground italic">No data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const hasContent = sectionHasContent(section, claim);

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
            <GripVertical className="w-5 h-5 text-muted-foreground" />
          </button>
          <h3 className="font-semibold">{section.name}</h3>
          <Badge variant={section.isVisible ? "default" : "secondary"}>
            {section.isVisible ? "Visible" : "Hidden"}
          </Badge>
          {!hasContent && (
            <Badge variant="outline" className="text-muted-foreground">
              No Data
            </Badge>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Label htmlFor={`visibility-${section.id}`} className="text-sm text-muted-foreground">
            {section.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </Label>
          <Switch
            id={`visibility-${section.id}`}
            checked={section.isVisible}
            onCheckedChange={(checked) => onVisibilityChange(section.id, checked)}
          />
        </div>
      </div>
      {section.isVisible && hasContent && (
        <div className="mt-3">{renderSectionContent(section)}</div>
      )}
      {section.isVisible && !hasContent && (
        <p className="text-sm text-muted-foreground italic mt-3">
          No data available for this section
        </p>
      )}
    </div>
  );
};

/* =========================
   getDynamicSectionsFromClaim
========================= */

function getDynamicSectionsFromClaim(claim: Claim): ReportSection[] {
  const sections: ReportSection[] = [
    { id: "overview", name: "Overview", content: null, isVisible: true, order: 1 },
    { 
      id: "policy-details", 
      name: "Policy Details", 
      content: null, 
      isVisible: sectionHasContent({ id: "policy-details", name: "Policy Details", content: null, isVisible: true, order: 2 }, claim), 
      order: 2 
    },
  ];

  let currentOrder = 3;

  // Add additional information sub-sections
  const additionalInfoSections = (claim.sections?.additional_info_sections as AdditionalInfoSection[]) || [];
  additionalInfoSections.forEach((infoSection) => {
    const section: ReportSection = {
      id: infoSection.id,
      name: infoSection.name,
      content: null,
      isVisible: true,
      order: currentOrder++,
    };
    section.isVisible = sectionHasContent(section, claim);
    sections.push(section);
  });

  // Add dynamic sections
  const metas = (claim.sections?.dynamic_sections_metadata as any[]) || [];
  metas.forEach((meta) => {
    const section: ReportSection = {
      id: meta.id,
      name: meta.name || `Section ${currentOrder}`,
      content: null,
      isVisible: true,
      order: currentOrder++,
    };
    section.isVisible = sectionHasContent(section, claim);
    sections.push(section);
  });

  return sections;
}

/* =========================
   buildReportJson
========================= */

function buildReportJson(
  claim: Claim,
  sections: ReportSection[],
  groupedDocuments: Record<string, ClaimDocument[]>
) {
  const visibleSections = sections
    .filter((s) => s.isVisible && sectionHasContent(s, claim))
    .sort((a, b) => a.order - b.order);
  const components: any[] = [];

  components.push({
    type: "header",
    style: { wrapper: "px-0 py-2", title: "text-3xl font-extrabold tracking-wide text-black center" },
    props: { text: "SURVEY REPORT" },
  });

  const metas = (claim.sections?.dynamic_sections_metadata as any[]) || [];
  const sectionsData = claim.sections || {};
  const additionalInfoSections = (claim.sections?.additional_info_sections as AdditionalInfoSection[]) || [];

  for (const s of visibleSections) {
    components.push({ type: "subheader", props: { text: s.name } });

    // --- Overview ---
    if (s.id === "overview") {
      components.push({
        type: "table",
        props: {
          headers: ["Field", "Value"],
          rows: [
            ["Claim Number", claim.claim_number],
            ["Policy Type", claim.policy_types?.name ?? "-"],
            ["Status", (claim.status || "").replace("_", " ")],
            ["Date Created", format(new Date(claim.created_at), "MMM dd, yyyy")],
          ],
        },
      });
      if (claim.description)
        components.push({ type: "para", props: { text: `Description: ${claim.description}` } });
      continue;
    }

    // --- Policy Details ---
    if (s.id === "policy-details") {
      const policyRows = [
        ["Registration ID", claim.registration_id],
        ["Insured Name", claim.insured_name],
        ["Insurer", claim.insurer_name],
        ["Assigned Surveyor", claim.surveyor_name],
        ["Policy Number", claim.policy_number],
        ["Sum Insured", claim.sum_insured],
        ["Date of Loss", claim.loss_date ? format(new Date(claim.loss_date), "MMM dd, yyyy") : null],
        ["Loss Description", claim.loss_description],
      ].filter(([_, v]) => v != null && String(v).trim() !== "");

      if (policyRows.length > 0) {
        components.push({
          type: "table",
          props: {
            headers: ["Field", "Value"],
            rows: policyRows,
          },
        });
      }
      continue;
    }

    // --- Additional Information Sub-sections ---
    const additionalInfoSection = additionalInfoSections.find(infoSec => infoSec.id === s.id);
    if (additionalInfoSection) {
      const fields = additionalInfoSection.fields || [];
      
      const rows = fields
        .map(field => {
          const value = sectionsData[field.name];
          return [field.label, value];
        })
        .filter(([_, v]) => v != null && String(v).trim() !== "");

      if (rows.length > 0) {
        components.push({
          type: "table",
          props: {
            headers: ["Field", "Value"],
            rows: rows,
          },
        });
      }
      continue;
    }

    // --- Dynamic Sections ---
    const meta = metas.find((m) => m.id === s.id);
    if (meta) {
      const pairs: [string, any][] = [];

      if (meta.fields?.length) {
        meta.fields.forEach((f: any) => {
          const val = sectionsData[f.name];
          if (val != null && String(val).trim() !== "") {
            pairs.push([f.label || labelize(f.name), val]);
          }
        });
      }

      if (pairs.length > 0) {
        components.push({
          type: "table",
          props: {
            headers: ["Field", "Value"],
            rows: pairs,
          },
        });
      }

      const imageKey = `${s.id}_images`;
      const urls = Array.isArray(sectionsData[imageKey]) ? sectionsData[imageKey].filter(Boolean) : [];
      if (urls.length > 0) {
        components.push({
          type: "image-grid",
          props: { title: "Images", rows: [urls.slice(0, 2), urls.slice(2, 4)] },
        });
      }

      if (meta?.tables?.length) {
        meta.tables.forEach((table: any) => {
          components.push({
            type: "table",
            props: {
              title: table.name || "Table",
              headers: [],
              rows: table.data?.map((r: any) => r.map((c: any) => c?.value ?? "")) || [],
            },
          });
        });
      }
    }
  }

  if (Object.keys(groupedDocuments || {}).length > 0) {
    const rows: string[][] = [];
    Object.entries(groupedDocuments).forEach(([label, docs]) => {
      rows.push([`— ${label} —`, ""]);
      docs.forEach((d) => {
        rows.push([
          d.file_name,
          `${d.file_type} • ${formatFileSize(d.file_size)} • Uploaded ${format(
            new Date(d.created_at),
            "MMM dd, yyyy"
          )}`,
        ]);
      });
    });
    components.push({ type: "subheader", props: { text: "Supporting Documents" } });
    components.push({ type: "table", props: { headers: ["File", "Details"], rows } });
  }

  return {
    company: claim.policy_types?.name || "Insurance Company",
    reportName: `Claim Report - ${claim.claim_number}`,
    assets: {
      firstPageBackground: "https://ik.imagekit.io/pritvik/Reports%20-%20generic%20bg.png?updatedAt=1763381793043",
      otherPagesBackground: "https://ik.imagekit.io/pritvik/Reports%20-%20generic%20footer%20only%20bg",
    },
    components,
  };
}

/* =========================
   ReportPreview
========================= */

export const ReportPreview = ({ claim }: ReportPreviewProps) => {
  const { data: documents } = useQuery({
    queryKey: ["claim-documents", claim.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("claim_documents")
        .select("*")
        .eq("claim_id", claim.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      const filteredDocs = (data as ClaimDocument[]).filter(
        doc => !doc.file_name.startsWith("__TOKEN_PLACEHOLDER_") && doc.is_selected === true
      );
      
      return filteredDocs;
    },
  });

  const groupedDocuments =
    documents?.reduce((acc, doc) => {
      const label = doc.field_label || "Uncategorized";
      if (!acc[label]) acc[label] = [];
      acc[label].push(doc);
      return acc;
    }, {} as Record<string, ClaimDocument[]>) || {};

  const [sections, setSections] = useState<ReportSection[]>(() => getDynamicSectionsFromClaim(claim));
  const [includeHeader, setIncludeHeader] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSections((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        return newItems.map((item, index) => ({ ...item, order: index + 1 }));
      });
    }
  };

  const handleVisibilityChange = (id: string, visible: boolean) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, isVisible: visible } : s)));
  };

  const handlePreview = async () => {
    const payload = buildReportJson(claim, sections, groupedDocuments);
    
    payload.assets = {
      firstPageBackground: includeHeader 
        ? "https://ik.imagekit.io/pritvik/Reports%20-%20generic%20bg.png?updatedAt=1763381793043" 
        : "https://ik.imagekit.io/pritvik/Reports%20-%20generic%20footer%20only%20bg",
      otherPagesBackground: "https://ik.imagekit.io/pritvik/Reports%20-%20generic%20footer%20only%20bg",
    };
    
    const res = await fetch(`${API_BASE}/render.pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("PDF API error:", err);
      throw new Error(err || "PDF failed");
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const handleDownload = async () => {
    const payload = buildReportJson(claim, sections, groupedDocuments);
    
    payload.assets = {
      firstPageBackground: includeHeader 
        ? "https://ik.imagekit.io/pritvik/Reports%20-%20generic%20bg.png?updatedAt=1763381793043" 
        : "https://ik.imagekit.io/pritvik/Reports%20-%20generic%20footer%20only%20bg",
      otherPagesBackground: "https://ik.imagekit.io/pritvik/Reports%20-%20generic%20footer%20only%20bg",
    };
    
    const res = await fetch(`${API_BASE}/render.pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("PDF API error:", err);
      throw new Error(err || "PDF failed");
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "report.pdf";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>Report Layout Builder</CardTitle>
          <p className="text-sm text-muted-foreground">Drag sections to reorder and toggle visibility</p>
        </CardHeader>
        <CardContent>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-4">
                {sections.map((section) => (
                  <SortableSection
                    key={section.id}
                    section={section}
                    onVisibilityChange={handleVisibilityChange}
                    claim={claim}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="mt-6 pt-4 border-t">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <Label htmlFor="header-toggle" className="text-sm font-medium">
                  Include Header on First Page
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Toggle to show or hide the header section on the first page
                </p>
              </div>
              <Switch
                id="header-toggle"
                checked={includeHeader}
                onCheckedChange={setIncludeHeader}
              />
            </div>
          </div>

          <div className="mt-6 pt-4 border-t grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button variant="secondary" onClick={handlePreview}>
              Preview
            </Button>
            <Button onClick={handleDownload}>Download PDF</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};