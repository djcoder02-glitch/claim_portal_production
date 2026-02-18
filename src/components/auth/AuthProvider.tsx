/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type UserRole = 'superadmin' | 'admin' | 'user';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRole: UserRole | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  companyId?: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  userRole: null,
  isAdmin: false,
  isSuperAdmin: false,
  companyId: null,
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role, status, company_id')
        .eq('id', userId)
        .maybeSingle(); // Changed from .single() to .maybeSingle()
      
      if (error) {
        console.error('Error fetching user role:', error);
        setUserRole('user');
        return;
      }

      if (!data) {
        console.log('No user profile found - user may need to complete signup');
        setUserRole(null);
        return;
      }

      if (data.status === 'pending') {
        console.log('User is pending approval');
        setUserRole(null);
        return;
      }

      if (data.status === 'suspended') {
        console.log('User is suspended');
        setUserRole(null);
        return;
      }

      if (data.status !== 'active') {
        console.log('User is not active:', data.status);
        setUserRole(null);
        return;
      }

      setUserRole((data.role as UserRole) || 'user');
      setCompanyId(data.company_id || null);
    } catch (error) {
      console.error('Unexpected error fetching user role:', error);
      setUserRole('user');
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRole(session.user.id);
      }
      
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          fetchUserRole(session.user.id);
        } else {
          setUserRole(null);
          setCompanyId(null);
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const isAdmin = userRole === 'admin';
  const isSuperAdmin = userRole === 'superadmin';

  return (
    <AuthContext.Provider value={{ user, session, loading, userRole, isAdmin, isSuperAdmin, companyId }}>
      {children}
    </AuthContext.Provider>
  );
};
