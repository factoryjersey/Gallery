// Stub: the original Replit Object Storage implementation has been removed
// post-migration to Cloudflare R2. These exports remain so unmoved admin
// routes still type-check; calling any of them returns a clear runtime error.

const NOT_CONFIGURED = "Replit Object Storage is no longer configured. Use the R2-based endpoints instead.";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  async getObjectEntityFile(_path: string): Promise<never> {
    throw new Error(NOT_CONFIGURED);
  }
  downloadObject(_file: unknown, _res: unknown): never {
    throw new Error(NOT_CONFIGURED);
  }
  async getObjectEntityUploadURL(): Promise<never> {
    throw new Error(NOT_CONFIGURED);
  }
  normalizeObjectEntityPath(_p: string): never {
    throw new Error(NOT_CONFIGURED);
  }
}

export const objectStorageClient = {
  bucket(_id: string): never {
    throw new Error(NOT_CONFIGURED);
  },
};
