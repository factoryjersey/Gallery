// Stub: object-level ACLs were tied to the Replit/GCS implementation.
// Removed post-migration to R2.

const NOT_CONFIGURED = "Object ACLs are no longer configured.";

export type ObjectAclPolicy = unknown;
export type ObjectPermission = unknown;

export async function canAccessObject(): Promise<never> {
  throw new Error(NOT_CONFIGURED);
}
export async function getObjectAclPolicy(): Promise<never> {
  throw new Error(NOT_CONFIGURED);
}
export async function setObjectAclPolicy(): Promise<never> {
  throw new Error(NOT_CONFIGURED);
}
