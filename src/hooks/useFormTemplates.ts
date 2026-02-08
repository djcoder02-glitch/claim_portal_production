import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TemplateField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox';
  required: boolean;
  options?: string[];
  order_index: number;
}

export interface TemplateSection {
  id: string;
  name: string;
  order_index: number;
  color_class: string;
  tables?: TableData[];
  fields: TemplateField[];
}

export interface FormTemplate {
  id: string;
  name: string;
  description?: string;
  policy_type_id?: string;
  is_default: boolean;
  created_at: string;
  sections: TemplateSection[];
}

export interface TableCell {
  value: string;
}

export interface TableData {
  id: string;
  name: string;
  data: TableCell[][];
  createdAt?: string;
  updatedAt?: string;
}

export interface DynamicSection {
  id: string;
  name: string;
  order_index: number;
  color_class: string;
  fields: TemplateField[];
  isCustom: boolean;
  tables?:TableData[];
}


export const useFormTemplates = (policyTypeId?: string) => {
  return useQuery({
    queryKey: ["form-templates", policyTypeId],
    queryFn: async () => {
      try {
        // Step 1: Get templates
        let templatesQuery = supabase
          .from('form_templates')
          .select('*')
          .order('created_at', { ascending: false });

        if (policyTypeId) {
          templatesQuery = templatesQuery.eq('policy_type_id', policyTypeId);
        }

        const { data: templates, error: templatesError } = await templatesQuery;
        if (templatesError) throw templatesError;
        if (!templates || templates.length === 0) return [];

        // Step 2: Get sections for these templates
        const templateIds = templates.map(t => t.id);
        const { data: sections, error: sectionsError } = await supabase
          .from('template_sections')
          .select('*')
          .in('template_id', templateIds)
          .order('order_index');

        if (sectionsError) throw sectionsError;

        // Step 3: Get fields for these sections
        const sectionIds = sections?.map(s => s.id) || [];
        const { data: fields, error: fieldsError } = sectionIds.length > 0
          ? await supabase
              .from('template_fields')
              .select('*')
              .in('section_id', sectionIds)
              .order('order_index')
          : { data: [], error: null };

        if (fieldsError) throw fieldsError;

       // Step 4: Combine data with correct column mappings
        const result = templates.map(template => ({
          ...template,
          sections: sections
            ?.filter(s => s.template_id === template.id)
            .map(section => ({
              id: section.id,
              name: section.name,
              order_index: section.order_index || 0,
              color_class: (section as any).color_class || 'bg-blue-50',
              tables: (section as any).tables_data || [],
              fields: fields
                ?.filter(f => f.section_id === section.id)
                .map(field => ({
                  id: field.id,
                  name: (field as any).field_name || field.name,
                  label: (field as any).field_label || (field as any).label || '',
                  type: (field as any).field_type || (field as any).type || 'text',
                  required: (field as any).is_required ?? false,
                  options: field.options ? (Array.isArray(field.options) ? field.options : []) : undefined,
                  order_index: field.order_index || 0
                })) || []
            })) || []
        }));

        return result as FormTemplate[];
      } catch (err) {
        console.error('Failed to fetch templates:', err);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
};

export const useSaveTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      description,
      policyTypeId,
      sections
    }: {
      name: string;
      description?: string;
      policyTypeId?: string;
      sections: DynamicSection[];
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data: template, error: templateError } = await supabase
        .from('form_templates')
        .insert({
          name,
          description,
          policy_type_id: policyTypeId,
          created_by: userData.user?.id
        })
        .select()
        .single();

      if (templateError) throw templateError;

      for (const section of sections) {
        const { data: templateSection, error: sectionError } = await supabase
          .from('template_sections')
          .insert({
            template_id: template.id,
            name: section.name,
            order_index: section.order_index,
            color_class: section.color_class,
            tables_data: section.tables && section.tables.length > 0 ? section.tables : null

          })
          .select()
          .single();

        if (sectionError) throw sectionError;

        if (section.fields.length > 0) {
          const fieldsToInsert = section.fields.map(field => ({
            section_id: templateSection.id,
            name: field.name,
            label: field.label,
            type: field.type,
            required: field.required,
            options: field.options ? field.options : null,
            order_index: field.order_index
          }));

          const { error: fieldsError } = await supabase
            .from('template_fields')
            .insert(fieldsToInsert);

          if (fieldsError) throw fieldsError;
        }
      }

      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-templates"] });
      toast.success("Template saved successfully!");
    },
    onError: (error) => {
      console.error('Save template error:', error);
      toast.error("Failed to save template: " + error.message);
    },
  });
};

export const useDeleteTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('form_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-templates"] });
      toast.success("Template deleted successfully!");
    },
    onError: (error) => {
      console.error('Delete template error:', error);
      toast.error("Failed to delete template: " + error.message);
    },
  });
};


export const useUpdateTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      templateId,
      name,
      description,
      policyTypeId,
      sections
    }: {
      templateId: string;
      name: string;
      description?: string;
      policyTypeId?: string;
      sections: DynamicSection[];
    }) => {
      // Delete old sections and fields
      const { error: deleteSectionsError } = await supabase
        .from('template_sections')
        .delete()
        .eq('template_id', templateId);

      if (deleteSectionsError) throw deleteSectionsError;

      // Update template name and description
      const { data: template, error: templateError } = await supabase
        .from('form_templates')
        .update({
          name,
          description,
          policy_type_id: policyTypeId,
        })
        .eq('id', templateId)
        .select()
        .single();

      if (templateError) throw templateError;

      // Insert new sections
      for (const section of sections) {
        const { data: templateSection, error: sectionError } = await supabase
          .from('template_sections')
          .insert({
            template_id: template.id,
            name: section.name,
            order_index: section.order_index,
            color_class: section.color_class,
            tables_data: section.tables && section.tables.length > 0 ? section.tables : null
          })
          .select()
          .single();

        if (sectionError) throw sectionError;

        if (section.fields.length > 0) {
          const fieldsToInsert = section.fields.map(field => ({
            section_id: templateSection.id,
            name: field.name,
            label: field.label,
            type: field.type,
            required: field.required,
            options: field.options ? field.options : null,
            order_index: field.order_index
          }));

          const { error: fieldsError } = await supabase
            .from('template_fields')
            .insert(fieldsToInsert);

          if (fieldsError) throw fieldsError;
        }
      }

      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-templates"] });
      toast.success("Template updated successfully!");
    },
    onError: (error) => {
      console.error('Update template error:', error);
      toast.error("Failed to update template: " + error.message);
    },
  });
};