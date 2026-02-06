import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { Dashboard } from "./pages/Dashboard";
import { ClaimsDashboard } from "@/components/claims/ClaimsDashboard";
import { ClaimDetails } from "./components/claims/ClaimDetails";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Analytics from "./pages/Analytics";
import HelpCenter from "./pages/HelpCenter";
import Profile from "./pages/Profile";
import {TeamManagement} from "./pages/TeamManagement";
import Setting from "./pages/Settings";
import Brokers from "./pages/Brokers";
import Customers from "./pages/Customers";
import {ValueAddedServices} from "./pages/ValueAddedServices";
import {Clients} from "./pages/Clients";
import { PublicUpload } from "./pages/PublicUpload"; 
import { VASReportsDashboard } from "./pages/VASReportsDashboard";
import { ClientReportsDashboard } from "./pages/ClientReportsDashboard";
import { VASReportDetail } from "./pages/VASReportDetail";
import { ClientReportDetail } from "./pages/ClientReportDetail";
import {ImageGenerator} from "./pages/ImageGenerator"
import CompanyManagement from "@/pages/CompanyManagement";
import Notifications from "./pages/Notifications";
import { Agents } from "./pages/Agents";
import { AgentsBrokers } from "./pages/AgentsBrokers";

const queryClient = new QueryClient();

/**
 * Main App Component
 * 
 * This is the root component that sets up:
 * 1. React Query for data fetching and caching
 * 2. Authentication context
 * 3. Toast notifications (both Toaster and Sonner)
 * 4. Routing structure with protected routes
 * 
 * Route Structure:
 * - /auth: Public authentication page
 * - / : Dashboard overview (protected, with layout)
 * - /claims: Claims management page (protected, with layout)
 * - /claims/:id: Individual claim details (protected, without layout for full-width view)
 * - /analytics, /settings, etc.: Placeholder pages (protected, with layout)
 * 
 * The DashboardLayout provides the left sidebar navigation and wraps all main pages
 * except the claim details page which needs full-width layout.
 */
const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Route */}
            <Route path="/auth" element={<Auth />} />
            {/* Public Upload Route - No Authentication Required */}
            <Route path="/public-upload" element={<PublicUpload />} />
            
            {/* Protected Routes with Dashboard Layout */}
            <Route 
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              {/* Main Dashboard Overview */}
              <Route path="/" element={<Dashboard />} />
              
              {/* Claims Management */}
              <Route path="/claims" element={<ClaimsDashboard />} />
              
              {/* Analytics */}
              <Route path="analytics" element={<Analytics />} />
              
              {/* Settings */}
              <Route 
                path="/settings" 
                element={<Setting />} 
              />
              
              {/* Management */}
              <Route 
                path="/management" 
                element={
                  <ProtectedRoute requireAdmin={true}>
                    <TeamManagement />
                  </ProtectedRoute>
                } 
              />
              
              {/* Profile */}
              <Route path="/profile" element={<Profile />} />
              
              {/* Help */}
              <Route path="/help" element={<HelpCenter />} />
              
              {/* Agents and Brokers */}
              <Route path="/agents-brokers" element={<AgentsBrokers />} />
              
              {/* Customers */}
              <Route path="/customers" element={<Customers />} />
              
              {/* Image Generator */}
              <Route path="/image-generator" element={<ImageGenerator />} />
              
              {/* VAS Management (old page) */}
              <Route path="/value-added-services" element={<ValueAddedServices />} />
              
              {/* Clients Management (old page) */}
              <Route path="/clients" element={<Clients />} />
              
              {/* VAS Reports Dashboard - NEW */}
              <Route path="/value-added-services/reports" element={<VASReportsDashboard />} />
              
              {/* Client Reports Dashboard - NEW */}
              <Route path="/clients/reports" element={<ClientReportsDashboard />} />

              {/* Company Management */}
              <Route path="/company-management" element={<CompanyManagement />} />
              
              {/* Notifications */}
              <Route 
                path="/notifications" 
                element={
                  <Notifications />
                } 
              />
            </Route>
            
            {/* Full-Width Detail Pages (Outside DashboardLayout) */}
            
            {/* Claim Details - Full Width (No Layout) */}
            <Route 
              path="/claims/:id" 
              element={
                <ProtectedRoute>
                  <ClaimDetails />
                </ProtectedRoute>
              } 
            />
            
            {/* VAS Report Details - Full Width (No Layout) - NEW */}
            <Route 
              path="/value-added-services/reports/:id" 
              element={
                <ProtectedRoute>
                  <VASReportDetail />
                </ProtectedRoute>
              } 
            />
            
            {/* Client Report Details - Full Width (No Layout) - NEW */}
            <Route 
              path="/clients/reports/:id" 
              element={
                <ProtectedRoute>
                  <ClientReportDetail />
                </ProtectedRoute>
              } 
            />
            
            {/* 404 Catch-All */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;