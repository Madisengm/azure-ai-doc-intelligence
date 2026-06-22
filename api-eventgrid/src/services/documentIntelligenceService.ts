import { DocumentAnalysisClient, AzureKeyCredential } from "@azure/ai-form-recognizer";

export interface ExtractedField {
    value: string | null;
    confidence: number;
}

export interface ExtractionOutput {
    fields: Record<string, ExtractedField>;
    pageCount: number;
}

const MODEL_MAP: Record<string, string> = {
    cv:          "prebuilt-document",
    invoice:     "prebuilt-invoice",
    receipt:     "prebuilt-receipt",
    certificate: "prebuilt-document",
    id:          "prebuilt-idDocument",
};

export class DocumentIntelligenceService {
    private client: DocumentAnalysisClient;

    constructor() {
        const endpoint = process.env["DOCUMENT_INTELLIGENCE_ENDPOINT"];
        const key      = process.env["DOCUMENT_INTELLIGENCE_KEY"];

        if (!endpoint || !key) {
            throw new Error(
                "Missing Document Intelligence env vars: " +
                "DOCUMENT_INTELLIGENCE_ENDPOINT, DOCUMENT_INTELLIGENCE_KEY"
            );
        }

        this.client = new DocumentAnalysisClient(
            endpoint,
            new AzureKeyCredential(key)
        );
    }

  async analyseDocument(
      documentBuffer: Buffer,
      documentType: string,
  ): Promise<ExtractionOutput> {
      const modelId = MODEL_MAP[documentType] ?? "prebuilt-document";

      const poller = await this.client.beginAnalyzeDocument(
          modelId,
          documentBuffer
      );

      const result = await poller.pollUntilDone();

      if (!result || !result.documents?.[0]) {
          return this.extractFromKeyValuePairs(result);
      }

      const doc    = result.documents[0];
      const fields: Record<string, ExtractedField> = {};

      for (const [key, field] of Object.entries(doc.fields ?? {})) {
          fields[key] = {
              value:      field.content ?? null,
              confidence: field.confidence ?? 0,
          };
      }

      return {
          fields,
          pageCount: result.pages?.length ?? 1,
      };
  }

    private extractFromKeyValuePairs(result: any): ExtractionOutput {
        const fields: Record<string, ExtractedField> = {};

        for (const pair of result.keyValuePairs ?? []) {
            if (pair.key?.content) {
                fields[pair.key.content] = {
                    value:      pair.value?.content ?? null,
                    confidence: pair.confidence ?? 0,
                };
            }
        }

        return {
            fields,
            pageCount: result.pages?.length ?? 1,
        };
    }
}