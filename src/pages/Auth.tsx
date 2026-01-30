import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { LayoutDashboard, Loader2 } from "lucide-react";

interface Company {
  id: string;
  name: string;
}

const Auth = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  // Sign In Form State
  const [signInData, setSignInData] = useState({
    email: "",
    password: "",
  });

  // Sign Up Form State
  const [signUpData, setSignUpData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    displayName: "",
    phone: "",
    companyId: "",
  });

  // Fetch available companies
useEffect(() => {
  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .neq('id', '00000000-0000-0000-0000-000000000001') // Exclude SuperAdmin company
        .order('name');
      
      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast.error('Failed to load companies');
    } finally {
      setLoadingCompanies(false);
    }
  };

  fetchCompanies();
}, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signInData.email || !signInData.password) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: signInData.email,
        password: signInData.password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password');
        }
        throw error;
      }

      // Check user status
      if (data.user) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('status, company_id')
          .eq('id', data.user.id)
          .single();

        if (userError) {
          console.error('Error fetching user status:', userError);
          await supabase.auth.signOut();
          throw new Error('Failed to verify account status');
        }

        if (userData.status === 'pending') {
          await supabase.auth.signOut();
          toast.error('Your account is pending approval. Please contact your administrator.');
          return;
        }

        if (userData.status === 'suspended') {
          await supabase.auth.signOut();
          toast.error('Your account has been suspended. Please contact your administrator.');
          return;
        }
      }
      
      toast.success("Signed in successfully!");
      navigate("/");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!signUpData.email || !signUpData.password || !signUpData.confirmPassword || !signUpData.displayName || !signUpData.companyId) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(signUpData.email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (signUpData.password !== signUpData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (signUpData.password.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    // Password strength check
    const hasUpperCase = /[A-Z]/.test(signUpData.password);
    const hasLowerCase = /[a-z]/.test(signUpData.password);
    const hasNumber = /[0-9]/.test(signUpData.password);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      toast.error("Password must contain uppercase, lowercase, and numbers");
      return;
    }

    setIsSubmitting(true);
    let authUserId: string | null = null;

    try {
      // Step 1: Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: signUpData.email,
        password: signUpData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            display_name: signUpData.displayName,
          }
        },
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          throw new Error('This email is already registered');
        }
        throw authError;
      }

      if (!authData.user) {
        throw new Error('Failed to create account');
      }

      authUserId = authData.user.id;

      // Step 2: Create user record
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: signUpData.email,
          full_name: signUpData.displayName,
          phone: signUpData.phone || null,
          company_id: signUpData.companyId,
          role: 'user',
          status: 'pending'
        });
      
      if (userError) {
        console.error('User creation error:', userError);
        throw new Error('Failed to create user profile');
      }

      // Step 3: Create pending request
      const { error: requestError } = await supabase
        .from('pending_user_requests')
        .insert({
          user_id: authData.user.id,
          company_id: signUpData.companyId,
          status: 'pending'
        });

      if (requestError) {
        console.error('Request creation error:', requestError);
        // Non-critical error, continue
      }

      // Success
      toast.success(
        "Account created successfully! Your request has been sent to the company administrator for approval.",
        { duration: 6000 }
      );

      // Sign out the user (they need approval first)
      await supabase.auth.signOut();

      // Reset form
      setSignUpData({
        email: "",
        password: "",
        confirmPassword: "",
        displayName: "",
        phone: "",
        companyId: "",
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      toast.error(errorMessage);

      // Rollback: Delete auth user if created
      if (authUserId) {
        try {
          // Note: Supabase doesn't allow direct user deletion via client
          // You'll need an admin function for this, or accept orphaned auth users
          console.error('Auth user created but profile failed. User ID:', authUserId);
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center pb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center">
              <LayoutDashboard className="w-10 h-10 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">Insurance Claims Portal</CardTitle>
          <CardDescription>Multi-Company Claims Management System</CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            {/* Sign In Tab */}
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email *</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="you@company.com"
                    value={signInData.email}
                    onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password *</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={signInData.password}
                    onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* Sign Up Tab */}
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                {/* Company Selection */}
                <div className="space-y-2">
                  <Label htmlFor="signup-company">Company *</Label>
                  {loadingCompanies ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    </div>
                  ) : (
                    <Select
                      value={signUpData.companyId}
                      onValueChange={(value) => setSignUpData({ ...signUpData, companyId: value })}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select your company" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Email and Phone */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email *</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@company.com"
                      value={signUpData.email}
                      onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                      disabled={isSubmitting}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-phone">Phone Number</Label>
                    <Input
                      id="signup-phone"
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={signUpData.phone}
                      onChange={(e) => setSignUpData({ ...signUpData, phone: e.target.value })}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
                
                {/* Display Name */}
                <div className="space-y-2">
                  <Label htmlFor="signup-displayname">Full Name *</Label>
                  <Input
                    id="signup-displayname"
                    type="text"
                    placeholder="John Doe"
                    value={signUpData.displayName}
                    onChange={(e) => setSignUpData({ ...signUpData, displayName: e.target.value })}
                    disabled={isSubmitting}
                    required
                  />
                </div>

                {/* Password Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password *</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signUpData.password}
                      onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                      disabled={isSubmitting}
                      required
                    />
                    <p className="text-xs text-gray-500">
                      Min 8 characters, uppercase, lowercase, and numbers
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password">Confirm Password *</Label>
                    <Input
                      id="signup-confirm-password"
                      type="password"
                      placeholder="••••••••"
                      value={signUpData.confirmPassword}
                      onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={isSubmitting || loadingCompanies}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Request Access"
                  )}
                </Button>

                <p className="text-xs text-gray-500 text-center mt-2">
                  * Required fields. Your request will be sent to your company administrator for approval.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
