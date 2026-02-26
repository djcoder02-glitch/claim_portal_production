import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, Building2 } from "lucide-react";

export const CompanyDetailsManager = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [form, setForm] = useState({
    bank_name: "",
    account_number: "",
    ifsc_code: "",
    company_address: "",
    signature_name: "",
  });

useEffect(() => {
    const fetchCompany = async () => {
      if (!user) { setLoading(false); return; }

      console.log("Auth user object:", user); // debug - check what's available

      // Fetch company_id from the users table directly
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("company_id")
        .eq("id", user.id)
        .single();

      console.log("userData:", userData, "userError:", userError); // debug

      if (!userData?.company_id) {
        toast.error("Could not find your company. Contact support.");
        setLoading(false);
        return;
      }

      setCompanyId(userData.company_id);

      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("bank_name, account_number, ifsc_code, company_address, signature_name")
        .eq("id", userData.company_id)
        .single();

      console.log("company:", company, "companyError:", companyError); // debug

      if (company) {
        setForm({
          bank_name: company.bank_name || "",
          account_number: company.account_number || "",
          ifsc_code: company.ifsc_code || "",
          company_address: company.company_address || "",
          signature_name: company.signature_name || "",
        });
      }
      setLoading(false);
    };
    fetchCompany();
  }, [user]);

const handleSave = async () => {
    if (!companyId) {
      toast.error("No company ID found, cannot save.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("companies")
      .update(form)
      .eq("id", companyId);

    console.log("Save error:", error); // debug

    if (error) {
      toast.error(`Failed to save: ${error.message}`);
    } else {
      toast.success("Company details saved successfully!");
    }
    setSaving(false);
  };

  if (loading) return <div className="p-4 text-muted-foreground">Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Company & Bank Details
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          These details will be used in Fee Bills and reports.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Bank Name</Label>
            <Input
              value={form.bank_name}
              onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))}
              placeholder="e.g. ICICI BANK LTD., Jaipur 002344"
            />
          </div>
          <div className="space-y-2">
            <Label>Account Number</Label>
            <Input
              value={form.account_number}
              onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))}
              placeholder="e.g. 001123456789"
            />
          </div>
          <div className="space-y-2">
            <Label>IFSC Code</Label>
            <Input
              value={form.ifsc_code}
              onChange={e => setForm(f => ({ ...f, ifsc_code: e.target.value }))}
              placeholder="e.g. ICIC0000345"
            />
          </div>
          <div className="space-y-2">
            <Label>Signature Name</Label>
            <Input
              value={form.signature_name}
              onChange={e => setForm(f => ({ ...f, signature_name: e.target.value }))}
              placeholder="e.g. John Doe"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Company Name and Address (as shown on fee bill)</Label>
            <Textarea
              value={form.company_address}
              onChange={e => setForm(f => ({ ...f, company_address: e.target.value }))}
              placeholder="e.g. INDIA INSURANCE CO. LTD., D.O. Tatibandh, Jaipur"
              rows={3}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save Details"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};