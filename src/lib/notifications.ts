// src/lib/notifications.ts
// Why: single reusable function to insert a notification for the current user's company.
// All three files (NewClaimDialog, FeeBillForm, ReportPreview) import from here.

import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export async function createNotification({
  title,
  message,
  type,
  claimId,
}: {
  title: string;
  message: string;
  type: 'claim' | 'survey' | 'system' | 'approval';
  claimId?: string;
}) {
  try {
    // Get logged-in user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get company_id from public.users
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) return;

    await db.from('notifications').insert({
      company_id: userData.company_id,
      claim_id: claimId || null,
      title,
      message,
      type,
      read: false,
    });
  } catch (err) {
    // Notifications are non-critical — fail silently
    console.error('Failed to create notification:', err);
  }
}