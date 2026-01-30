import { useState } from "react";
import { useCompanies } from "@/hooks/useCompanies";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Building2, 
  Users, 
  FileText, 
  Search, 
  Plus,
  Edit,
  Trash2,
  TrendingUp,
  UserCheck,
  UserX,
  Loader2
} from "lucide-react";
import { CompanyWithStats } from "@/hooks/useCompanies";

interface CompanyListProps {
  onCreateNew: () => void;
  onEditCompany: (company: CompanyWithStats) => void;
  onDeleteCompany: (companyId: string) => void;
}

export const CompanyList = ({ onCreateNew, onEditCompany, onDeleteCompany }: CompanyListProps) => {
  const { data: companies, isLoading } = useCompanies();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCompanies = companies?.filter(company => 
    company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Exclude SuperAdmin company
  const displayCompanies = filteredCompanies?.filter(
    c => c.id !== '00000000-0000-0000-0000-000000000001'
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Search and Create Button */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={onCreateNew} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Create Company
        </Button>
      </div>

      {/* Company Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayCompanies?.map((company) => (
          <Card key={company.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{company.name}</CardTitle>
                    <p className="text-sm text-gray-500">{company.email}</p>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="text-xs text-gray-600">Users</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {company.stats?.total_users || 0}
                  </p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      <UserCheck className="w-3 h-3 mr-1" />
                      {company.stats?.active_users || 0}
                    </Badge>
                    {(company.stats?.pending_users || 0) > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        <UserX className="w-3 h-3 mr-1" />
                        {company.stats?.pending_users}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-green-600" />
                    <span className="text-xs text-gray-600">Claims</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {company.stats?.total_claims || 0}
                  </p>
                  <Badge variant="outline" className="text-xs mt-1">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    {company.stats?.active_claims || 0} active
                  </Badge>
                </div>
              </div>

              {/* Restrictions Summary */}
              <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                <p className="text-xs font-medium text-gray-700">Restrictions</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-600">Max Users:</span>
                    <span className="ml-1 font-medium">{company.restrictions?.max_users || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Max Claims/mo:</span>
                    <span className="ml-1 font-medium">{company.restrictions?.max_claims_per_month || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Storage:</span>
                    <span className="ml-1 font-medium">{company.restrictions?.current_storage_gb?.toFixed(2) || 0} / {company.restrictions?.max_storage_gb || 0} GB</span>
                  </div>
                  <div>
                    <span className="text-gray-600">AI Calls:</span>
                    <span className="ml-1 font-medium">{company.restrictions?.current_ai_extractions_this_month || 0} / {company.restrictions?.max_ai_extractions_per_month || 0}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  {company.restrictions?.can_access_vas && (
                    <Badge variant="secondary" className="text-xs">VAS</Badge>
                  )}
                  {company.restrictions?.can_access_client_reports && (
                    <Badge variant="secondary" className="text-xs">Client Reports</Badge>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditCompany(company)}
                  className="flex-1"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDeleteCompany(company.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {displayCompanies?.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No companies found</p>
          <Button onClick={onCreateNew} variant="outline" className="mt-4">
            <Plus className="w-4 h-4 mr-2" />
            Create First Company
          </Button>
        </div>
      )}
    </div>
  );
};