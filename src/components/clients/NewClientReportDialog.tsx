import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCreateClientReport } from "@/hooks/useClientReports";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";

interface NewClientReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormData {
  title: string;
  company_id: string;
  address_id?: string;
  report_amount?: number;
  intimation_date?: string;
}

export const NewClientReportDialog = ({ open, onOpenChange }: NewClientReportDialogProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedAddress, setSelectedAddress] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<FormData>();

  // Fetch Client Companies
  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ["client-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_companies")
        .select("id, company_name")
        .eq("is_active", true)
        .order("company_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch Addresses for selected company
  const { data: addresses = [], isLoading: addressesLoading } = useQuery({
    queryKey: ["client-addresses", selectedCompany],
    queryFn: async () => {
      if (!selectedCompany) return [];
      const { data, error } = await supabase
        .from("client_addresses")
        .select("id, address_label, full_address, city, state")
        .eq("company_id", selectedCompany)
        .eq("is_active", true)
        .order("is_primary", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompany,
  });

  const createReportMutation = useCreateClientReport();

  const onSubmit = async (data: FormData) => {
    if (!selectedCompany) return;

    try {
      const report = await createReportMutation.mutateAsync({
        company_id: selectedCompany,
        address_id: selectedAddress || undefined,
        title: data.title,
        report_amount: data.report_amount,
        intimation_date: data.intimation_date,
        sections: {},
      });

      queryClient.invalidateQueries({ queryKey: ["client-reports"] });
      onOpenChange(false);
      reset();
      setSelectedCompany("");
      setSelectedAddress("");
      navigate(`/clients/reports/${report.id}`);
    } catch (error) {
      console.error("Failed to create client report:", error);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    reset();
    setSelectedCompany("");
    setSelectedAddress("");
  };

  if (companiesLoading) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Client Report</DialogTitle>
            <DialogDescription>Loading companies...</DialogDescription>
          </DialogHeader>
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded"></div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Client Report</DialogTitle>
          <DialogDescription>
            Create a new client service report
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          {/* Company Selection */}
          <div className="space-y-2">
            <Label htmlFor="company">Client Company *</Label>
            <Select value={selectedCompany} onValueChange={(value) => {
              setSelectedCompany(value);
              setSelectedAddress(""); // Reset address when company changes
              setValue("company_id", value);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select client company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company: any) => (
                  <SelectItem key={company.id} value={company.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      {company.company_name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!selectedCompany && errors.company_id && (
              <p className="text-sm text-destructive">Company is required</p>
            )}
          </div>

          {/* Address Selection (Optional, shown only when company selected) */}
          {selectedCompany && (
            <div className="space-y-2">
              <Label htmlFor="address">Client Address (Optional)</Label>
              <Select value={selectedAddress} onValueChange={setSelectedAddress}>
                <SelectTrigger>
                  <SelectValue placeholder="Select address (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {addressesLoading ? (
                    <div className="p-2 text-sm text-muted-foreground">Loading addresses...</div>
                  ) : addresses.length > 0 ? (
                    addresses.map((address: any) => (
                      <SelectItem key={address.id} value={address.id}>
                        {address.address_label} - {address.city}, {address.state}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-sm text-muted-foreground">No addresses found</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Report Title *</Label>
            <Input
              id="title"
              placeholder="Brief description of report"
              {...register("title", { required: "Title is required" })}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Report Amount */}
          <div className="space-y-2">
            <Label htmlFor="report_amount">Estimated Amount (Rs.)</Label>
            <Input
              id="report_amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register("report_amount", {
                valueAsNumber: true,
                min: { value: 0, message: "Amount must be positive" },
              })}
            />
            {errors.report_amount && (
              <p className="text-sm text-destructive">{errors.report_amount.message}</p>
            )}
          </div>

          {/* Intimation Date */}
          <div className="space-y-2">
            <Label htmlFor="intimation_date">Intimation Date</Label>
            <Input
              id="intimation_date"
              type="date"
              {...register("intimation_date")}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createReportMutation.isPending || !selectedCompany}>
              {createReportMutation.isPending ? "Creating..." : "Create Report"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};