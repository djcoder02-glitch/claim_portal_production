import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";

export interface Claim {
  id: string;
  created_by: string;
  company_id: string;
  policy_id: string | null;
  policy_type_id: string | null;
  claim_number: string;
  claim_type: string;
  status: string;
  title: string | null;
  insured_name: string | null;
  registration_id: string | null;
  loss_date: string | null;
  intimation_date: string | null;
  claim_amount: number | null;
  surveyor_id: string | null;
  surveyor_name: string | null;
  insurer_id: string | null;
  insurer_name: string | null;
  broker_id: string | null;
  broker_name: string | null;
  policy_number: string | null;
  sum_insured: number | null;
  loss_description: string | null;
  sections: any;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
  policy_types?: {
    id: string;
    name: string;
    fields?: any;
  };
}


export const useClaims = () => {
  const { isSuperadmin, isAdmin } = useAuth();
  
  return useQuery({
    queryKey: ["claims"],
    queryFn: async () => {
      console.log('[useClaims] Fetching claims...');

      const { data, error } = await supabase
        .from('claims')
        .select(`
          *,
          policies:policy_id (
            policy_number,
            policy_type,
            insured_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[useClaims] Error:', error);
        throw error;
      }

      console.log('[useClaims] Fetched claims count:', data?.length);
      return data as Claim[];
    },
  });
};

export const usePolicyTypes = () => {
  return useQuery({
    queryKey: ["policy_types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('policy_types')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });
};

export const useCreateClaim = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (claimData: {
      policy_type_id: string;
      title: string;
      claim_amount?: number;
      intimation_date?: string;
      sections?: {
        registration_id?: string;
        insured_name?: string;
        assigned_surveyor?: string;
        insurer?: string;
      };
    }) => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      
      const user = userData?.user;
      if (!user) throw new Error("Please sign in to create a claim.");

      // Get user's company_id
      const { data: userProfile } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!userProfile?.company_id) {
        throw new Error("No company associated with your account");
      }

      // Generate claim number
      const claimNumber = `CLM-${Date.now()}`;

      // Extract sections fields
      const formData = claimData.sections || {};

      console.log('Creating claim with data:', {
        claim_number: claimNumber,
        title: claimData.title,
        registration_id: formData.registration_id,
        insured_name: formData.insured_name,
      });

      const { data, error } = await supabase
        .from("claims")
        .insert({
          claim_number: claimNumber,
          company_id: userProfile.company_id,
          created_by: user.id,
          policy_type_id: claimData.policy_type_id,
          claim_type: 'regular',
          status: 'draft',
          
          // Main fields
          title: claimData.title,
          claim_amount: claimData.claim_amount || null,
          intimation_date: claimData.intimation_date || null,
          
          // Form data fields - save to direct columns
          registration_id: formData.registration_id || null,
          insured_name: formData.insured_name || null,
          surveyor_name: formData.assigned_surveyor || null,
          insurer_name: formData.insurer || null,
          
          // Keep sections as backup
          sections: {
            sections: formData
          },
        })
        .select()
        .single();

      if (error) {
        console.error('Create claim error:', error);
        throw error;
      }
      
      console.log('Claim created successfully:', data);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["claims"] });
      toast.success("Claim created successfully!");
    },
    onError: (error) => {
      console.error('Failed to create claim:', error);
      toast.error("Failed to create claim: " + error.message);
    },
  });
};
export const useUpdateClaim = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Claim>;
    }) => {
      const { data, error } = await supabase
        .from("claims")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["claims"] });
      toast.success("Claim updated successfully!");
    },
    onError: (error) => {
      toast.error("Failed to update claim: " + error.message);
    },
  });
};


export const useUpdateClaimSilent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Claim>;
    }) => {
      const { data, error } = await supabase
        .from("claims")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["claims"] });
      queryClient.invalidateQueries({ queryKey: ["claim"] });
      // No toast notification - silent update
    },
  });
};

export const useClaimById = (id: string) => {
  return useQuery({
    queryKey: ["claim", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("claims")
        .select(`
          *,
          policies:policy_id (
            policy_number,
            policy_type,
            insured_name
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Claim;
    },
    enabled: !!id,
  });
};

export const useDeleteClaim = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('claims')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["claims"] });
      toast.success("Claim deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete claim: " + error.message);
    },
  });
};

