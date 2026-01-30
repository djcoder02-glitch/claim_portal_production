import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";

export interface Claim {
  id: string;
  created_by: string;
  company_id: string;
  policy_id: string | null;
  claim_number: string;
  claim_type: string;
  status: string;
  insured_name: string | null;
  loss_date: string | null;
  intimation_date: string | null;
  claim_amount: number | null;
  surveyor_id: string | null;
  sections: any;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
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

export const useCreateClaim = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (claimData: {
      policy_id?: string;
      claim_type?: string;
      insured_name?: string;
      loss_date?: string;
      intimation_date?: string;
      claim_amount?: number;
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

      const { data, error } = await supabase
        .from("claims")
        .insert({
          claim_number: claimNumber,
          company_id: userProfile.company_id,
          created_by: user.id,
          policy_id: claimData.policy_id || null,
          claim_type: claimData.claim_type || 'regular',
          status: 'draft',
          insured_name: claimData.insured_name || null,
          loss_date: claimData.loss_date || null,
          intimation_date: claimData.intimation_date || null,
          claim_amount: claimData.claim_amount || null,
          sections: [],
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["claims"] });
      toast.success("Claim created successfully!");
    },
    onError: (error) => {
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