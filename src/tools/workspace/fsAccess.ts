export type FsModule = typeof import('fs/promises');

const IS_NODE =
  typeof process !== 'undefined' &&
  Boolean((process as { versions?: { node?: string } }).versions?.node);

let fsModule: FsModule | null = null;

export const getFs = async (): Promise<FsModule | null> => {
  if (!IS_NODE) return null;
  if (!fsModule) {
    fsModule = await import('fs/promises');
  }
  return fsModule;
};
