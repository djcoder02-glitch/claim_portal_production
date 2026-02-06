import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Edit, Trash2, Mail, Phone, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Agent {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const Agents = () => {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });

  // Fetch agents
  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agents')
        .select('id, company_id, name, email, phone, address, is_active, created_at, updated_at')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as Agent[];
    },
  });

  // Create agent mutation
  const createAgent = useMutation({
    mutationFn: async (newAgent: Omit<Agent, 'id' | 'created_at' | 'updated_at' | 'company_id' | 'is_active'>) => {
      // Get current user's company_id
      const { data: userData } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', userData?.user?.id)
        .single();

      const { data, error } = await supabase
        .from('agents')
        .insert([{
          ...newAgent,
          company_id: profile?.company_id,
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success("Agent created successfully");
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Failed to create agent: " + error.message);
    },
  });

  // Update agent mutation
  const updateAgent = useMutation({
    mutationFn: async (updatedAgent: Partial<Agent> & { id: string }) => {
      const { id, ...updateData } = updatedAgent;
      const { data, error } = await supabase
        .from('agents')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success("Agent updated successfully");
      setIsEditDialogOpen(false);
      setSelectedAgent(null);
      resetForm();
    },
    onError: (error) => {
      toast.error("Failed to update agent: " + error.message);
    },
  });

  // Delete agent mutation (soft delete)
  const deleteAgent = useMutation({
    mutationFn: async (agentId: string) => {
      const { error } = await supabase
        .from('agents')
        .update({ is_active: false })
        .eq('id', agentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success("Agent deleted successfully");
      setIsDeleteDialogOpen(false);
      setSelectedAgent(null);
    },
    onError: (error) => {
      toast.error("Failed to delete agent: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      address: "",
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Agent name is required");
      return;
    }
    createAgent.mutate({
      name: formData.name,
      email: formData.email || null,
      phone: formData.phone || null,
      address: formData.address || null,
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent) return;
    if (!formData.name.trim()) {
      toast.error("Agent name is required");
      return;
    }
    updateAgent.mutate({
      id: selectedAgent.id,
      name: formData.name,
      email: formData.email || null,
      phone: formData.phone || null,
      address: formData.address || null,
    });
  };

  const handleEdit = (agent: Agent) => {
    setSelectedAgent(agent);
    setFormData({
      name: agent.name,
      email: agent.email || "",
      phone: agent.phone || "",
      address: agent.address || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (agent: Agent) => {
    setSelectedAgent(agent);
    setIsDeleteDialogOpen(true);
  };

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.phone?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Agents</h1>
          <p className="text-gray-600 mt-1">Manage insurance agents</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Agent
        </Button>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <Input
            placeholder="Search agents by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Agents Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Agents ({filteredAgents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {searchTerm ? "No agents found" : "No agents yet. Add one to get started!"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact Info</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">{agent.name}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {agent.email && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="w-3 h-3" />
                            {agent.email}
                          </div>
                        )}
                        {agent.phone && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="w-3 h-3" />
                            {agent.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {agent.address ? (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin className="w-3 h-3" />
                          {agent.address}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={agent.is_active ? "default" : "secondary"}>
                        {agent.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(agent)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(agent)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Agent</DialogTitle>
            <DialogDescription>
              Enter the details of the new agent
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter agent name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="agent@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Enter full address"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createAgent.isPending}>
                {createAgent.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Agent
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Agent</DialogTitle>
            <DialogDescription>
              Update the agent details
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter agent name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="agent@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-address">Address</Label>
                <Textarea
                  id="edit-address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Enter full address"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setSelectedAgent(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateAgent.isPending}>
                {updateAgent.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Update Agent
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Agent</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedAgent?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setSelectedAgent(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedAgent && deleteAgent.mutate(selectedAgent.id)}
              disabled={deleteAgent.isPending}
            >
              {deleteAgent.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Agents;

