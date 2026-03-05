import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CompanyWithStats } from "@/hooks/useCompanies";

interface Props {
  open: boolean;
  onClose: () => void;
  company: CompanyWithStats | null;
}

interface RootPolicyType {
  id: string;
  name: string;
  description: string | null;
}

export const CompanyPolicyAccessEditor = ({ open, onClose, company }: Props) => {
  const [rootTypes, setRootTypes] = useState<RootPolicyType[]>([]);
  const [allowed, setAllowed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasRestrictions, setHasRestrictions] = useState(false);

  useEffect(() => {
    if (!open || !company) return;
    fetchData();
  }, [open, company]);

  const fetchData = async () => {
    setLoading(true);
    const { data: types } = await supabase
      .from("policy_types")
      .select("id, name, description")
      .is("parent_id", null)
      .order("name");

    const { data: access } = await supabase
      .from("company_policy_access")
      .select("policy_type_id")
      .eq("company_id", company!.id);

    setRootTypes(types || []);

    if (access && access.length > 0) {
      setHasRestrictions(true);
      setAllowed(new Set(access.map(a => a.policy_type_id)));
    } else {
      setHasRestrictions(false);
      setAllowed(new Set((types || []).map(t => t.id)));
    }
    setLoading(false);
  };

  const handleToggle = (id: string, checked: boolean) => {
    setAllowed(prev => {
        const next = new Set(prev);
        if (checked) {
        next.add(id);
        } else {
        next.delete(id);
        }
        return next;
    });
    if (!hasRestrictions) setHasRestrictions(true);
    };

  const handleSave = async () => {
    if (!company) return;
    setSaving(true);
    try {
      await supabase
        .from("company_policy_access")
        .delete()
        .eq("company_id", company.id);

      if (allowed.size > 0) {
        const rows = Array.from(allowed).map(policy_type_id => ({
          company_id: company.id,
          policy_type_id,
        }));
        const { error } = await supabase.from("company_policy_access").insert(rows);
        if (error) throw error;
      }

      toast.success("Policy access updated successfully");
      onClose();
    } catch (e: any) {
      toast.error("Failed to save: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetToUnrestricted = async () => {
    if (!company) return;
    await supabase.from("company_policy_access").delete().eq("company_id", company.id);
    setHasRestrictions(false);
    setAllowed(new Set(rootTypes.map(t => t.id)));
    toast.success("Reset to unrestricted");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            Policy Access — {company?.name}
          </DialogTitle>
          <DialogDescription>
            Toggle off to restrict this company from accessing that policy type.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-3 py-2">
            {!hasRestrictions && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-800">
                Currently unrestricted — all policy types accessible.
              </div>
            )}
            {rootTypes.map(type => (
              <div key={type.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="text-sm font-medium">{type.name}</Label>
                  {type.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{type.description}</p>
                  )}
                </div>
                <Switch
                  checked={allowed.has(type.id)}
                  onCheckedChange={(checked) => handleToggle(type.id, checked)}
                />
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2 flex-row">
          <Button variant="ghost" size="sm" onClick={handleResetToUnrestricted} disabled={saving || loading}>
            Reset to Unrestricted
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : "Save Access"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};