import { useState } from "react";
import { Bell, User, Search, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * Navbar Component
 * 
 * A reusable navigation bar that appears at the top of pages.
 * 
 * Features:
 * 1. Company branding (left side)
 * 2. Current date display
 * 3. Search functionality (optional)
 * 4. Notifications bell with badge
 * 5. User profile dropdown with logout
 * 6. Mobile menu toggle
 * 7. Responsive design
 * 
 * Props:
 * - showSearch: boolean - Show/hide search bar (default: true)
 * - title: string - Page title to display
 * - subtitle: string - Subtitle/description text
 * - className: string - Additional CSS classes
 * 
 * Usage:
 * <Navbar 
 *   title="Dashboard" 
 *   subtitle="Welcome back! Here's what's happening" 
 *   showSearch={true}
 * />
 */

interface NavbarProps {
  showSearch?: boolean;
  title?: string;
  subtitle?: string;
  className?: string;
  onMenuToggle?: () => void;
}

export const Navbar = ({ 
  showSearch = true, 
  title,
  subtitle,
  className,
  onMenuToggle 
}: NavbarProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  /**
   * Get current date in readable format
   * Example: "Saturday, November 8, 2025"
   */
  const getCurrentDate = () => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return new Date().toLocaleDateString('en-US', options);
  };

  /**
   * Get user initials for avatar
   * Takes first letter of email or "U" as default
   */
  const getUserInitial = () => {
    return user?.email?.charAt(0).toUpperCase() || "U";
  };

  /**
   * Get display name from email
   * Extracts username part before @ symbol
   */
  const getUserName = () => {
    return user?.email?.split('@')[0] || 'User';
  };

  /**
   * Handle user logout
   * Signs out from Supabase and redirects to auth page
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
   * Handle search submission
   * You can customize this to navigate to search results page
   * or filter current page data
   */
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      console.log("Searching for:", searchQuery);
      toast.info(`Searching for: ${searchQuery}`);
      // TODO: Implement actual search functionality
      // navigate(`/search?q=${searchQuery}`);
    }
  };

  /**
   * Toggle mobile menu
   * Can be used to show/hide sidebar on mobile
   */
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
    if (onMenuToggle) {
      onMenuToggle();
    }
  };

  return (
    <nav className={cn(
      "bg-white border-b border-gray-200 sticky top-0 z-40",
      className
    )}>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left Section: Mobile Menu Toggle + Title */}
          <div className="flex items-center gap-4 flex-1">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={toggleMobileMenu}
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>

            {/* Page Title & Subtitle (Hidden on mobile) */}
            {/* {title && (
              <div className="hidden md:block">
                <h1 className="text-xl font-bold text-gray-900">{title}</h1>
                {subtitle && (
                  <p className="text-sm text-gray-500">{subtitle}</p>
                )}
              </div>
            )} */}
          </div>

          {/* Center Section: Search Bar */}
          {showSearch && (
            <div className="hidden md:flex flex-1 max-w-md mx-4">
              <form onSubmit={handleSearch} className="w-full">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search claims, policies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-full"
                  />
                </div>
              </form>
            </div>
          )}

          {/* Right Section: Date, Notifications, Profile */}
          <div className="flex items-center gap-4">
            {/* Current Date (Hidden on small screens) */}
            <div className="hidden xl:block text-sm text-gray-600">
              {getCurrentDate()}
            </div>

            {/* Notifications Button with Badge */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="relative">
                  <Bell className="w-5 h-5 text-gray-600" />
                  {/* Notification Badge */}
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                  >
                    2
                  </Badge>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-[300px] overflow-y-auto">
                  {/* Sample Notifications */}
                  <DropdownMenuItem className="flex flex-col items-start p-3 cursor-pointer">
                    <p className="font-medium text-sm">New claim submitted</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Claim #CLM-2024-001 requires your attention
                    </p>
                    <p className="text-xs text-gray-400 mt-1">2 hours ago</p>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="flex flex-col items-start p-3 cursor-pointer">
                    <p className="font-medium text-sm">Survey completed</p>
                    <p className="text-xs text-gray-500 mt-1">
                      John Smith completed survey for claim #CLM-2024-002
                    </p>
                    <p className="text-xs text-gray-400 mt-1">5 hours ago</p>
                  </DropdownMenuItem>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-center justify-center text-blue-600 cursor-pointer">
                  View all notifications
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <Avatar className="w-8 h-8 bg-blue-100">
                    <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold text-sm">
                      {getUserInitial()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden lg:block text-left">
                    <p className="text-sm font-medium text-gray-900">
                      {getUserName()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {user?.email}
                    </p>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => navigate("/profile")}
                  className="cursor-pointer"
                >
                  <User className="w-4 h-4 mr-2" />
                  Profile Settings
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => navigate("/settings")}
                  className="cursor-pointer"
                >
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleSignOut}
                  className="cursor-pointer text-red-600 focus:text-red-600"
                >
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile Search Bar (appears below main nav on mobile) */}
        {showSearch && (
          <div className="md:hidden pb-4">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
            </form>
          </div>
        )}
      </div>
    </nav>
  );
};