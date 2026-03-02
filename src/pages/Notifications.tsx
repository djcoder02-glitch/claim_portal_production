import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Bell, Search, CheckCheck, Clock, AlertCircle, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Using 'any' typed client because notifications table was added after type generation
const db = supabase as any;

interface Notification {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  type: 'claim' | 'survey' | 'system' | 'approval';
  claim_id?: string | null;
  company_id: string;
  claims?: { claim_number: string } | null;
}

export const Notifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'read'>('all');

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await db
        .from('notifications')
        .select('*, claims(claim_number)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from('notifications')
        .update({ read: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    onError: () => toast.error('Failed to mark as read'),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await db
        .from('notifications')
        .update({ read: true })
        .eq('read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All notifications marked as read');
    },
    onError: () => toast.error('Failed to mark all as read'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from('notifications')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Notification deleted');
    },
    onError: () => toast.error('Failed to delete notification'),
  });

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n: Notification) => {
      const claimNum = n.claims?.claim_number ?? '';
      const matchesSearch =
        n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        claimNum.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter =
        filterType === 'all' ? true :
        filterType === 'unread' ? !n.read : n.read;
      return matchesSearch && matchesFilter;
    });
  }, [notifications, searchTerm, filterType]);

  const unreadCount = notifications.filter((n: Notification) => !n.read).length;

  const getTimeAgo = (created_at: string) => {
    const date = new Date(created_at);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'claim': return <AlertCircle className="w-5 h-5 text-blue-600" />;
      case 'survey': return <CheckCheck className="w-5 h-5 text-green-600" />;
      case 'approval': return <CheckCheck className="w-5 h-5 text-purple-600" />;
      default: return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Bell className="w-8 h-8" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">{unreadCount} new</Badge>
            )}
          </h1>
          <p className="text-gray-600 mt-1">Stay updated on claim activities and system alerts</p>
        </div>
        {unreadCount > 0 && (
          <Button
            onClick={() => markAllReadMutation.mutate()}
            variant="outline"
            disabled={markAllReadMutation.isPending}
          >
            {markAllReadMutation.isPending
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <CheckCheck className="w-4 h-4 mr-2" />}
            Mark all as read
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search notifications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button variant={filterType === 'all' ? 'default' : 'outline'} onClick={() => setFilterType('all')} size="sm">All</Button>
              <Button variant={filterType === 'unread' ? 'default' : 'outline'} onClick={() => setFilterType('unread')} size="sm">Unread ({unreadCount})</Button>
              <Button variant={filterType === 'read' ? 'default' : 'outline'} onClick={() => setFilterType('read')} size="sm">Read</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Notifications ({filteredNotifications.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {searchTerm ? "No notifications found" : "No notifications yet"}
              </h3>
              <p className="text-gray-600">
                {searchTerm ? "Try adjusting your search" : "You're all caught up! Notifications will appear here."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredNotifications.map((n: Notification) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-4 p-4 rounded-lg border transition-colors hover:shadow-sm ${
                    n.read ? 'bg-white border-gray-200' : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex-shrink-0 mt-1">{getNotificationIcon(n.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{n.title}</p>
                        <p className="text-sm text-gray-600 mt-1">{n.message}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500">{getTimeAgo(n.created_at)}</span>
                          {n.claims?.claim_number && (
                            <Badge variant="outline" className="text-xs">{n.claims.claim_number}</Badge>
                          )}
                          {!n.read && (
                            <Badge className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-100 border-0">Unread</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!n.read && (
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => markReadMutation.mutate(n.id)}
                            disabled={markReadMutation.isPending}
                            title="Mark as read"
                          >
                            <CheckCheck className="w-4 h-4 text-blue-600" />
                          </Button>
                        )}
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => deleteMutation.mutate(n.id)}
                          disabled={deleteMutation.isPending}
                          className="text-red-400 hover:text-red-600 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Notifications;