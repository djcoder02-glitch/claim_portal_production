import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Mail, MapPin, Edit, Plus } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Building2, 
  Loader2,
  Eye,
  Search,
  FileText
} from "lucide-react";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";

interface Claim {
  id: string;
  claim_number: string;
  title: string;
  status: string;
  created_at: string;
  form_data: any;
  policy_type_id: string | null;
  policy_types?: { name: string } | null;
}

interface Customer {
  name: string;
  claimsCount: number;
  latestClaim: string;
  statuses: { [key: string]: number };
}

interface CustomerContact {
  id: string;
  customer_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}


export const Customers = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [viewClaimsDialog, setViewClaimsDialog] = useState<{
    open: boolean;
    customerName: string | null;
  }>({ open: false, customerName: null });

  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string | null>(null);
  const [contactFormData, setContactFormData] = useState({
    phone: "",
    email: "",
    address: "",
    notes: "",
  });
  const queryClient = useQueryClient();

  // Fetch all claims
  const { data: claims = [], isLoading } = useQuery({
    queryKey: ['all-claims-for-customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claims')
        .select(`
          id, 
          claim_number, 
          title, 
          status, 
          created_at, 
          form_data,
          policy_type_id,
          policy_types:policy_type_id(name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Claim[];
    },
  });

  // Fetch customer contacts
  const { data: customerContacts = [] } = useQuery({
    queryKey: ['customer-contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_contacts')
        .select('*');
      
      if (error) throw error;
      return data as CustomerContact[];
    },
  });

  // Get contact for specific customer
  const getCustomerContact = (customerName: string) => {
    return customerContacts.find(c => c.customer_name === customerName);
  };
  

  // Extract unique customers from claims
  const customers: Customer[] = useMemo(() => {
    const customerMap = new Map<string, Customer>();

    claims.forEach(claim => {
      const insuredName = claim.form_data?.insured_name;
      if (!insuredName || typeof insuredName !== 'string') return;

      const normalizedName = insuredName.trim();
      if (!normalizedName) return;

      if (!customerMap.has(normalizedName)) {
        customerMap.set(normalizedName, {
          name: normalizedName,
          claimsCount: 0,
          latestClaim: claim.created_at,
          statuses: {}
        });
      }

      const customer = customerMap.get(normalizedName)!;
      customer.claimsCount += 1;
      
      // Track latest claim
      if (new Date(claim.created_at) > new Date(customer.latestClaim)) {
        customer.latestClaim = claim.created_at;
      }

      // Count statuses
      customer.statuses[claim.status] = (customer.statuses[claim.status] || 0) + 1;
    });

    return Array.from(customerMap.values()).sort((a, b) => 
      new Date(b.latestClaim).getTime() - new Date(a.latestClaim).getTime()
    );
  }, [claims]);

  

  // Filter customers based on search
  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  // Get claims for specific customer
  const customerClaims = useMemo(() => {
    if (!viewClaimsDialog.customerName) return [];
    
    return claims.filter(claim => 
      claim.form_data?.insured_name?.trim() === viewClaimsDialog.customerName
    );
  }, [claims, viewClaimsDialog.customerName]);

  const handleViewClaims = (customerName: string) => {
    setViewClaimsDialog({ open: true, customerName });
  };

  // Get status badge color
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'approved':
      case 'paid':
        return 'default';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  // Save or update customer contact
  const saveContactMutation = useMutation({
    mutationFn: async ({ customerName, data }: { customerName: string; data: typeof contactFormData }) => {
      const existingContact = getCustomerContact(customerName);
      
      if (existingContact) {
        // Update existing
        const { error } = await supabase
          .from('customer_contacts')
          .update({
            phone: data.phone || null,
            email: data.email || null,
            address: data.address || null,
            notes: data.notes || null,
          })
          .eq('customer_name', customerName);
        
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('customer_contacts')
          .insert([{
            customer_name: customerName,
            phone: data.phone || null,
            email: data.email || null,
            address: data.address || null,
            notes: data.notes || null,
          }]);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-contacts'] });
      toast.success("Contact details saved successfully");
      setContactDialogOpen(false);
      resetContactForm();
    },
    onError: (error) => {
      toast.error("Failed to save contact: " + error.message);
    },
  });
  const resetContactForm = () => {
    setContactFormData({
      phone: "",
      email: "",
      address: "",
      notes: "",
    });
    setSelectedCustomerName(null);
  };

  const handleEditContact = (customerName: string) => {
    setSelectedCustomerName(customerName);
    const contact = getCustomerContact(customerName);
    
    if (contact) {
      setContactFormData({
        phone: contact.phone || "",
        email: contact.email || "",
        address: contact.address || "",
        notes: contact.notes || "",
      });
    } else {
      setContactFormData({
        phone: "",
        email: "",
        address: "",
        notes: "",
      });
    }
    
    setContactDialogOpen(true);
  };

  const handleSaveContact = async () => {
    if (!selectedCustomerName) {
      toast.error("Customer name is required");
      return;
    }
    
    try {
      await saveContactMutation.mutateAsync({
        customerName: selectedCustomerName,
        data: contactFormData,
      });
    } catch (error) {
      // Error already handled in mutation's onError
      console.error("Save contact error:", error);
    }
  };


  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-600 mt-1">Manage customer information and view their claims</p>
        </div>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search customers by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Customers ({filteredCustomers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {searchTerm ? "No customers found" : "No customers yet"}
              </h3>
              <p className="text-gray-600">
                {searchTerm 
                  ? "Try adjusting your search" 
                  : "Customers will appear here once claims with insured names are created."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Total Claims</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Approved</TableHead>
                  <TableHead>Latest Activity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.name}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium">{customer.name}</div>
                          {(() => {
                            const contact = getCustomerContact(customer.name);
                            return contact && (contact.phone || contact.email) ? (
                              <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                                {contact.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {contact.phone}
                                  </span>
                                )}
                                {contact.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {contact.email}
                                  </span>
                                )}
                              </div>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-semibold">
                        {customer.claimsCount}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-yellow-600 font-medium">
                        {(customer.statuses.pending || 0) + 
                         (customer.statuses.submitted || 0) + 
                         (customer.statuses.under_review || 0)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-green-600 font-medium">
                        {(customer.statuses.approved || 0) + 
                         (customer.statuses.paid || 0)}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {new Date(customer.latestClaim).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditContact(customer.name)}
                          className="gap-2"
                        >
                          {getCustomerContact(customer.name) ? (
                            <>
                              <Edit className="w-4 h-4" />
                              Edit Contact
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4" />
                              Add Contact
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewClaims(customer.name)}
                          className="gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          View Claims
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

      {/* View Claims Dialog */}
      <Dialog 
        open={viewClaimsDialog.open} 
        onOpenChange={(open) => setViewClaimsDialog({ open, customerName: null })}
      >
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Claims for {viewClaimsDialog.customerName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto py-4">
            {customerClaims.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No claims found for this customer</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Claim Number</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Policy Type</TableHead>
                    <TableHead>Assigned Surveyor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerClaims.map((claim) => (
                    <TableRow 
                      key={claim.id} 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => {
                        setViewClaimsDialog({ open: false, customerName: null });
                        navigate(`/claims/${claim.id}`);
                      }}
                    >
                      <TableCell className="font-medium">
                        {claim.claim_number}
                      </TableCell>
                      <TableCell>{claim.title}</TableCell>
                      <TableCell>{claim.policy_types?.name || '—'}</TableCell>
                      <TableCell>
                        {claim.form_data?.assigned_surveyor || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(claim.status)}>
                          {claim.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(claim.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Contact Details Dialog */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Contact Details - {selectedCustomerName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="contact-phone" className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Phone Number
              </Label>
              <Input
                id="contact-phone"
                type="tel"
                placeholder="+91 98765 43210"
                value={contactFormData.phone}
                onChange={(e) => setContactFormData({ ...contactFormData, phone: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contact-email" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </Label>
              <Input
                id="contact-email"
                type="email"
                placeholder="contact@example.com"
                value={contactFormData.email}
                onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contact-address" className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Address
              </Label>
              <Textarea
                id="contact-address"
                placeholder="Full address"
                value={contactFormData.address}
                onChange={(e) => setContactFormData({ ...contactFormData, address: e.target.value })}
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contact-notes">Notes</Label>
              <Textarea
                id="contact-notes"
                placeholder="Additional notes or comments"
                value={contactFormData.notes}
                onChange={(e) => setContactFormData({ ...contactFormData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setContactDialogOpen(false);
                resetContactForm();
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveContact}
              disabled={saveContactMutation.isPending}
            >
              {saveContactMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Contact
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default Customers;