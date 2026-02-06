import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

export type Surveyor = Tables<"surveyors">;

export const useSurveyors = () => {
  return useQuery({
    queryKey: ["surveyors"],
    queryFn: async () => {
      console.log("[useSurveyors] Starting query...");
      
      try {
        const { data, error } = await supabase
          .from("surveyors")
          .select("id, company_id, name, email, phone, address, is_active, created_at, updated_at")
          .eq("is_active", true)
          .order("name");
              
        console.log("[useSurveyors] Raw response:", { data, error });
        
        if (error) {
          console.error("[useSurveyors] Database error:", error);
          throw error;
        }
        
        console.log("[useSurveyors] Returning data:", data?.length || 0, "surveyors");
        return data || [];
      } catch (err) {
        console.error("[useSurveyors] Query failed:", err);
        throw err;
      }
    },
    retry: 3,
    staleTime: 5 * 60 * 1000, // 5 minutes
    // cacheTime: 10 * 60 * 1000, // 10 minutes
  });
};
