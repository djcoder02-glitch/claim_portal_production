import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";

export interface VASReport {
  broker_id: null;
  id: string;
  user_id: string;
  service_id: string;
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
  service_name?: string;
  service_description?: string;
}

export const useVASReports = () => {
  const { isAdmin } = useAuth();
  
  return useQuery<VASReport[]>({
    queryKey: ["vas-reports", isAdmin ? "admin" : "user"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vas_reports")
        .select(`
          *,
          value_added_services!inner(service_name, description)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      return (data || []).map(report => ({
        ...report,
        service_name: report.value_added_services?.service_name,
        service_description: report.value_added_services?.description
      })) as VASReport[];
    },
  });
};

export const useVASReportById = (id: string) => {
  const { isAdmin } = useAuth();
  
  return useQuery<VASReport>({
    queryKey: ["vas-report", id, isAdmin ? "admin" : "user"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vas_reports")
        .select(`
          *,
          value_added_services!inner(service_name, description)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      
      return {
        ...data,
        service_name: data.value_added_services?.service_name,
        service_description: data.value_added_services?.description
      } as VASReport;
    },
  });
};

export const useCreateVASReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reportData: {
      service_id: string;
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
        .from("vas_reports")
        .insert({
          service_id: reportData.service_id,
          title: reportData.title,
          user_id: user.id,
          intimation_date: reportData.intimation_date || null,
          sections: (reportData.sections && Object.keys(reportData.sections).length > 0 
            ? reportData.sections 
            : null) as any,
          report_amount: reportData.report_amount || null,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vas-reports"] });
      toast.success("VAS Report created successfully!");
    },
    onError: (error) => {
      toast.error("Failed to create VAS report: " + (error as Error).message);
    },
  });
};

export const useUpdateVASReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<VASReport>;
    }) => {
      // Clean the updates before sending
      const cleanedUpdates : any= { ...updates };
      
      // Convert empty sections to null
      if (cleanedUpdates.sections !== undefined) {
        if (!cleanedUpdates.sections || Object.keys(cleanedUpdates.sections).length === 0) {
          cleanedUpdates.sections = null;
        }
      }
      const { data, error } = await supabase
        .from("vas_reports")
        .update(cleanedUpdates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vas-reports"] });
      queryClient.invalidateQueries({ queryKey: ["vas-report"] });
      toast.success("VAS Report updated successfully!");
    },
    onError: (error) => {
      toast.error("Failed to update VAS report: " + (error as Error).message);
    },
  });
};

export const useDeleteVASReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("vas_reports")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vas-reports"] });
      toast.success("VAS Report deleted successfully!");
    },
    onError: (error) => {
      toast.error("Failed to delete VAS report: " + (error as Error).message);
    },
  });
};