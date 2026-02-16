import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CompanyStorageUsage {
  id: string;
  company_id: string;
  total_bytes: number;
  document_count: number;
  last_updated: string;
  company_name?: string;
}

export const useStorageUsage = (companyId?: string) => {
  return useQuery({
    queryKey: ["storage-usage", companyId],
    queryFn: async () => {
      let query = supabase
        .from('company_storage_usage')
        .select(`
          *,
          companies!inner(name)
        `);

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Storage usage query error:', error);
        return [];
      }

      return (data || []).map(item => ({
        ...item,
        company_name: (item.companies as any)?.name
      })) as CompanyStorageUsage[];
    },
    staleTime: 30 * 1000,
    retry: false,
  });
};

export const useCompanyStorageUsage = () => {
  return useQuery({
    queryKey: ["company-storage-usage"],
    queryFn: async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        
        if (userError || !userData.user?.id) {
          console.log('No authenticated user');
          return null;
        }

        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('company_id')
          .eq('id', userData.user.id)
          .single();

        if (profileError || !userProfile?.company_id) {
          console.log('No company_id found for user');
          return null;
        }

        console.log('Fetching storage for company:', userProfile.company_id);

        const { data, error } = await supabase
          .from('company_storage_usage')
          .select('*')
          .eq('company_id', userProfile.company_id)
          .maybeSingle();

        if (error) {
          console.error('Storage query error:', error);
          return null;
        }

        console.log('Storage data:', data);

        return data;
      } catch (error) {
        console.error('Unexpected error in storage query:', error);
        return null;
      }
    },
    staleTime: 30 * 1000,
    retry: false,
    // Don't throw errors, just return null
    throwOnError: false,
  });
};

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};