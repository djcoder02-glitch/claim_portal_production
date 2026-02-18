import { supabase } from "@/integrations/supabase/client";

export interface UploadTokenData {
  token: string;
  claimId: string;
  companyId: string;
  fieldLabel: string;
  expiresAt: Date;
  uploadUrl: string;
}

export const generateUploadToken = async (
  claimId: string,
  fieldLabel: string,
  expiryDays: number = 7
): Promise<UploadTokenData> => {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  // Get user's company_id
  const { data: userProfile } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', user.id)
    .single();

  if (!userProfile?.company_id) {
    throw new Error('User has no company_id');
  }

  const { error } = await supabase
    .from("claim_documents")
    .insert({
      claim_id: claimId,
      company_id: userProfile.company_id,
      file_name: `__TOKEN_PLACEHOLDER_${token}__`,
      file_path: `__TOKEN_PLACEHOLDER_${token}__`,
      file_type: "application/token-placeholder",
      file_size: 0,
      uploaded_by: user.id,
      field_label: fieldLabel,
      upload_token: token,
      token_expires_at: expiresAt.toISOString(),
      uploaded_via_link: false,
      is_selected: false,
    });

  if (error) throw error;

  const uploadUrl = `${window.location.origin}/public-upload?token=${token}`;

  return {
    token,
    claimId,
    companyId: userProfile.company_id,
    fieldLabel,
    expiresAt,
    uploadUrl,
  };
};

export const validateUploadToken = async (token: string) => {
  if (!token) return null;

  const { data, error } = await supabase
    .from("claim_documents")
    .select("claim_id, company_id, field_label, token_expires_at")
    .eq("upload_token", token)
    .like("file_name", "__TOKEN_PLACEHOLDER_%")
    .single();

  if (error || !data) {
    console.error("Token validation error:", error);
    return null;
  }

  const expiresAt = new Date(data.token_expires_at!);
  if (expiresAt < new Date()) {
    console.log("Token expired");
    return null;
  }

  return {
    claimId: data.claim_id,
    companyId: data.company_id,
    fieldLabel: data.field_label,
  };
};

export const generateBatchUploadToken = async (
  claimId: string,
  expiryHours: number = 168
): Promise<UploadTokenData> => {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  // Get user's company_id
  const { data: userProfile } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', user.id)
    .single();

  if (!userProfile?.company_id) {
    throw new Error('User has no company_id');
  }

  const { error } = await supabase
    .from("claim_documents")
    .insert({
      claim_id: claimId,
      company_id: userProfile.company_id,
      file_name: `__BATCH_TOKEN_${token}__`,
      file_path: `__BATCH_TOKEN_${token}__`,
      file_type: "application/batch-token",
      file_size: 0,
      uploaded_by: user.id,
      field_label: "Batch Upload",
      upload_token: token,
      token_expires_at: expiresAt.toISOString(),
      uploaded_via_link: false,
      is_selected: false,
    });

  if (error) throw error;

  const uploadUrl = `${window.location.origin}/public-upload?token=${token}`;

  return {
    token,
    claimId,
    companyId: userProfile.company_id,
    fieldLabel: "Batch Upload",
    expiresAt,
    uploadUrl,
  };
};

export const validateBatchUploadToken = async (token: string) => {
  if (!token) return null;

  const { data, error } = await supabase
    .from("claim_documents")
    .select("claim_id, company_id, field_label, token_expires_at")
    .eq("upload_token", token)
    .or(`file_name.like.__TOKEN_PLACEHOLDER_%,file_name.like.__BATCH_TOKEN_%`)
    .single();

  if (error || !data) {
    console.error("Token validation error:", error);
    return null;
  }

  const expiresAt = new Date(data.token_expires_at!);
  if (expiresAt < new Date()) {
    console.log("Token expired");
    return null;
  }

  return {
    claimId: data.claim_id,
    companyId: data.company_id,
    fieldLabel: data.field_label,
  };
};

export const saveUploadedDocument = async (
  claimId: string,
  companyId: string,
  fileName: string,
  fileUrl: string,
  fileSize: number,
  uploaderName: string,
  token: string
) => {
  const { data: tokenData, error: tokenError } = await supabase
    .from("claim_documents")
    .select("uploaded_by")
    .eq("upload_token", token)
    .or("file_name.like.__BATCH_TOKEN_%,file_name.like.__TOKEN_PLACEHOLDER_%")
    .maybeSingle();

  if (tokenError) {
    console.warn("Could not fetch token data:", tokenError);
  }

  const { error } = await supabase
    .from("claim_documents")
    .insert({
      claim_id: claimId,
      company_id: companyId,
      file_name: fileName,
      file_path: fileUrl,
      file_type: fileName.split('.').pop() || 'unknown',
      file_size: fileSize,
      uploaded_by: tokenData?.uploaded_by || null,
      upload_token: null,
      uploaded_via_link: true,
      is_selected: false,
      field_label: `Uploaded by: ${uploaderName}`,
      metadata: {
        uploader_name: uploaderName,
        upload_date: new Date().toISOString(),
        upload_source: 'public_link',
        upload_token_used: token
      }
    } as any);

  if (error) {
    console.error("Error saving document:", error);
    throw error;
  }
};

export const getDocumentPublicUrl = async (filePath: string): Promise<string> => {
  const { data, error } = await supabase.storage
    .from("claim-documents")
    .createSignedUrl(filePath, 3600);
  
  if (error) throw error;
  return data.signedUrl;
};