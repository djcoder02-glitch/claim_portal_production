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
  Loader2
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

export const TeamManagement = () => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'toggle' | 'role';
    userId?: string;
    currentStatus?: boolean;
    currentRole?: string;
  }>({ open: false, type: 'toggle' });

  // Fetch users in the same company
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['team-users'],
    queryFn: async () => {
      if (!currentUser?.id) {
        throw new Error('User not authenticated');
      }

      // Get current user's company
      const { data: currentUserData, error: userError } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', currentUser.id)
        .single();

      if (userError) throw userError;

      if (!currentUserData?.company_id) {
        throw new Error('No company found for current user');
      }

      // Fetch all users in the same company
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('company_id', currentUserData.company_id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data as User[];
    },
    enabled: !!currentUser?.id, // Only run query if user is logged in
  });

  // Fetch surveyors in the same company
  const { data: surveyors = [], isLoading: surveyorsLoading } = useQuery({
    queryKey: ['surveyors'],
    queryFn: async () => {
      if (!currentUser?.id) {
        throw new Error('User not authenticated');
      }

      // Get current user's company
      const { data: currentUserData, error: userError } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', currentUser.id)
        .single();

      if (userError) throw userError;

      if (!currentUserData?.company_id) {
        throw new Error('No company found for current user');
      }

      const { data, error } = await supabase
        .from('surveyors')
        .select('*')
        .eq('company_id', currentUserData.company_id)
        .order('name');
      
      if (error) throw error;
      
      return data as Surveyor[];
    },
    enabled: !!currentUser?.id, // Only run query if user is logged in
  });

  // Toggle user role mutation
  const toggleRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: 'admin' | 'user' }) => {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-users'] });
      toast.success("User role updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update role: " + error.message);
    },
  });

  // Toggle surveyor active status
  const toggleSurveyorMutation = useMutation({
    mutationFn: async ({ surveyorId, isActive }: { surveyorId: string; isActive: boolean }) => {
      const newStatus = !isActive;
      const { error } = await supabase
        .from('surveyors')
        .update({ is_active: newStatus })
        .eq('id', surveyorId);
      
      if (error) throw error;
      return newStatus;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveyors'] });
      toast.success("Surveyor status updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update status: " + error.message);
    },
  });

  const handleRoleToggle = (userId: string, currentRole: string) => {
    setConfirmDialog({
      open: true,
      type: 'role',
      userId,
      currentRole,
    });
  };

  const confirmRoleChange = () => {
    if (confirmDialog.userId && confirmDialog.currentRole) {
      const newRole = confirmDialog.currentRole === 'admin' ? 'user' : 'admin';
      toggleRoleMutation.mutate({ userId: confirmDialog.userId, newRole: newRole as 'admin' | 'user' });
    }
    setConfirmDialog({ open: false, type: 'toggle' });
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

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Team Management</h1>
        <p className="text-gray-600 mt-1">Manage users, roles, and surveyors</p>
      </div>

      {/* Tabs for Users and Surveyors */}
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
                <div className="text-center py-12 text-gray-500">
                  No users found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.full_name || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {user.email}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={getRoleBadgeColor(user.role) + ' text-white'}
                          >
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={getStatusBadgeColor(user.status) + ' text-white'}
                          >
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(user.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {user.role !== 'superadmin' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRoleToggle(user.id, user.role)}
                              className="gap-2"
                            >
                              {user.role === 'admin' ? (
                                <>
                                  <ShieldOff className="w-4 h-4" />
                                  Remove Admin
                                </>
                              ) : (
                                <>
                                  <Shield className="w-4 h-4" />
                                  Make Admin
                                </>
                              )}
                            </Button>
                          )}
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
                <div className="text-center py-12 text-gray-500">
                  No surveyors found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%]">Name</TableHead>
                      <TableHead className="w-[25%]">Email</TableHead>
                      <TableHead className="w-[15%]">Status</TableHead>
                      <TableHead className="w-[15%]">Created</TableHead>
                      <TableHead className="text-right w-[15%]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {surveyors.map((surveyor) => (
                      <TableRow key={surveyor.id}>
                        <TableCell className="font-medium">
                          {surveyor.name}
                        </TableCell>
                        <TableCell>
                          {surveyor.email || 'N/A'}
                        </TableCell>
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
                            onClick={() => handleSurveyorToggle(surveyor.id, surveyor.is_active)}
                            className="gap-2"
                          >
                            {surveyor.is_active ? (
                              <>
                                <ToggleLeft className="w-4 h-4" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <ToggleRight className="w-4 h-4" />
                                Activate
                              </>
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
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Role Change</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {confirmDialog.currentRole === 'admin' ? 'remove admin privileges from' : 'grant admin privileges to'} this user?
              This will change their access level immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};