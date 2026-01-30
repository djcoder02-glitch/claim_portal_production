import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Info } from "lucide-react";
import { CompanyWithStats, CompanyRestrictions } from "@/hooks/useCompanies";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface RestrictionsEditorProps {
  open: boolean;
  onClose: () => void;
  company: CompanyWithStats | null;
  onSave: (data: Partial<CompanyRestrictions>) => Promise<void>;
  isLoading: boolean;
}

export const CompanyRestrictionsEditor = ({ open, onClose, company, onSave, isLoading }: RestrictionsEditorProps) => {
  const { register, handleSubmit, watch, setValue } = useForm<Partial<CompanyRestrictions>>({
    defaultValues: {
      max_claims_per_month: company?.restrictions?.max_claims_per_month || 50,
      max_active_claims: company?.restrictions?.max_active_claims || 20,
      max_users: company?.restrictions?.max_users || 10,
      max_surveyors: company?.restrictions?.max_surveyors || 5,
      max_storage_gb: company?.restrictions?.max_storage_gb || 5,
      max_documents_per_claim: company?.restrictions?.max_documents_per_claim || 20,
      can_access_vas: company?.restrictions?.can_access_vas || false,
      can_access_client_reports: company?.restrictions?.can_access_client_reports || false,
      max_ai_extractions_per_month: company?.restrictions?.max_ai_extractions_per_month || 100,
      max_file_size_mb: company?.restrictions?.max_file_size_mb || 10,
      max_total_claim_size_mb: company?.restrictions?.max_total_claim_size_mb || 50,
    },
  });

  const canAccessVAS = watch("can_access_vas");
  const canAccessClientReports = watch("can_access_client_reports");

  const onSubmit = async (data: Partial<CompanyRestrictions>) => {
    await onSave(data);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Restrictions - {company?.name}</DialogTitle>
          <DialogDescription>
            Configure usage limits and feature access for this company
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Tabs defaultValue="usage" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="usage">Usage Limits</TabsTrigger>
              <TabsTrigger value="features">Features</TabsTrigger>
              <TabsTrigger value="files">File & AI</TabsTrigger>
            </TabsList>

            {/* Usage Limits Tab */}
            <TabsContent value="usage" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max_claims_per_month">
                    Max Claims Per Month
                    <Info className="inline w-3 h-3 ml-1 text-gray-400" />
                  </Label>
                  <Input
                    id="max_claims_per_month"
                    type="number"
                    min="0"
                    {...register("max_claims_per_month", { valueAsNumber: true })}
                  />
                  <p className="text-xs text-gray-500">
                    Current: {company?.stats?.total_claims || 0} claims
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_active_claims">Max Active Claims</Label>
                  <Input
                    id="max_active_claims"
                    type="number"
                    min="0"
                    {...register("max_active_claims", { valueAsNumber: true })}
                  />
                  <p className="text-xs text-gray-500">
                    Current: {company?.stats?.active_claims || 0} active
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_users">Max Users</Label>
                  <Input
                    id="max_users"
                    type="number"
                    min="0"
                    {...register("max_users", { valueAsNumber: true })}
                  />
                  <p className="text-xs text-gray-500">
                    Current: {company?.stats?.total_users || 0} users
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_surveyors">Max Surveyors</Label>
                  <Input
                    id="max_surveyors"
                    type="number"
                    min="0"
                    {...register("max_surveyors", { valueAsNumber: true })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_storage_gb">Max Storage (GB)</Label>
                  <Input
                    id="max_storage_gb"
                    type="number"
                    step="0.1"
                    min="0"
                    {...register("max_storage_gb", { valueAsNumber: true })}
                  />
                  <p className="text-xs text-gray-500">
                    Current: {company?.restrictions?.current_storage_gb?.toFixed(2) || 0} GB
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_documents_per_claim">Max Documents Per Claim</Label>
                  <Input
                    id="max_documents_per_claim"
                    type="number"
                    min="0"
                    {...register("max_documents_per_claim", { valueAsNumber: true })}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Features Tab */}
            <TabsContent value="features" className="space-y-6 pt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="can_access_vas" className="text-base font-medium">
                      Value Added Services (VAS)
                    </Label>
                    <p className="text-sm text-gray-500">
                      Allow access to VAS reports and management
                    </p>
                  </div>
                  <Switch
                    id="can_access_vas"
                    checked={canAccessVAS}
                    onCheckedChange={(checked) => setValue("can_access_vas", checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="can_access_client_reports" className="text-base font-medium">
                      Client Reports
                    </Label>
                    <p className="text-sm text-gray-500">
                      Allow access to client reports feature
                    </p>
                  </div>
                  <Switch
                    id="can_access_client_reports"
                    checked={canAccessClientReports}
                    onCheckedChange={(checked) => setValue("can_access_client_reports", checked)}
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> VAS and Client Reports are premium features. 
                  Enabling these will give the company access to additional functionality.
                </p>
              </div>
            </TabsContent>

            {/* File & AI Tab */}
            <TabsContent value="files" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max_ai_extractions_per_month">
                    Max AI Extractions Per Month
                  </Label>
                  <Input
                    id="max_ai_extractions_per_month"
                    type="number"
                    min="0"
                    {...register("max_ai_extractions_per_month", { valueAsNumber: true })}
                  />
                  <p className="text-xs text-gray-500">
                    Current: {company?.restrictions?.current_ai_extractions_this_month || 0} used
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_file_size_mb">Max File Size (MB)</Label>
                  <Input
                    id="max_file_size_mb"
                    type="number"
                    min="1"
                    {...register("max_file_size_mb", { valueAsNumber: true })}
                  />
                  <p className="text-xs text-gray-500">Per file upload limit</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_total_claim_size_mb">
                    Max Total Claim Size (MB)
                  </Label>
                  <Input
                    id="max_total_claim_size_mb"
                    type="number"
                    min="1"
                    {...register("max_total_claim_size_mb", { valueAsNumber: true })}
                  />
                  <p className="text-xs text-gray-500">Total size for all documents in one claim</p>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>AI Usage:</strong> AI extractions are consumed when documents are 
                  processed using Gemini AI for field extraction. Monitor usage to control costs.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Restrictions"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
