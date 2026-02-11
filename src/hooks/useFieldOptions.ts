import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Hook to fetch options for a specific field from the database
 * @param fieldName - The name of the field (e.g., 'content_industry_use', 'arrival_details')
 * @returns Array of option values for that field
 */
export const useFieldOptions = (fieldName: string) => {
  return useQuery({
    queryKey: ["field-options", fieldName], // Unique key per field
    queryFn: async () => {
      console.log("Fetching options for field:", fieldName);
      
      // Get user's company_id for filtering
      const { data: userData } = await supabase.auth.getUser();
      
      if (!userData.user?.id) {
        console.warn("User not authenticated");
        return [];
      }

      const { data: userProfile } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', userData.user.id)
        .single();

      if (!userProfile?.company_id) {
        console.warn("User has no company_id");
        return [];
      }

      const { data, error } = await supabase
        .from("field_options")
        .select("option_value")
        .eq("field_name", fieldName)
        .eq("company_id", userProfile.company_id)
        .eq("is_active", true)
        .order("option_value"); // Sort alphabetically
      
      if (error) {
        console.error(`Error fetching options for ${fieldName}:`, error);
        throw error;
      }
      
      // Return just the option values as an array of strings
      const options = data.map(item => item.option_value);
      console.log(`Found ${options.length} options for ${fieldName}:`, options);
      
      return options;
    },
    // Cache for 5 minutes since field options don't change frequently
    staleTime: 5 * 60 * 1000,
    // Enable the query only if fieldName is provided
    enabled: !!fieldName,
    // Don't retry on auth errors
    retry: (failureCount, error: any) => {
      if (error?.code === '42703' || error?.code === 'PGRST116') {
        return false;
      }
      return failureCount < 2;
    },
  });
};

/**
 * Hook to add a new option for any field
 * This is generic and works for any field type
 */
export const useAddFieldOption = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    // Function expects both fieldName and optionValue
    mutationFn: async ({ fieldName, optionValue }: { fieldName: string; optionValue: string }) => {
      console.log(`Adding option "${optionValue}" to field "${fieldName}"`);
      
      // Get user's company_id
      const { data: userData } = await supabase.auth.getUser();
      
      if (!userData.user?.id) {
        throw new Error('User not authenticated');
      }

      const { data: userProfile } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', userData.user.id)
        .single();

      if (!userProfile?.company_id) {
        throw new Error('User has no company_id');
      }

      // Insert directly instead of using RPC
      const { error } = await supabase
        .from('field_options')
        .insert({
          field_name: fieldName,
          option_value: optionValue.trim(),
          company_id: userProfile.company_id,
          is_active: true
        });
      
      if (error) {
        console.error("Database error:", error);
        throw error;
      }
      
      return { fieldName, optionValue };
    },
    
    // Success handler
    onSuccess: ({ fieldName, optionValue }) => {
      // Invalidate the specific field's options cache
      // This makes the new option appear immediately
      queryClient.invalidateQueries({ queryKey: ["field-options", fieldName] });
      
      // Show success message
      toast.success(`"${optionValue}" added successfully!`);
      
      console.log(`Successfully added "${optionValue}" to ${fieldName}`);
    },
    
    // Error handler
    onError: (error: any) => {
      console.error("Failed to add field option:", error);
      
      // Handle specific error cases
      if (error?.code === '23505') {
        toast.error("This option already exists!");
      } else if (error?.message?.includes('not authenticated')) {
        toast.error("Please log in to add options");
      } else {
        toast.error("Failed to add new option. Please try again.");
      }
    },
  });
};

/**
 * Helper hook to get combined options (predefined + dynamic)
 * @param fieldName - The field name
 * @param predefinedOptions - Static options defined in your form
 * @returns Combined array of all options
 */
export const useCombinedOptions = (fieldName: string, predefinedOptions: string[] = []) => {
  const { data: dynamicOptions = [], isLoading } = useFieldOptions(fieldName);
  
  // Combine predefined and dynamic options, removing duplicates
  const allOptions = [
    ...predefinedOptions,
    ...dynamicOptions.filter(option => !predefinedOptions.includes(option))
  ];
  
  return {
    options: allOptions,
    isLoading,
    dynamicCount: dynamicOptions.length,
    totalCount: allOptions.length
  };
};