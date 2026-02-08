import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Upload, Info, Eye, IndianRupee, ArrowLeft } from "lucide-react";
import { useVASReportById } from "@/hooks/useVASReports";
import { PolicyDetailsForm } from "@/components/claims/PolicyDetailsForm";
import { AdditionalInformationForm } from "@/components/claims/AdditionalInformationForm";
import { ReportPreview } from "@/components/claims/ReportPreview";
import { FeeBillForm } from "@/components/claims/FeeBillForm";
import { DocumentsTab } from "@/components/documents/DocumentsTab";
import { Assessment } from "@/components/claims/Assessment";
import { toast } from "sonner";
import { SelectiveDocumentExtractor } from "@/components/claims/SelectiveDocumentExtractor";  // ADD THIS

export const VASReportDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: report, isLoading } = useVASReportById(id!);
  const [activeTab, setActiveTab] = useState("policy-details");

  const handleTabChange = (value: string) => {
    const sectionNames: Record<string, string> = {
      "policy-details": "Policy Details",
      "additional-info": "Additional Information", 
      "report-preview": "View Report",
      "documents": "Documents",
      "fee-bill": "Fee Bill Details",
      "assessment": "Assessment",
    };
    
    if (activeTab !== value) {
      const currentSectionName = sectionNames[activeTab];
      if (currentSectionName && (activeTab === "policy-details" || activeTab === "additional-info")) {
        toast.success(`${currentSectionName} saved successfully`);
      }
    }
    
    setActiveTab(value);
  };

const handleBackClick = () => {
    navigate("/value-added-services/reports");
  };

  // ADD THESE TWO HANDLERS:
  const handleBillOfEntryExtracted = async (extractedData: Record<string, any>) => {
    console.log('✅ Bill of Entry Data Extracted:', extractedData);
    toast.success(`✅ Successfully saved ${Object.keys(extractedData).length} fields from Bill of Entry!`);
  };

  const handlePolicyDocumentExtracted = async (extractedData: Record<string, any>) => {
    console.log('✅ Policy Document Data Extracted:', extractedData);
    toast.success(`✅ Successfully saved ${Object.keys(extractedData).length} fields from Policy Document!`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-12 bg-slate-200 rounded w-1/3"></div>
            <div className="h-96 bg-slate-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-slate-900">VAS Report not found</h2>
            <p className="text-slate-600 mt-2">The report you're looking for doesn't exist.</p>
            <Button onClick={handleBackClick} className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to VAS Reports
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Convert VASReport to compatible format with policy_types mock
  const claimCompatible = {
    ...report,
    claim_number: report.report_number,
    policy_type_id: report.service_id,
    sections: report.sections || {}, // Make sure this exists
    broker_id: report.broker_id || null, // Preserve broker_id if it exists
    policy_types: {
      id: report.service_id,
      name: report.service_name || 'VAS Service',
      broker_id: null,
      required_documents: []
    }
  } as any;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with Back Button */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackClick}
                  className="hover:bg-slate-100"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                VAS Report Details
              </h1>
              <div className="flex items-center gap-4 text-sm text-slate-600">
                <span className="font-medium">Report #: {report.report_number}</span>
                <span>•</span>
                <span>Service: {report.service_name}</span>
                <span>•</span>
                <span className="capitalize">Status: {report.status.replace('_', ' ')}</span>
              </div>
            </div>
          </div>
        </div>


{/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Report Overview Card */}
            <Card className="bg-white/95 backdrop-blur-sm border border-slate-200 shadow-sm">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Report Overview</h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-slate-500">Service Type</span>
                    <p className="font-medium text-slate-900">{report.service_name}</p>
                  </div>
                  <div>
                    <span className="text-sm text-slate-500">Status</span>
                    <p className="font-medium text-slate-900 capitalize">{report.status.replace('_', ' ')}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Bill of Entry Upload */}
            <SelectiveDocumentExtractor
              claimId={report.id}
              policyTypeId={report.service_id}
              documentLabel="Bill of Entry"
              documentTitle="Bill of Entry"
              documentDescription="Upload your Bill of Entry document (PDF format required for field extraction)"
              onDataExtracted={handleBillOfEntryExtracted}
              entityType="vas"
            />

            {/* Policy Document Upload */}
            <SelectiveDocumentExtractor
              claimId={report.id}
              policyTypeId={report.service_id}
              documentLabel="Policy Document"
              documentTitle="Policy Document"
              documentDescription="Upload your policy document (PDF format required for field extraction)"
              onDataExtracted={handlePolicyDocumentExtracted}
              entityType="vas"
            />
          </div>

          {/* Right Content Area */}
          <div className="lg:col-span-3">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
              <Card className="bg-white/95 backdrop-blur-sm border border-slate-200 shadow-sm p-2">
                <TabsList className="grid w-full grid-cols-6 bg-slate-100 h-14">
                  <TabsTrigger 
                    value="policy-details" 
                    className="flex items-center space-x-2 data-[state=active]:bg-slate-700 data-[state=active]:text-white transition-all duration-200"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Policy Details</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="additional-info" 
                    className="flex items-center space-x-2 data-[state=active]:bg-slate-600 data-[state=active]:text-white transition-all duration-200"
                  >
                    <Info className="w-4 h-4" />
                    <span>Additional Info</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="report-preview" 
                    className="flex items-center space-x-2 data-[state=active]:bg-slate-800 data-[state=active]:text-white transition-all duration-200"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View Report</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="fee-bill" 
                    className="flex items-center space-x-2 data-[state=active]:bg-green-600 data-[state=active]:text-white transition-all duration-200"
                  >
                    <IndianRupee className="w-4 h-4" />
                    <span>Fee Bill</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="documents" 
                    className="flex items-center space-x-2 data-[state=active]:bg-slate-500 data-[state=active]:text-white transition-all duration-200"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Documents</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="assessment" 
                    className="flex items-center space-x-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all duration-200"
                  >
                    <Info className="w-4 h-4" />
                    <span>Assessment</span>
                  </TabsTrigger>
                </TabsList>
              </Card>

              <TabsContent value="policy-details" className="space-y-6">
                <PolicyDetailsForm claim={claimCompatible} />
              </TabsContent>

              <TabsContent value="additional-info" className="space-y-6">
                <AdditionalInformationForm claim={claimCompatible} />
              </TabsContent>

              <TabsContent value="report-preview" className="space-y-6">
                <ReportPreview claim={claimCompatible} />
              </TabsContent>

              <TabsContent value="fee-bill" className="space-y-6">
                <FeeBillForm claim={claimCompatible} />
              </TabsContent>

              <TabsContent value="documents" className="space-y-6">
                <DocumentsTab claimId={report.id} />
              </TabsContent>

              <TabsContent value="assessment" className="space-y-6">
                <Assessment claim={claimCompatible} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};