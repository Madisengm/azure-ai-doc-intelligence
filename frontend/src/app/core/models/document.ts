export type DocumentType = 'cv' | 'invoice' | 'receipt' | 'certificate' | 'id';
export type ProcessingStatus = 'processing' | 'completed' | 'failed';

export interface ExtractedField {
  value: string | null;
  confidence: number;
}

export interface ExtractionResult {
  id: string;
  blobName: string;
  documentType: DocumentType;
  fileName: string;
  processedAt: string;
  status: ProcessingStatus;
  fields: Record<string, ExtractedField>;
  pageCount: number;
  error?: string;
  embedding?: number[];
  similarityScore?: number; 
}

export interface UploadUrlRequest {
  fileName: string;
  fileType: string;
  documentType: DocumentType;
}

export interface UploadUrlResponse {
  sasUrl: string;
  blobName: string;
  documentType: DocumentType;
}

export const DOCUMENT_TYPE_CONFIG: Record<DocumentType, {
  label: string;
  icon: string;
  description: string;
  color: string;
}> = {
  cv: {
    label: 'CV / Resume',
    icon: '📄',
    description: 'Extract personal details, skills, experience',
    color: 'border-blue-400 bg-blue-50',
  },
  invoice: {
    label: 'Invoice',
    icon: '🧾',
    description: 'Extract vendor, amounts, line items',
    color: 'border-green-400 bg-green-50',
  },
  receipt: {
    label: 'Receipt',
    icon: '🛒',
    description: 'Extract merchant, total, items purchased',
    color: 'border-yellow-400 bg-yellow-50',
  },
  certificate: {
    label: 'Certificate',
    icon: '🎓',
    description: 'Extract title, issuer, date, holder name',
    color: 'border-purple-400 bg-purple-50',
  },
  id: {
    label: 'ID Document',
    icon: '🪪',
    description: 'Extract name, date of birth, ID number',
    color: 'border-red-400 bg-red-50',
  },
};