import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, FileText, Edit } from "lucide-react";
import { PolicyTypesManager } from "@/components/admin/PolicyTypesManager";
import { NewClaimFieldsManager } from "@/components/admin/NewClaimFieldsManager";
import { DocumentRequirementsManager } from "@/components/admin/DocumentRequirementsManager";
import { ParsingConfigManager } from "@/components/admin/ParsingConfigManager";

export const SettingsPage = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Manage your application configuration and preferences
          </p>
        </div>
      </div>

      <Tabs defaultValue="policy-types" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="policy-types" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Policy Types
          </TabsTrigger>
          <TabsTrigger value="claim-fields" className="flex items-center gap-2">
            <Edit className="w-4 h-4" />
            Claim Fields
          </TabsTrigger>
          <TabsTrigger value="doc-requirements" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Document Requirements
          </TabsTrigger>
          <TabsTrigger value="parsing-config" className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" />
            Parsing Config
          </TabsTrigger>
        </TabsList>

        <TabsContent value="policy-types" className="space-y-4">
          <PolicyTypesManager />
        </TabsContent>

        <TabsContent value="claim-fields" className="space-y-4">
          <NewClaimFieldsManager />
        </TabsContent>
        
        <TabsContent value="doc-requirements" className="space-y-4">
          <DocumentRequirementsManager />
        </TabsContent>
        
        <TabsContent value="parsing-config" className="space-y-4">
          <ParsingConfigManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};