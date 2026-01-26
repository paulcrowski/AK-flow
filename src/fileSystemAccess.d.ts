export {};

declare global {
  type FileSystemPermissionMode = 'read' | 'readwrite';

  interface FileSystemPermissionDescriptor {
    mode?: FileSystemPermissionMode;
  }

  interface FileSystemHandle {
    kind: 'file' | 'directory';
    name: string;
    queryPermission?(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;
    requestPermission?(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;
  }

  interface FileSystemFileHandle extends FileSystemHandle {
    kind: 'file';
    getFile(): Promise<File>;
    createWritable?(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>;
  }

  interface FileSystemDirectoryHandle extends FileSystemHandle {
    kind: 'directory';
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  }

  interface FileSystemWritableFileStream extends WritableStream {
    write(data: BufferSource | Blob | string): Promise<void>;
    close(): Promise<void>;
  }
}
