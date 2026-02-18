import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  UserCog, 
  Shield, 
  ShieldOff,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Copy,
  Check,
  UserCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useAuth } from "@/components/auth/AuthProvider";

interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: 'superadmin' | 'admin' | 'user';
  status: 'pending' | 'active' | 'suspended';
  company_id: string;
  created_at: string;
}

interface Surveyor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  is_active: boolean;
}

const CopyCodeButton = ({ code }: { code: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="ml-2 text-gray-400 hover:text-gray-700 transition-colors"
      title="Copy code"
    >
      {copied
        ? <Check className="w-3.5 h-3.5 text-green-500" />
        : <Copy className="w-3.5 h-3.5" />
      }
    </button>
  );
};

export const TeamManagement = () => {
  const queryClient = useQueryClient();
  const { user: currentUser, companyId } = useAuth();
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'role' | 'delete';
    userId?: string;
    currentRole?: string;
    userName?: string;
  }>({ open: false, type: 'role' });

  const isSuperAdmin = currentUser?.role === 'superadmin';

  // Fetch company code — only for non-superadmin
  const { data: companyData } = useQuery({
    queryKey: ['company-code', companyId],
    queryFn: async () => {
      if (!companyId) throw new Error('Company ID is required');
      const { data, error } = await supabase
        .from('companies')
        .select('name, company_code')
        .eq('id', companyId)
        .single();
      if (error) throw error;
      return data as { name: string; company_code: string };
    },
    enabled: !!companyId && !isSuperAdmin,
  });

  // Fetch users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['team-users', isSuperAdmin],
    queryFn: async () => {
      if (!currentUser?.id) throw new Error('User not authenticated');

      if (isSuperAdmin) {
        const { data, error } = await supabase
          .from('users')
          .select('*, company:companies(name, company_code)')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
      } else {
        if (!companyId) throw new Error('Company ID is required');
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data as User[];
      }
    },
    enabled: !!currentUser?.id && (isSuperAdmin || !!companyId),
  });

  // Fetch surveyors
  const { data: surveyors = [], isLoading: surveyorsLoading } = useQuery({
    queryKey: ['surveyors', isSuperAdmin],
    queryFn: async () => {
      if (!currentUser?.id) throw new Error('User not authenticated');

      if (isSuperAdmin) {
        const { data, error } = await supabase
          .from('surveyors')
          .select('*, company:companies(name, company_code)')
          .order('name');
        if (error) throw error;
        return data;
      } else {
        if (!companyId) throw new Error('Company ID is required');
        const { data, error } = await supabase
          .from('surveyors')
          .select('*')
          .eq('company_id', companyId)
          .order('name');
        if (error) throw error;
        return data as Surveyor[];
      }
    },
    enabled: !!currentUser?.id && (isSuperAdmin || !!companyId),
  });

  // Toggle user role
  const toggleRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: 'admin' | 'user' }) => {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-users', isSuperAdmin] });
      toast.success("User role updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update role: " + error.message);
    },
  });

  // Verify (approve) a pending user
  const verifyUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('users')
        .update({ status: 'active' })
        .eq('id', userId);
      if (error) throw error;

      // Also update the pending request if it exists
      await supabase
        .from('pending_user_requests')
        .update({ status: 'approved' })
        .eq('user_id', userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-users', isSuperAdmin] });
      toast.success("User verified and activated successfully");
    },
    onError: (error) => {
      toast.error("Failed to verify user: " + error.message);
    },
  });

  // Delete a pending user
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Delete pending request first (FK constraint)
      await supabase
        .from('pending_user_requests')
        .delete()
        .eq('user_id', userId);

      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-users', isSuperAdmin] });
      toast.success("User deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete user: " + error.message);
    },
  });

  // Toggle surveyor status
  const toggleSurveyorMutation = useMutation({
    mutationFn: async ({ surveyorId, isActive }: { surveyorId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('surveyors')
        .update({ is_active: !isActive })
        .eq('id', surveyorId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveyors', isSuperAdmin] });
      toast.success("Surveyor status updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update status: " + error.message);
    },
  });

  const handleRoleToggle = (userId: string, currentRole: string) => {
    setConfirmDialog({ open: true, type: 'role', userId, currentRole });
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    setConfirmDialog({ open: true, type: 'delete', userId, userName });
  };

  const confirmAction = () => {
    if (confirmDialog.type === 'role' && confirmDialog.userId && confirmDialog.currentRole) {
      const newRole = confirmDialog.currentRole === 'admin' ? 'user' : 'admin';
      toggleRoleMutation.mutate({ userId: confirmDialog.userId, newRole: newRole as 'admin' | 'user' });
    } else if (confirmDialog.type === 'delete' && confirmDialog.userId) {
      deleteUserMutation.mutate(confirmDialog.userId);
    }
    setConfirmDialog({ open: false, type: 'role' });
  };

  const handleSurveyorToggle = (surveyorId: string, isActive: boolean) => {
    toggleSurveyorMutation.mutate({ surveyorId, isActive });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-blue-600';
      case 'superadmin': return 'bg-purple-600';
      default: return 'bg-gray-500';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-600';
      case 'pending': return 'bg-yellow-600';
      case 'suspended': return 'bg-red-600';
      default: return 'bg-gray-500';
    }
  };

  const isActionPending =
    toggleRoleMutation.isPending ||
    verifyUserMutation.isPending ||
    deleteUserMutation.isPending;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Team Management</h1>
        <p className="text-gray-600 mt-1">Manage users, roles, and surveyors</p>
      </div>

      {/* Company Code Banner — non-superadmin only */}
      {!isSuperAdmin && companyData && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-4 px-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-500 font-medium uppercase tracking-wide mb-0.5">
                Your Company Code
              </p>
              <p className="text-sm text-blue-700">
                Share this code with new team members so they can sign up.
              </p>
            </div>
            <div className="flex items-center bg-white border border-blue-200 rounded-lg px-4 py-2 font-mono text-lg font-bold text-blue-700 tracking-widest shadow-sm">
              {companyData.company_code}
              <CopyCodeButton code={companyData.company_code} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Users ({users.length})
          </TabsTrigger>
          <TabsTrigger value="surveyors" className="flex items-center gap-2">
            <UserCog className="w-4 h-4" />
            Surveyors ({surveyors.length})
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No users found</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      {isSuperAdmin && <TableHead>Company</TableHead>}
                      {isSuperAdmin && <TableHead>Code</TableHead>}
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user: any) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.full_name || 'N/A'}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        {isSuperAdmin && (
                          <TableCell className="text-gray-600">
                            {user.company?.name || '—'}
                          </TableCell>
                        )}
                        {isSuperAdmin && (
                          <TableCell>
                            {user.company?.company_code ? (
                              <span className="flex items-center font-mono text-sm text-gray-700">
                                {user.company.company_code}
                                <CopyCodeButton code={user.company.company_code} />
                              </span>
                            ) : '—'}
                          </TableCell>
                        )}
                        <TableCell>
                          <Badge className={getRoleBadgeColor(user.role) + ' text-white'}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(user.status) + ' text-white'}>
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(user.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {user.status === 'pending' ? (
                            // Pending user — show Verify + Delete
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isActionPending}
                                onClick={() => verifyUserMutation.mutate(user.id)}
                                className="gap-1.5 text-green-600 hover:text-green-700 hover:bg-green-50"
                              >
                                <UserCheck className="w-4 h-4" />
                                Verify
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isActionPending}
                                onClick={() => handleDeleteUser(user.id, user.full_name || user.email)}
                                className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </Button>
                            </div>
                          ) : user.role !== 'superadmin' ? (
                            // Active/suspended non-superadmin — show role toggle
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isActionPending}
                              onClick={() => handleRoleToggle(user.id, user.role)}
                              className="gap-2"
                            >
                              {user.role === 'admin' ? (
                                <><ShieldOff className="w-4 h-4" /> Remove Admin</>
                              ) : (
                                <><Shield className="w-4 h-4" /> Make Admin</>
                              )}
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Surveyors Tab */}
        <TabsContent value="surveyors" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Surveyor Management</CardTitle>
            </CardHeader>
            <CardContent>
              {surveyorsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : surveyors.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No surveyors found</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%]">Name</TableHead>
                      <TableHead className="w-[25%]">Email</TableHead>
                      {isSuperAdmin && <TableHead>Company</TableHead>}
                      {isSuperAdmin && <TableHead>Code</TableHead>}
                      <TableHead className="w-[15%]">Status</TableHead>
                      <TableHead className="w-[15%]">Created</TableHead>
                      <TableHead className="text-right w-[15%]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {surveyors.map((surveyor: any) => (
                      <TableRow key={surveyor.id}>
                        <TableCell className="font-medium">{surveyor.name}</TableCell>
                        <TableCell>{surveyor.email || 'N/A'}</TableCell>
                        {isSuperAdmin && (
                          <TableCell className="text-gray-600">
                            {surveyor.company?.name || '—'}
                          </TableCell>
                        )}
                        {isSuperAdmin && (
                          <TableCell>
                            {surveyor.company?.company_code ? (
                              <span className="flex items-center font-mono text-sm text-gray-700">
                                {surveyor.company.company_code}
                                <CopyCodeButton code={surveyor.company.company_code} />
                              </span>
                            ) : '—'}
                          </TableCell>
                        )}
                        <TableCell>
                          <Badge 
                            variant={surveyor.is_active ? 'default' : 'secondary'}
                            className={surveyor.is_active ? 'bg-green-600' : 'bg-gray-400'}
                          >
                            {surveyor.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(surveyor.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={toggleSurveyorMutation.isPending}
                            onClick={() => handleSurveyorToggle(surveyor.id, surveyor.is_active)}
                            className="gap-2"
                          >
                            {surveyor.is_active ? (
                              <><ToggleLeft className="w-4 h-4" /> Deactivate</>
                            ) : (
                              <><ToggleRight className="w-4 h-4" /> Activate</>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.type === 'delete' ? 'Delete User' : 'Confirm Role Change'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.type === 'delete'
                ? `Are you sure you want to delete "${confirmDialog.userName}"? This action cannot be undone.`
                : `Are you sure you want to ${confirmDialog.currentRole === 'admin' ? 'remove admin privileges from' : 'grant admin privileges to'} this user? This will change their access level immediately.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              className={confirmDialog.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {confirmDialog.type === 'delete' ? 'Delete' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};