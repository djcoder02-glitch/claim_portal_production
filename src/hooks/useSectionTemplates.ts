import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SectionTemplateField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox';
  required: boolean;
  options?: string[];
  order_index: number;
}

export interface SectionTemplate {
  id: string;
  name: string;
  description?: string;
  color_class: string;
  preset_fields: SectionTemplateField[];
  parent_policy_type_id?: string;
  is_default: boolean;
  created_at: string;
}

export const useSectionTemplates = (policyTypeId?: string) => {
  return useQuery<SectionTemplate[]>({
    queryKey: ["section-templates", policyTypeId],
    queryFn: async () => {
      if (!policyTypeId) return [];
      
      const { data: policyType, error: policyError } = await supabase
        .from('policy_types')
        .select('id, parent_id')
        .eq('id', policyTypeId)
        .single();
      
      if (policyError) {
        console.error('Error fetching policy type:', policyError);
        return [];
      }
      
      const parentId = policyType.parent_id || policyType.id;
      
      const { data, error } = await supabase
        .from('section_templates')
        .select('*')
        .or(`parent_policy_type_id.eq.${parentId},parent_policy_type_id.is.null`)
        .order('is_default', { ascending: false })
        .order('name');
      
      if (error) {
        console.error('Error fetching templates:', error);
        return [];
      }
      
      // Cast to unknown first, then to SectionTemplate[] to satisfy TypeScript
      return (data || []) as unknown as SectionTemplate[];
    },
    enabled: !!policyTypeId,
  });
};
