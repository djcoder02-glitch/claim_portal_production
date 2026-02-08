import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCreateVASReport } from "@/hooks/useVASReports";
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
import { Star } from "lucide-react";

interface NewVASReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormData {
  title: string;
  service_id: string;
  report_amount?: number;
  intimation_date?: string;
}

export const NewVASReportDialog = ({ open, onOpenChange }: NewVASReportDialogProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedService, setSelectedService] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<FormData>();

  // Fetch VAS services
  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ["value-added-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("value_added_services")
        .select("id, service_name")
        .eq("is_active", true)
        .order("service_name");
      if (error) throw error;
      return data || [];
    },
  });

  const createReportMutation = useCreateVASReport();

  const onSubmit = async (data: FormData) => {
    if (!selectedService) return;

    try {
      const report = await createReportMutation.mutateAsync({
        service_id: selectedService,
        title: data.title,
        report_amount: data.report_amount,
        intimation_date: data.intimation_date,
        sections: {},
      });

      queryClient.invalidateQueries({ queryKey: ["vas-reports"] });
      onOpenChange(false);
      reset();
      setSelectedService("");
      navigate(`/value-added-services/reports/${report.id}`);
    } catch (error) {
      console.error("Failed to create VAS report:", error);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    reset();
    setSelectedService("");
  };

  if (servicesLoading) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New VAS Report</DialogTitle>
            <DialogDescription>Loading services...</DialogDescription>
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
          <DialogTitle>New VAS Report</DialogTitle>
          <DialogDescription>
            Create a new value-added service report
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          {/* Service Selection */}
          <div className="space-y-2">
            <Label htmlFor="service">Service *</Label>
            <Select value={selectedService} onValueChange={(value) => {
              setSelectedService(value);
              setValue("service_id", value);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select service" />
              </SelectTrigger>
              <SelectContent>
                {services.map((service: any) => (
                  <SelectItem key={service.id} value={service.id}>
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4" />
                      {service.service_name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!selectedService && errors.service_id && (
              <p className="text-sm text-destructive">Service is required</p>
            )}
          </div>

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
            <Button type="submit" disabled={createReportMutation.isPending}>
              {createReportMutation.isPending ? "Creating..." : "Create Report"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};