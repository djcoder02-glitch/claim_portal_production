import { useEffect, useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { 
  LayoutDashboard, 
  FileText, 
  BarChart3, 
  Settings, 
  Users,
  User,
  HelpCircle,
  UserCog,
  Building2,
  Bell,
  LogOut,Star,
  ChevronLeft,Image
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Navbar } from "./Navbar";


/**
 * Navigation item interface for type safety
 */
interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

/**
 * Main navigation items shown in the left sidebar
 */

const getMainNavItems = (isAdmin: boolean, isSuperadmin: boolean): NavItem[] => {
  const baseItems = [
    {
      title: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
    },
    {
      title: "Claims",
      href: "/claims",
      icon: FileText,
    },
  ];

  // Add VAS and Clients for superadmin only
  if (isSuperadmin) {
    baseItems.push(
      {
        title: "Value Added Services",
        href: "/value-added-services/reports",
        icon: Star,
      },
      {
        title: "Clients",
        href: "/clients/reports",
        icon: Building2,
      }
    );
  }

  if (isAdmin || isSuperadmin) {
    return [
      ...baseItems,
      ...(isSuperadmin ? [{
        title: "Company Management",
        href: "/company-management",
        icon: Building2,
      }] : []),
      {
        title: "Analytics",
        href: "/analytics",
        icon: BarChart3,
      },
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
      },
      {
        title: "Management",
        href: "/management",
        icon: Users,
      },
      {
        title: "Image Generator",
        href: "/image-generator",
        icon: Image,
      },
    ];
  }

  return baseItems;
};
/**
 * Secondary navigation items (shown under "Other" section)
 */
const getOtherNavItems = (isAdmin: boolean, isSuperadmin: boolean): NavItem[] => {
  if (isAdmin || isSuperadmin) {
    return [
      {
        title: "Profile",
        href: "/profile",
        icon: User,
      },
      {
        title: "Help Center",
        href: "/help",
        icon: HelpCircle,
      },
      {
        title: "Agents and Brokers",
        href: "/agents-brokers",
        icon: UserCog,
      },
      {
        title: "Customers",
        href: "/customers",
        icon: Building2,
      },
      {
        title: "Notifications",
        href: "/notifications",
        icon: Bell,
        badge: 2,
      },
    ];
  }

  return [
    {
      title: "Profile",
      href: "/profile",
      icon: User,
    },
     {
        title: "Help Center",
        href: "/help",
        icon: HelpCircle,
      },
  ];
};
/**
 * Get page title based on current route
 */
const getPageTitle = (pathname: string): { title: string; subtitle: string } => {
  const routes: Record<string, { title: string; subtitle: string }> = {
    '/': {
      title: 'Dashboard',
      subtitle: "Welcome back! Here's what's happening with your insurance surveys."
    },
    '/claims': {
      title: 'Claims Management',
      subtitle: 'Manage and track your insurance claims'
    },
    '/analytics': {
      title: 'Analytics',
      subtitle: 'View insights and performance metrics'
    },
    '/settings': {
      title: 'Settings',
      subtitle: 'Manage your account and preferences'
    },
    '/management': {
      title: 'Management',
      subtitle: 'Manage users, roles, and permissions'
    },
     '/value-added-services': {
      title: 'Value Added Services',
      subtitle: 'Manage your value-added service offerings'
    },
    '/value-added-services/reports': {
      title: 'VAS Reports Dashboard',
      subtitle: 'Manage and track your value-added service reports'
    },
    '/clients': {
      title: 'Client Management',
      subtitle: 'Manage client companies and addresses'
    },
    '/clients/reports': {
      title: 'Client Reports Dashboard',
      subtitle: 'Manage and track your client service reports'
    },
    '/profile': {
      title: 'Profile',
      subtitle: 'View and edit your profile information'
    },
    '/help': {
      title: 'Help Center',
      subtitle: 'Get help and support'
    },
    '/employees': {
      title: 'Employees',
      subtitle: 'Manage employee records'
    },
    '/customers': {
      title: 'Customers',
      subtitle: 'Manage customer information'
    },
    '/notifications': {
      title: 'Notifications',
      subtitle: 'View all your notifications'
    },
  };

  return routes[pathname] || { title: 'Dashboard', subtitle: '' };
};

/**
 * DashboardLayout Component
 * 
 * This is the main layout wrapper that provides:
 * - Left sidebar navigation with collapsible sections
 * - Top navbar (visible on all pages except /claims)
 * - User profile information
 * - Dynamic active link highlighting
 * - Logout functionality
 * - Responsive design with mobile support
 * 
 * Key Features:
 * 1. React Router integration for navigation
 * 2. Authentication context for user data
 * 3. Badge support for notification counts
 * 4. Collapsible sidebar for better UX
 * 5. Conditional navbar display (hidden on claims page)
 */
export const DashboardLayout = () => {
  const { isAdmin, user } = useAuth();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [userStatus, setUserStatus] = useState<string>('user');
  const [isSuperadmin, setIsSuperadmin] = useState<boolean>(false);

useEffect(() => {
  if (user?.id) {
    supabase
      .from('users')
      .select('full_name, role, status')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.full_name) {
          setDisplayName(data.full_name);
        }
        if (data?.role) {
          setUserStatus(data.role);
          setIsSuperadmin(data.role === 'superadmin');
        }
      });
  }
}, [user?.id]);
  console.log("User Role:", userStatus);
  console.log("Is Superadmin:", isSuperadmin);
  console.log("Is Admin:", isAdmin);
  const mainNavItems = getMainNavItems(isAdmin, isSuperadmin);
  const otherNavItems = getOtherNavItems(isAdmin, isSuperadmin);
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Check if we're on the claims page
  const isClaimsPage = location.pathname === '/claims';

  // Get page title and subtitle
  const { title, subtitle } = getPageTitle(location.pathname);

  /**
   * Handle user logout
   * - Signs out from Supabase
   * - Shows success/error toast
   * - Redirects to auth page
   */
  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
    } else {
      toast.success("Signed out successfully");
      navigate("/auth");
    }
  };

  /**
   * Get user initials for avatar
   * Extracts first letter of email
   */
  const getUserInitial = () => {
    return user?.email?.charAt(0).toUpperCase() || "U";
  };

  /**
   * Toggle mobile sidebar
   */
  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  /**
   * NavLink Component
   * Reusable navigation link with active state styling
   */
  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = location.pathname === item.href;
    const Icon = item.icon;

    return (
      <Link
        to={item.href}
        onClick={() => setIsMobileSidebarOpen(false)}
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
          "hover:bg-blue-50 group relative",
          isActive && "bg-blue-600 text-white hover:bg-blue-700",
          !isActive && "text-gray-700 hover:text-gray-900"
        )}
      >
        <Icon className={cn(
          "w-5 h-5 flex-shrink-0",
          isActive ? "text-white" : "text-gray-500 group-hover:text-gray-700"
        )} />
        {!isCollapsed && (
          <>
            <span className="text-sm font-medium flex-1">{item.title}</span>
            {item.badge && (
              <Badge 
                variant="destructive" 
                className="ml-auto h-5 px-2"
              >
                {item.badge}
              </Badge>
            )}
          </>
        )}
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside
        className={cn(
          "bg-white border-r border-gray-200 flex flex-col transition-all duration-300 z-50",
          "fixed lg:relative inset-y-0 left-0",
          isCollapsed ? "w-20" : "w-64",
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header with Logo and Company Name */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <LayoutDashboard className="w-6 h-6 text-white" />
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-gray-900 truncate">
                  Vantage Solutions
                </h2>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Main Navigation Section */}
          <div className="space-y-1">
            {!isCollapsed && (
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 mb-2">
                Main
              </p>
            )}
            {mainNavItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>

          {/* Other/Secondary Navigation Section */}
          {isAdmin && otherNavItems.length > 0 && (
            <div className="space-y-1">
              {!isCollapsed && (
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 mb-2">
                  Other
                </p>
              )}
              {otherNavItems.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </div>
          )}
          
          {/* User Profile Section (when not admin) */}
          {!isAdmin && otherNavItems.length > 0 && (
            <div className="space-y-1">
              {otherNavItems.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </div>
          )}

        </nav>

        {/* User Profile Section at Bottom */}
        <div className="p-4 border-t border-gray-200">
          {!isCollapsed ? (
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="w-10 h-10 bg-blue-100">
                <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold">
                  {getUserInitial()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {displayName || user?.email?.split('@')[0] || 'User'}
                </p>
                <p className="text-xs text-gray-500 truncate capitalize">
                  {userStatus === 'superadmin' ? 'Super Admin' : userStatus === 'admin' ? 'Admin' : 'User'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center mb-3">
              <Avatar className="w-10 h-10 bg-blue-100">
                <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold">
                  {getUserInitial()}
                </AvatarFallback>
              </Avatar>
            </div>
          )}

          {/* Logout Button */}
          <Button
            onClick={handleSignOut}
            variant="ghost"
            className={cn(
              "w-full text-gray-700 hover:bg-red-50 hover:text-red-600",
              isCollapsed && "px-2"
            )}
          >
            <LogOut className="w-4 h-4" />
            {!isCollapsed && <span className="ml-2">Logout</span>}
          </Button>

          {/* Collapse Toggle Button */}
          <Button
            onClick={() => setIsCollapsed(!isCollapsed)}
            variant="ghost"
            size="sm"
            className="w-full mt-2 hidden lg:flex"
          >
            <ChevronLeft 
              className={cn(
                "w-4 h-4 transition-transform",
                isCollapsed && "rotate-180"
              )} 
            />
            {!isCollapsed && <span className="ml-2 text-xs">Collapse</span>}
          </Button>
        </div>
        </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Conditional Navbar - Show on all pages except /claims */}
        { !isClaimsPage && (
          <Navbar 
            title={title}
            subtitle={subtitle}
            showSearch={true}
            onMenuToggle={toggleMobileSidebar}
          />
        )}

        {/* Page Content - Scrollable */}
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};