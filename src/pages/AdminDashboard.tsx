import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  FileText, 
  Users,
  DollarSign,
  TrendingUp,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { Link } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthProvider";

interface StatCard {
  title: string;
  value: string | number;
  change: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBgColor: string;
}

const COLORS = {
  pending: 'rgb(37, 99, 235)',
  submitted: 'rgb(245, 158, 11)',
  under_review: 'rgb(59, 130, 246)',
  approved: 'rgb(16, 185, 129)',
  rejected: 'rgb(239, 68, 68)',
  closed: 'rgb(107, 114, 128)',
};

export const AdminDashboard = () => {
  const { user } = useAuth();

  // Fetch claims for the company
  const { data: claims = [], isLoading: claimsLoading } = useQuery({
    queryKey: ['admin-claims'],
    queryFn: async () => {
      console.log('[Dashboard] Fetching claims...');
      
      // Get user's company
      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user?.id)
        .single();

      if (!userData?.company_id) {
        throw new Error('No company found');
      }

      const { data, error } = await supabase
        .from('claims')
        .select('*')
        .eq('company_id', userData.company_id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[Dashboard] Error fetching claims:', error);
        throw error;
      }
      
      console.log('[Dashboard] Fetched claims:', data?.length);
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch users in company
  const { data: users = [] } = useQuery({
    queryKey: ['company-users'],
    queryFn: async () => {
      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user?.id)
        .single();

      if (!userData?.company_id) return [];

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('company_id', userData.company_id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch surveyors in company
  const { data: surveyors = [] } = useQuery({
    queryKey: ['company-surveyors'],
    queryFn: async () => {
      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user?.id)
        .single();

      if (!userData?.company_id) return [];

      const { data, error } = await supabase
        .from('surveyors')
        .select('*')
        .eq('company_id', userData.company_id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Calculate monthly trend data
  const monthlyTrendData = useMemo(() => {
    if (!claims.length) return [];

    const months = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(new Date(), 5 - i);
      return {
        date,
        month: format(date, 'MMM'),
        start: startOfMonth(date),
        end: endOfMonth(date)
      };
    });

    return months.map(({ month, start, end }) => {
      const monthClaims = claims.filter(claim => {
        const claimDate = new Date(claim.created_at);
        return claimDate >= start && claimDate <= end;
      });

      const revenue = monthClaims.reduce((sum, claim) => 
        sum + (claim.claim_amount || 0), 0
      );

      return {
        month,
        claims: monthClaims.length,
        revenue: revenue / 1000 // Convert to thousands
      };
    });
  }, [claims]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalClaims = claims.length;
    const activeClaims = claims.filter(c => 
      c.status !== 'approved' && c.status !== 'closed' && c.status !== 'rejected'
    ).length;
    const completedClaims = claims.filter(c => 
      c.status === 'approved' || c.status === 'closed'
    ).length;
    const totalRevenue = claims.reduce((sum, claim) => 
      sum + (claim.claim_amount || 0), 0
    );

    const currentMonthClaims = monthlyTrendData[monthlyTrendData.length - 1]?.claims || 0;
    const lastMonthClaims = monthlyTrendData[monthlyTrendData.length - 2]?.claims || 0;
    const claimsGrowth = lastMonthClaims > 0
      ? (((currentMonthClaims - lastMonthClaims) / lastMonthClaims) * 100).toFixed(1)
      : 0;

    return {
      totalClaims,
      activeClaims,
      completedClaims,
      totalRevenue,
      claimsGrowth: Number(claimsGrowth),
      activeUsers: users.filter(u => u.status === 'active').length,
      activeSurveyors: surveyors.filter(s => s.is_active).length,
    };
  }, [claims, users, surveyors, monthlyTrendData]);

  // Status distribution
  const statusDistribution = useMemo(() => {
    const statusData = [
      { 
        name: 'Approved', 
        value: claims.filter(c => c.status === 'approved').length,
        color: COLORS.approved
      },
      { 
        name: 'Pending', 
        value: claims.filter(c => c.status === 'under_review' || c.status === 'draft').length,
        color: COLORS.pending
      },
      { 
        name: 'Submitted', 
        value: claims.filter(c => c.status === 'submitted').length,
        color: COLORS.submitted
      },
      { 
        name: 'Under Review', 
        value: claims.filter(c => c.status === 'under_review').length,
        color: COLORS.under_review
      },
      { 
        name: 'Rejected', 
        value: claims.filter(c => c.status === 'rejected').length,
        color: COLORS.rejected
      },
      { 
        name: 'Closed', 
        value: claims.filter(c => c.status === 'closed').length,
        color: COLORS.closed
      },
    ];
    
    return statusData.filter(item => item.value > 0);
  }, [claims]);

  // Recent claims
  const recentClaims = useMemo(() => {
    return [...claims]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5);
  }, [claims]);

  const statCards: StatCard[] = [
    {
      title: 'Total Claims',
      value: stats.totalClaims.toLocaleString(),
      change: `${stats.claimsGrowth >= 0 ? '+' : ''}${stats.claimsGrowth}% from last month`,
      description: 'All claims in the system',
      icon: FileText,
      iconBgColor: 'bg-blue-100 text-blue-600',
    },
    {
      title: 'Active Claims',
      value: stats.activeClaims.toLocaleString(),
      change: `${stats.completedClaims} completed`,
      description: 'In progress claims',
      icon: Clock,
      iconBgColor: 'bg-yellow-100 text-yellow-600',
    },
    {
      title: 'Team Members',
      value: stats.activeUsers,
      change: `${stats.activeSurveyors} surveyors`,
      description: 'Active users in system',
      icon: Users,
      iconBgColor: 'bg-green-100 text-green-600',
    },
    {
      title: 'Total Value',
      value: `₹${(stats.totalRevenue / 100000).toFixed(1)}L`,
      change: 'Total claim amount',
      description: 'All time value',
      icon: DollarSign,
      iconBgColor: 'bg-purple-100 text-purple-600',
    },
  ];

  if (claimsLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Welcome back! Here's what's happening with your company.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      {stat.title}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-3xl font-bold text-gray-900">
                        {stat.value}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      {stat.change}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${stat.iconBgColor}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Claims & Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="claims" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    name="Claims"
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    name="Revenue (₹K)"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                No trend data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {statusDistribution.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2 text-sm">
                  {statusDistribution.map((entry, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-sm" 
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-gray-700">{entry.name}</span>
                      </div>
                      <span className="font-medium">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                No status data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Claims</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentClaims.map((claim) => (
              <Link 
                key={claim.id} 
                to={`/claims/${claim.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors border"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{claim.claim_number}</p>
                    <p className="text-sm text-gray-500">
                      {claim.insured_name || 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    claim.status === 'approved' || claim.status === 'closed'
                      ? 'bg-green-100 text-green-700'
                      : claim.status === 'rejected'
                      ? 'bg-red-100 text-red-700'
                      : claim.status === 'under_review'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {claim.status.replace('_', ' ')}
                  </span>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(claim.created_at), 'MMM dd')}
                  </div>
                </div>
              </Link>
            ))}
            {recentClaims.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No recent claims
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
