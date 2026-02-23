import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Plus, Globe, FileText, ChevronDown, ChevronUp, X, Edit2, Check } from "lucide-react";
import { useSaveTemplate, useUpdateTemplate, useDeleteTemplate, type DynamicSection, type TemplateField } from "@/hooks/useFormTemplates";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

// ── Types ──────────────────────────────────────────────
type FieldType = 'text' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox';

interface EditingSection {
  id: string;
  name: string;
  color_class: string;
  order_index: number;
  fields: TemplateField[];
  isCustom: boolean;
  tables?: any[];
}

// ── Field Editor Component ─────────────────────────────
const FieldEditor = ({
  field,
  onUpdate,
  onRemove,
}: {
  field: TemplateField;
  onUpdate: (updates: Partial<TemplateField>) => void;
  onRemove: () => void;
}) => {
  const [optionInput, setOptionInput] = useState("");

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-white">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Field name (e.g. invoice_no)"
          value={field.name}
          onChange={e => onUpdate({ name: e.target.value })}
          className="flex-1 text-sm"
        />
        <Input
          placeholder="Label (e.g. Invoice No)"
          value={field.label}
          onChange={e => onUpdate({ label: e.target.value })}
          className="flex-1 text-sm"
        />
        <Select value={field.type} onValueChange={v => onUpdate({ type: v as FieldType })}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="number">Number</SelectItem>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="textarea">Textarea</SelectItem>
            <SelectItem value="select">Select</SelectItem>
            <SelectItem value="checkbox">Checkbox</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Checkbox
            checked={field.required}
            onCheckedChange={v => onUpdate({ required: !!v })}
          />
          <span className="text-xs text-gray-500">Req</span>
        </div>
        <Button size="sm" variant="ghost" className="text-red-500" onClick={onRemove}>
          <X className="w-3 h-3" />
        </Button>
      </div>
      {field.type === 'select' && (
        <div className="space-y-1">
          <div className="flex gap-2">
            <Input
              placeholder="Add option..."
              value={optionInput}
              onChange={e => setOptionInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && optionInput.trim()) {
                  onUpdate({ options: [...(field.options || []), optionInput.trim()] });
                  setOptionInput("");
                }
              }}
              className="text-xs"
            />
            <Button size="sm" variant="outline" onClick={() => {
              if (optionInput.trim()) {
                onUpdate({ options: [...(field.options || []), optionInput.trim()] });
                setOptionInput("");
              }
            }}>Add</Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {(field.options || []).map((opt, i) => (
              <Badge key={i} variant="secondary" className="gap-1 text-xs">
                {opt}
                <X className="w-2 h-2 cursor-pointer" onClick={() =>
                  onUpdate({ options: field.options?.filter((_, idx) => idx !== i) })
                } />
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Section Editor Component ───────────────────────────
const SectionEditor = ({
  section,
  onUpdate,
  onRemove,
}: {
  section: EditingSection;
  onUpdate: (updates: Partial<EditingSection>) => void;
  onRemove: () => void;
}) => {
  const [expanded, setExpanded] = useState(true);

  const addField = () => {
    const newField: TemplateField = {
      id: `field-${Date.now()}`,
      name: "",
      label: "",
      type: "text",
      required: false,
      order_index: section.fields.length,
    };
    onUpdate({ fields: [...section.fields, newField] });
  };

  const updateField = (idx: number, updates: Partial<TemplateField>) => {
    const updated = section.fields.map((f, i) => i === idx ? { ...f, ...updates } : f);
    onUpdate({ fields: updated });
  };

  const removeField = (idx: number) => {
    onUpdate({ fields: section.fields.filter((_, i) => i !== idx) });
  };

  return (
    <div className="border-2 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-slate-100">
        <div className="flex items-center gap-2 flex-1">
          <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)} className="p-1">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          <Input
            value={section.name}
            onChange={e => onUpdate({ name: e.target.value })}
            placeholder="Section name"
            className="text-sm font-medium bg-white w-48"
          />
          <Badge variant="outline" className="text-xs">{section.fields.length} fields</Badge>
        </div>
        <Button size="sm" variant="ghost" className="text-red-500" onClick={onRemove}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      {expanded && (
        <div className="p-3 space-y-2 bg-gray-50">
          {section.fields.map((field, idx) => (
            <FieldEditor
              key={field.id}
              field={field}
              onUpdate={updates => updateField(idx, updates)}
              onRemove={() => removeField(idx)}
            />
          ))}
          <Button size="sm" variant="outline" onClick={addField} className="w-full gap-2">
            <Plus className="w-3 h-3" />
            Add Field
          </Button>
        </div>
      )}
    </div>
  );
};

// ── Template Builder Dialog ────────────────────────────
const TemplateBuilderDialog = ({
  open,
  onClose,
  globalPolicyTypes,
  editingTemplate,
}: {
  open: boolean;
  onClose: () => void;
  globalPolicyTypes: any[];
  editingTemplate?: any;
}) => {
  const queryClient = useQueryClient();
  const saveTemplate = useSaveTemplate();
  const updateTemplate = useUpdateTemplate();

  const [templateName, setTemplateName] = useState(editingTemplate?.name || "");
  const [templateDesc, setTemplateDesc] = useState(editingTemplate?.description || "");
  const [policyTypeId, setPolicyTypeId] = useState(editingTemplate?.policy_type_id || "");
  const [sections, setSections] = useState<EditingSection[]>([]);

  const addSection = () => {
    setSections(prev => [...prev, {
      id: `section-${Date.now()}`,
      name: "New Section",
      color_class: "bg-blue-50",
      order_index: prev.length,
      fields: [],
      isCustom: true,
      tables: [],
    }]);
  };

  const updateSection = (idx: number, updates: Partial<EditingSection>) => {
    setSections(prev => prev.map((s, i) => i === idx ? { ...s, ...updates } : s));
  };

  const removeSection = (idx: number) => {
    setSections(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!templateName.trim()) { toast.error("Template name required"); return; }

    const sectionsToSave: DynamicSection[] = sections.map(s => ({
      ...s,
      isCustom: true,
    }));

    try {
      if (editingTemplate) {
        await updateTemplate.mutateAsync({
          templateId: editingTemplate.id,
          name: templateName,
          description: templateDesc,
          policyTypeId: policyTypeId || undefined,
          sections: sectionsToSave,
        });
      } else {
        await saveTemplate.mutateAsync({
          name: templateName,
          description: templateDesc,
          policyTypeId: policyTypeId || undefined,
          sections: sectionsToSave,
          isGlobal: true,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["global-form-templates"] });
      queryClient.invalidateQueries({ queryKey: ["form-templates"] });
      onClose();
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingTemplate ? "Edit" : "Create"} Global Form Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Template meta */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Template Name *</Label>
              <Input
                placeholder="e.g. Marine Cargo Standard"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Link to Policy Type</Label>
              <Select
                value={policyTypeId || "none"}
                onValueChange={v => setPolicyTypeId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select policy type (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific policy type</SelectItem>
                  {globalPolicyTypes.map((pt: any) => (
                    <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Input
              placeholder="Brief description of this template"
              value={templateDesc}
              onChange={e => setTemplateDesc(e.target.value)}
            />
          </div>

          {/* Sections */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Sections</Label>
              <Button size="sm" onClick={addSection} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Section
              </Button>
            </div>
            {sections.length === 0 && (
              <div className="border-2 border-dashed rounded-lg p-8 text-center text-gray-400">
                No sections yet. Click "Add Section" to start building.
              </div>
            )}
            {sections.map((section, idx) => (
              <SectionEditor
                key={section.id}
                section={section}
                onUpdate={updates => updateSection(idx, updates)}
                onRemove={() => removeSection(idx)}
              />
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveTemplate.isPending || updateTemplate.isPending}>
              {saveTemplate.isPending || updateTemplate.isPending ? "Saving..." : "Save Template"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ── Global Section Template Builder ───────────────────
const SectionTemplateBuilder = ({ globalPolicyTypes }: { globalPolicyTypes: any[] }) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [policyTypeId, setPolicyTypeId] = useState("");
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: globalSectionTemplates = [] } = useQuery({
    queryKey: ["global-section-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("section_templates")
        .select("*")
        .eq("is_global", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addField = () => {
    setFields(prev => [...prev, {
      id: `f-${Date.now()}`,
      name: "",
      label: "",
      type: "text" as FieldType,
      required: false,
      order_index: prev.length,
    }]);
  };

  const updateField = (idx: number, updates: Partial<TemplateField>) => {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, ...updates } : f));
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Section name required"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("section_templates").insert({
        name,
        description: desc || null,
        parent_policy_type_id: policyTypeId || null,
        color_class: "bg-blue-50",
        preset_fields: fields,
        is_global: true,
        is_default: false,
      });
      if (error) throw error;
      toast.success("Global section template saved!");
      setName(""); setDesc(""); setPolicyTypeId(""); setFields([]);
      queryClient.invalidateQueries({ queryKey: ["global-section-templates"] });
      queryClient.invalidateQueries({ queryKey: ["section-templates"] });
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, templateName: string) => {
    if (!confirm(`Delete "${templateName}"?`)) return;
    await supabase.from("section_templates").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["global-section-templates"] });
    toast.success("Deleted");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Global Section Templates</CardTitle>
          <CardDescription>
            Reusable sections available to all companies when building forms.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border rounded-lg p-4 space-y-3 bg-slate-50">
            <h3 className="font-semibold">Create New Section Template</h3>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Section name" value={name} onChange={e => setName(e.target.value)} />
              <Select value={policyTypeId || "none"} onValueChange={v => setPolicyTypeId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Policy type (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All policy types</SelectItem>
                  {globalPolicyTypes.map((pt: any) => (
                    <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Fields</span>
                <Button size="sm" variant="outline" onClick={addField}>
                  <Plus className="w-3 h-3 mr-1" /> Add Field
                </Button>
              </div>
              {fields.map((field, idx) => (
                <FieldEditor
                  key={field.id}
                  field={field}
                  onUpdate={updates => updateField(idx, updates)}
                  onRemove={() => setFields(prev => prev.filter((_, i) => i !== idx))}
                />
              ))}
            </div>
            <Button onClick={handleSave} disabled={saving}>
              <Plus className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Save Section Template"}
            </Button>
          </div>

          {/* List */}
          <div className="space-y-2">
            {globalSectionTemplates.map((st: any) => (
              <div key={st.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span className="font-medium">{st.name}</span>
                  <Badge className="bg-green-100 text-green-700 text-xs">Global</Badge>
                  {st.preset_fields?.length > 0 && (
                    <Badge variant="secondary" className="text-xs">{st.preset_fields.length} fields</Badge>
                  )}
                  {st.description && <span className="text-xs text-gray-500">{st.description}</span>}
                </div>
                <Button size="sm" variant="ghost" className="text-red-600"
                  onClick={() => handleDelete(st.id, st.name)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {globalSectionTemplates.length === 0 && (
              <p className="text-center text-gray-500 py-6">No global section templates yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────
export const GlobalTemplatesManager = () => {
  const queryClient = useQueryClient();
  const deleteTemplate = useDeleteTemplate();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);

  const { data: globalTemplates = [] } = useQuery({
    queryKey: ["global-form-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_templates")
        .select("*")
        .eq("is_global", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: globalPolicyTypes = [] } = useQuery({
    queryKey: ["global-policy-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("policy_types")
        .select("*")
        .is("company_id", null)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const [newSubtype, setNewSubtype] = useState({ name: "", code: "", description: "", parent_id: "" });
  const [addingSubtype, setAddingSubtype] = useState(false);

  const globalMainTypes = globalPolicyTypes.filter((pt: any) => !pt.parent_id);
  const getSubtypes = (parentId: string) => globalPolicyTypes.filter((pt: any) => pt.parent_id === parentId);

  const handleAddSubtype = async () => {
    if (!newSubtype.name.trim()) { toast.error("Name is required"); return; }
    setAddingSubtype(true);
    try {
      const { error } = await supabase.from("policy_types").insert({
        name: newSubtype.name,
        code: newSubtype.code || null,
        description: newSubtype.description || null,
        parent_id: newSubtype.parent_id || null,
        company_id: null,
        is_active: true,
      });
      if (error) throw error;
      toast.success("Global policy type added!");
      setNewSubtype({ name: "", code: "", description: "", parent_id: "" });
      queryClient.invalidateQueries({ queryKey: ["global-policy-types"] });
      queryClient.invalidateQueries({ queryKey: ["policy-types"] });
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    } finally {
      setAddingSubtype(false);
    }
  };

  const handleDeleteSubtype = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    await supabase.from("policy_types").update({ is_active: false }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["global-policy-types"] });
    queryClient.invalidateQueries({ queryKey: ["policy-types"] });
    toast.success("Deleted");
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="subtypes">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="subtypes">
            <Globe className="w-4 h-4 mr-2" />
            Policy Types
          </TabsTrigger>
          <TabsTrigger value="templates">
            <FileText className="w-4 h-4 mr-2" />
            Form Templates
          </TabsTrigger>
          <TabsTrigger value="section-templates">
            <FileText className="w-4 h-4 mr-2" />
            Section Templates
          </TabsTrigger>
        </TabsList>

        {/* ── Policy Types Tab ── */}
        <TabsContent value="subtypes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Global Policy Types & Subtypes</CardTitle>
              <CardDescription>Visible to ALL companies.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-lg p-4 space-y-3 bg-slate-50">
                <h3 className="font-semibold">Add New Global Policy Type</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Name (e.g. LMV, HMV, Fire)" value={newSubtype.name}
                    onChange={e => setNewSubtype(p => ({ ...p, name: e.target.value }))} />
                  <Input placeholder="Code (e.g. LMV)" value={newSubtype.code}
                    onChange={e => setNewSubtype(p => ({ ...p, code: e.target.value }))} />
                </div>
                <Input placeholder="Description" value={newSubtype.description}
                  onChange={e => setNewSubtype(p => ({ ...p, description: e.target.value }))} />
                <Select value={newSubtype.parent_id || "none"}
                  onValueChange={v => setNewSubtype(p => ({ ...p, parent_id: v === "none" ? "" : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Parent type (leave empty for main type)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Main Type)</SelectItem>
                    {globalMainTypes.map((pt: any) => (
                      <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAddSubtype} disabled={addingSubtype}>
                  <Plus className="w-4 h-4 mr-2" />
                  {addingSubtype ? "Adding..." : "Add Global Policy Type"}
                </Button>
              </div>

              <div className="space-y-3">
                {globalMainTypes.map((mainType: any) => (
                  <Card key={mainType.id} className="border-2">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{mainType.name}</span>
                          {mainType.code && <Badge variant="outline">{mainType.code}</Badge>}
                          <Badge className="bg-green-100 text-green-700 text-xs">Global</Badge>
                        </div>
                        <Button size="sm" variant="ghost" className="text-red-600"
                          onClick={() => handleDeleteSubtype(mainType.id, mainType.name)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      {mainType.description && <p className="text-sm text-gray-500 mb-2">{mainType.description}</p>}
                      <div className="ml-4 space-y-2">
                        {getSubtypes(mainType.id).map((sub: any) => (
                          <div key={sub.id} className="flex items-center justify-between p-2 border rounded-lg">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{sub.name}</span>
                              {sub.code && <Badge variant="secondary" className="text-xs">{sub.code}</Badge>}
                            </div>
                            <Button size="sm" variant="ghost" className="text-red-600"
                              onClick={() => handleDeleteSubtype(sub.id, sub.name)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {globalMainTypes.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No global policy types yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Form Templates Tab ── */}
        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Global Form Templates</CardTitle>
                  <CardDescription>Templates with sections and fields, visible to all companies.</CardDescription>
                </div>
                <Button onClick={() => { setEditingTemplate(null); setBuilderOpen(true); }} className="gap-2">
                  <Plus className="w-4 h-4" />
                  New Template
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {globalTemplates.map((template: any) => (
                  <div key={template.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">{template.name}</span>
                      <Badge className="bg-green-100 text-green-700 text-xs">Global</Badge>
                      {template.description && (
                        <span className="text-xs text-gray-500">{template.description}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline"
                        onClick={() => { setEditingTemplate(template); setBuilderOpen(true); }}>
                        <Edit2 className="w-3 h-3 mr-1" /> Edit
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600"
                        onClick={() => deleteTemplate.mutate(template.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {globalTemplates.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No global templates yet. Click "New Template" to create one.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Section Templates Tab ── */}
        <TabsContent value="section-templates" className="space-y-4">
          <SectionTemplateBuilder globalPolicyTypes={globalPolicyTypes} />
        </TabsContent>
      </Tabs>

      <TemplateBuilderDialog
        open={builderOpen}
        onClose={() => { setBuilderOpen(false); setEditingTemplate(null); }}
        globalPolicyTypes={globalPolicyTypes}
        editingTemplate={editingTemplate}
      />
    </div>
  );
};