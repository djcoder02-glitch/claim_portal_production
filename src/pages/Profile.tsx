import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Mail, Phone, MapPin, Briefcase, IdCard } from "lucide-react";

interface ProfileFormData {
  full_name: string;
  phone: string | null;
}

const Profile = () => {
  const { user, userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [claimsStats, setClaimsStats] = useState({
    totalClaims: 0,
    completedClaims: 0,
    activeClaims: 0,
  });

  const { register, handleSubmit, setValue } = useForm<ProfileFormData>();

  useEffect(() => {
    if (user) {
      loadProfile();
      loadClaimsStats();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('full_name, phone')
        .eq('id', user!.id)
        .single();

      if (error) throw error;

      if (data) {
        setValue('full_name', data.full_name || '');
        setValue('phone', data.phone || '');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const loadClaimsStats = async () => {
    try {
      const { data: claims, error } = await supabase
        .from('claims')
        .select('id, status')
        .eq('created_by', user!.id);

      if (error) throw error;

      const total = claims?.length || 0;
      const completed = claims?.filter(c => c.status === 'approved' || c.status === 'closed').length || 0;
      const active = claims?.filter(c => c.status !== 'approved' && c.status !== 'closed' && c.status !== 'rejected').length || 0;

      setClaimsStats({
        totalClaims: total,
        completedClaims: completed,
        activeClaims: active,
      });
    } catch (error) {
      console.error('Error loading claims stats:', error);
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name: data.full_name,
          phone: data.phone,
        })
        .eq('id', user!.id);

      if (error) throw error;

      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const getUserInitial = () => {
    return user?.email?.charAt(0).toUpperCase() || "U";
  };

  const getRoleBadgeColor = () => {
    switch (userRole) {
      case 'superadmin': return 'bg-purple-500';
      case 'admin': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getRoleLabel = () => {
    switch (userRole) {
      case 'superadmin': return 'Super Admin';
      case 'admin': return 'Admin';
      default: return 'User';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-600 mt-2">Manage your personal information and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Profile Card */}
        <Card className="lg:col-span-1">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="w-32 h-32 mb-4 bg-blue-100">
                <AvatarFallback className="bg-blue-600 text-white text-4xl font-bold">
                  {getUserInitial()}
                </AvatarFallback>
              </Avatar>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                {user?.email?.split('@')[0] || 'User'}
              </h2>
              
              <Badge className={`${getRoleBadgeColor()} text-white mb-4`}>
                {getRoleLabel()}
              </Badge>

              <div className="flex items-center text-gray-600 mb-2">
                <Mail className="w-4 h-4 mr-2" />
                <span className="text-sm">{user?.email}</span>
              </div>

              <Badge variant="outline" className="text-green-600 border-green-600">
                Active
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Profile Form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Personal Information
            </CardTitle>
            <CardDescription>
              Update your personal details and contact information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="full_name">Display Name</Label>
                <Input
                  id="full_name"
                  placeholder="How you want to be called"
                  {...register('full_name')}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <Input
                      id="email"
                      value={user?.email || ''}
                      disabled
                      className="pl-10 bg-gray-50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <Input
                      id="phone"
                      placeholder="+91 98765 43210"
                      className="pl-10"
                      {...register('phone')}
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" disabled={saving} className="w-full md:w-auto">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Activity Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-6 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Tasks Completed</h3>
                  <Briefcase className="w-8 h-8 text-blue-600" />
                </div>
                <p className="text-3xl font-bold text-gray-900">{claimsStats.completedClaims}</p>
                <p className="text-sm text-gray-500 mt-1">Out of {claimsStats.totalClaims} total claims</p>
              </div>

              <div className="bg-green-50 p-6 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Completion Rate</h3>
                  <IdCard className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  {claimsStats.totalClaims > 0 
                    ? Math.round((claimsStats.completedClaims / claimsStats.totalClaims) * 100) 
                    : 0}%
                </p>
                <p className="text-sm text-gray-500 mt-1">Keep going</p>
              </div>

              <div className="bg-purple-50 p-6 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Active Claims</h3>
                  <MapPin className="w-8 h-8 text-purple-600" />
                </div>
                <p className="text-3xl font-bold text-gray-900">{claimsStats.activeClaims}</p>
                <p className="text-sm text-gray-500 mt-1">In progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile; 