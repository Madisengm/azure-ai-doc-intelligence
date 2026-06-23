import { pipeline } from '@xenova/transformers';

type EmbedderPipeline = Awaited<ReturnType<typeof pipeline>>;

let embedder: EmbedderPipeline | null = null;

async function getEmbedder(): Promise<EmbedderPipeline> {
  if (!embedder) {
    console.log('Loading embedding model (first cold start only)...');

    embedder = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      { cache_dir: '/tmp/models' }
    );
    console.log('Embedding model loaded');
  }
  return embedder;
}


export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text.trim()) {
    return new Array(384).fill(0);
  }

  const model  = await getEmbedder();
  const output = await (model as any)(text, {
    pooling:   'mean',
    normalize: true,
  });

  return Array.from(output.data as Float32Array);
}