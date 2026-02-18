const API_BASE_URL = "https://mlkkk63swrqairyiahlk357sui0argkn.lambda-url.ap-south-1.on.aws";

export interface UploadDocumentResponse {
  success: boolean;
  url: string;
  fileName: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

export const uploadDocument = async (
  file: File,
  claimId: string,
  uploaderName: string,
  companyId: string
): Promise<UploadDocumentResponse> => {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds 5MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("claimId", claimId);
  formData.append("uploaderName", uploaderName);
  formData.append("companyId", companyId);

  console.log("Uploading document:", {
    fileName: file.name,
    fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
    claimId,
    uploaderName,
    companyId
  });

  const response = await fetch(`${API_BASE_URL}/upload-doc`, {
    method: "POST",
    body: formData,
  });

  console.log("Upload response status:", response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Upload failed:", errorText);
    throw new Error(errorText || "Upload failed");
  }

  const result = await response.json();
  console.log("Upload success:", result);
  
  return {
    success: true,
    url: result.url || result.fileUrl,
    fileName: result.fileName || file.name
  };
};

export const validateFileSize = (file: File): { valid: boolean; error?: string } => {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File "${file.name}" exceeds 5MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)`
    };
  }
  return { valid: true };
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};