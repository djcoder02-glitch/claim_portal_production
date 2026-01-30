import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Company {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyRestrictions {
  id: string;
  company_id: string;
  max_claims_per_month: number;
  max_active_claims: number;
  max_users: number;
  max_surveyors: number;
  max_storage_gb: number;
  max_documents_per_claim: number;
  can_access_vas: boolean;
  can_access_client_reports: boolean;
  max_ai_extractions_per_month: number;
  max_file_size_mb: number;
  max_total_claim_size_mb: number;
  current_storage_gb: number;
  current_ai_extractions_this_month: number;
  last_reset_date: string;
  created_at: string;
  updated_at: string;
}

export interface CompanyWithStats extends Company {
  restrictions?: CompanyRestrictions;
  stats?: {
    total_users: number;
    active_users: number;
    pending_users: number;
    total_claims: number;
    active_claims: number;
  };
}

export const useCompanies = () => {
  return useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data: companies, error } = await supabase
        .from("companies")
        .select(`
          *,
          company_restrictions(*)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch stats for each company
      const companiesWithStats = await Promise.all(
        (companies || []).map(async (company) => {
          // Get user counts
          const { data: users } = await supabase
            .from("users")
            .select("id, status")
            .eq("company_id", company.id);

          const total_users = users?.length || 0;
          const active_users = users?.filter(u => u.status === 'active').length || 0;
          const pending_users = users?.filter(u => u.status === 'pending').length || 0;

          // Get claim counts
          const { data: claims } = await supabase
            .from("claims")
            .select("id, status")
            .eq("company_id", company.id);

          const total_claims = claims?.length || 0;
          const active_claims = claims?.filter(c => 
            c.status !== 'approved' && c.status !== 'closed' && c.status !== 'rejected'
          ).length || 0;

          return {
            ...company,
            restrictions: Array.isArray(company.company_restrictions) 
          ? company.company_restrictions[0] 
          : company.company_restrictions,
            stats: {
              total_users,
              active_users,
              pending_users,
              total_claims,
              active_claims,
            },
          };
        })
      );

      return companiesWithStats as CompanyWithStats[];
    },
    staleTime: 30000, // 30 seconds
  });
};

export const useCompanyById = (companyId: string) => {
  return useQuery({
    queryKey: ["company", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select(`
          *,
          company_restrictions(*)
        `)
        .eq("id", companyId)
        .single();

      if (error) throw error;

      return {
        ...data,
        restrictions: Array.isArray(data.company_restrictions) 
          ? data.company_restrictions[0] 
          : data.company_restrictions,
      } as CompanyWithStats;
    },
    enabled: !!companyId,
  });
};

export const useCreateCompany = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (companyData: {
      name: string;
      email?: string;
      phone?: string;
      address?: string;
    }) => {
      const { data, error } = await supabase
        .from("companies")
        .insert({
          name: companyData.name,
          email: companyData.email || null,
          phone: companyData.phone || null,
          address: companyData.address || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Restrictions are auto-created by trigger, but we can verify
      const { data: restrictions } = await supabase
        .from("company_restrictions")
        .select()
        .eq("company_id", data.id)
        .single();

      if (!restrictions) {
        console.warn("Restrictions not auto-created, creating manually");
        await supabase
          .from("company_restrictions")
          .insert({ company_id: data.id });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Company created successfully!");
    },
    onError: (error) => {
      toast.error("Failed to create company: " + error.message);
    },
  });
};

export const useUpdateCompany = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Company>;
    }) => {
      const { data, error } = await supabase
        .from("companies")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["company"] });
      toast.success("Company updated successfully!");
    },
    onError: (error) => {
      toast.error("Failed to update company: " + error.message);
    },
  });
};

export const useUpdateCompanyRestrictions = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      company_id,
      restrictions,
    }: {
      company_id: string;
      restrictions: Partial<CompanyRestrictions>;
    }) => {
      const { data, error } = await supabase
        .from("company_restrictions")
        .update(restrictions)
        .eq("company_id", company_id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["company"] });
      toast.success("Restrictions updated successfully!");
    },
    onError: (error) => {
      toast.error("Failed to update restrictions: " + error.message);
    },
  });
};

export const useDeleteCompany = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (companyId: string) => {
      const { error } = await supabase
        .from("companies")
        .delete()
        .eq("id", companyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Company deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete company: " + error.message);
    },
  });
};