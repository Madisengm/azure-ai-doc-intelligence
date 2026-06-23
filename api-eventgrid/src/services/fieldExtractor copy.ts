import { ExtractionResult } from './cosmosService';

const FIELD_PRIORITY: Record<string, string[]> = {
  cv:          ['Name', 'Skills', 'Summary', 'Experience', 'Education', 'JobTitle'],
  invoice:     ['VendorName', 'CustomerName', 'InvoiceTotal', 'Items', 'Description'],
  receipt:     ['MerchantName', 'Items', 'Total', 'TransactionDate'],
  certificate: ['Title', 'IssuedTo', 'IssuedBy', 'CourseTitle', 'RecipientName'],
  id:          ['FirstName', 'LastName', 'Nationality', 'DocumentType', 'DateOfBirth'],
};

export function extractEmbeddingText(result: ExtractionResult): string {
  const priority = FIELD_PRIORITY[result.documentType] ?? [];
  const parts: string[] = [];

  parts.push(result.documentType);

  for (const key of priority) {
    const field = result.fields[key];
    if (field?.value) {
      parts.push(`${key}: ${field.value}`);
    }
  }

  if (parts.length < 4) {
    for (const [key, field] of Object.entries(result.fields)) {
      if (!priority.includes(key) && field?.value) {
        parts.push(`${key}: ${field.value}`);
      }
    }
  }

  return parts.join('. ').trim();
}