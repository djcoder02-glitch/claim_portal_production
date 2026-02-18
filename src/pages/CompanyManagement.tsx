import { useState } from "react";
import { CompanyList } from "@/components/admin/CompanyList";
import { CompanyEditor, CompanyFormData } from "@/components/admin/CompanyEditor";
import { CompanyRestrictionsEditor } from "@/components/admin/CompanyRestrictionsEditor";
import { StorageUsageDashboard } from "@/components/admin/StorageUsageDashboard"; // ADD THIS
import {
  useCreateCompany,
  useUpdateCompany,
  useUpdateCompanyRestrictions,
  useDeleteCompany,
  CompanyWithStats,
  CompanyRestrictions,
} from "@/hooks/useCompanies";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Building2 } from "lucide-react";

const CompanyManagement = () => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isRestrictionsOpen, setIsRestrictionsOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanyWithStats | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<string | null>(null);

  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();
  const updateRestrictions = useUpdateCompanyRestrictions();
  const deleteCompany = useDeleteCompany();

  const handleCreateNew = () => {
    setSelectedCompany(null);
    setIsEditorOpen(true);
  };

  const handleEditCompany = (company: CompanyWithStats) => {
    setSelectedCompany(company);
    setIsEditorOpen(true);
  };

  const handleEditRestrictions = (company: CompanyWithStats) => {
    setSelectedCompany(company);
    setIsRestrictionsOpen(true);
  };

  const handleSaveCompany = async (data: CompanyFormData) => {
    if (selectedCompany) {
      await updateCompany.mutateAsync({
        id: selectedCompany.id,
        updates: data,
      });
    } else {
      await createCompany.mutateAsync(data);
    }
  };

  const handleSaveRestrictions = async (data: Partial<CompanyRestrictions>) => {
    if (selectedCompany?.id) {
      await updateRestrictions.mutateAsync({
        company_id: selectedCompany.id,
        restrictions: data,
      });
    }
  };

  const handleDeleteCompany = (companyId: string) => {
    setCompanyToDelete(companyId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (companyToDelete) {
      await deleteCompany.mutateAsync(companyToDelete);
      setDeleteDialogOpen(false);
      setCompanyToDelete(null);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Company Management</h1>
            <p className="text-gray-600">Manage companies, restrictions, and storage usage</p>
          </div>
        </div>
      </div>

      {/* Storage Usage Dashboard - NEW SECTION */}
      <div className="mb-6">
        <StorageUsageDashboard />
      </div>

      {/* Company List */}
      <CompanyList
        onCreateNew={handleCreateNew}
        onEditCompany={(company) => {
          setSelectedCompany(company);
          setIsRestrictionsOpen(true);
        }}
        onDeleteCompany={handleDeleteCompany}
      />

      {/* Company Editor Dialog */}
      <CompanyEditor
        open={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setSelectedCompany(null);
        }}
        company={selectedCompany}
        onSave={handleSaveCompany}
        isLoading={createCompany.isPending || updateCompany.isPending}
      />

      {/* Restrictions Editor Dialog */}
      <CompanyRestrictionsEditor
        open={isRestrictionsOpen}
        onClose={() => {
          setIsRestrictionsOpen(false);
          setSelectedCompany(null);
        }}
        company={selectedCompany}
        onSave={handleSaveRestrictions}
        isLoading={updateRestrictions.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the company and all associated data including users, claims, and documents.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Company
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CompanyManagement;