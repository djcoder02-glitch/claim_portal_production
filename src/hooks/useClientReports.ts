import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";

export interface ClientReport {
  id: string;
  user_id: string;
  company_id: string;
  address_id: string | null;
  report_number: string;
  title: string;
  description: string | null;
  status: string;
  report_amount: number | null;
  intimation_date: string | null;
  sections: Record<string, unknown>;
  surveyor_name: string | null;
  surveyor_id: string | null;
  created_at: string;
  updated_at: string;
  company_name?: string;
  company_code?: string;
  address_label?: string;
  full_address?: string;
}

export const useClientReports = () => {
  const { isAdmin } = useAuth();
  
  return useQuery<ClientReport[]>({
    queryKey: ["client-reports", isAdmin ? "admin" : "user"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_reports")
        .select(`
          *,
          client_companies(company_name, company_code),
          client_addresses(address_label, full_address, city, state)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      return (data || []).map(report => ({
        ...report,
        company_name: report.client_companies?.company_name,
        company_code: report.client_companies?.company_code,
        address_label: report.client_addresses?.address_label,
        full_address: report.client_addresses?.full_address
      })) as ClientReport[];
    },
  });
};

export const useClientReportById = (id: string) => {
  const { isAdmin } = useAuth();
  
  return useQuery<ClientReport>({
    queryKey: ["client-report", id, isAdmin ? "admin" : "user"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_reports")
        .select(`
          *,
          client_companies(company_name, company_code),
          client_addresses(address_label, full_address, city, state, pincode)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      
      return {
        ...data,
        company_name: data.client_companies?.company_name,
        company_code: data.client_companies?.company_code,
        address_label: data.client_addresses?.address_label,
        full_address: data.client_addresses?.full_address
      } as ClientReport;
    },
  });
};

export const useCreateClientReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reportData: {
      company_id: string;
      address_id?: string;
      title: string;
      report_amount?: number;
      intimation_date?: string;
      sections?: Record<string, unknown>;
    }) => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const user = userData?.user;
      if (!user) throw new Error("Please sign in to create a report.");

      const { data, error } = await supabase
        .from("client_reports")
        .insert({
          company_id: reportData.company_id,
          address_id: reportData.address_id || null,
          title: reportData.title,
          user_id: user.id,
          intimation_date: reportData.intimation_date || null,
          sections: reportData.sections || null,
          report_amount: reportData.report_amount || null,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-reports"] });
      toast.success("Client Report created successfully!");
    },
    onError: (error) => {
      toast.error("Failed to create client report: " + (error as Error).message);
    },
  });
};

export const useUpdateClientReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<ClientReport>;
    }) => {
      const { data, error } = await supabase
        .from("client_reports")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-reports"] });
      queryClient.invalidateQueries({ queryKey: ["client-report"] });
      toast.success("Client Report updated successfully!");
    },
    onError: (error) => {
      toast.error("Failed to update client report: " + (error as Error).message);
    },
  });
};

export const useDeleteClientReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("client_reports")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-reports"] });
      toast.success("Client Report deleted successfully!");
    },
    onError: (error) => {
      toast.error("Failed to delete client report: " + (error as Error).message);
    },
  });
};