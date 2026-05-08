// Stub: the GCS-based image processor has been removed post-migration to R2.
// New uploads go through imageProcessorR2.ts.

const NOT_CONFIGURED = "GCS image processor is no longer configured. Uploads use R2 — see imageProcessorR2.ts.";

export async function processImage(): Promise<never> {
  throw new Error(NOT_CONFIGURED);
}

export function getPublicUrl(): never {
  throw new Error(NOT_CONFIGURED);
}
