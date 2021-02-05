import { IBucket } from '../buckets';
import { CopyDirectoryOptions, CopyFileOptions, CreateDirectoryOptions, CreateFileOptions, GetFileOptions, MoveDirectoryOptions, MoveFileOptions, StorageResponse, Streams } from '../types';

export interface FileEntryMeta {
    name: string;
    path: string;
    nativeAbsolutePath: string;
    uri: string;
    createdAt?: Date;
    updatedAt?: Date;
    nativeMeta: any;
    type: 'DIRECTORY' | 'FILE';
    exists: boolean;
}

export interface IFileEntry {
    bucket: IBucket;
    name: string;
    path: string;
    meta?: FileEntryMeta;
    getType(): 'DIRECTORY' | 'FILE';
    getAbsolutePath(): string;
    delete(): Promise<StorageResponse<boolean>>;
    getStorageUri(): string;
    getPublicUrl(options?: any): Promise<string>;
    getSignedUrl(options?: any): Promise<string>;
    save(options?: CreateFileOptions | CreateDirectoryOptions): Promise<StorageResponse<IFileEntry>>;
    copy(dest: string | IFile, options?: CopyDirectoryOptions | CopyFileOptions): Promise<StorageResponse<IFileEntry>>;
    move(dest: string | IFile, options?: MoveDirectoryOptions | MoveFileOptions): Promise<StorageResponse<IFileEntry>>;
}

export interface IFileMeta extends FileEntryMeta {
    size?: number;
    mime?: string;
}

export interface IFile extends IFileEntry {
    meta?: IFileMeta;
    save(options?: CreateFileOptions): Promise<StorageResponse<IFile>>;
    move(dest: string | IFile, options?: MoveFileOptions): Promise<StorageResponse<IFile>>;
    copy(dest: string | IFile, options?: CopyFileOptions): Promise<StorageResponse<IFile>>;
    setContents(contents: string | Buffer | Streams.Readable): void;
    getContents(options?: GetFileOptions): Promise<Buffer>;
    getStream(options?: GetFileOptions): Promise<Streams.Readable>;
}

export interface IDirectoryMeta extends FileEntryMeta {
}

export interface IDirectory extends IFileEntry {
    meta?: IDirectoryMeta;
    save(options?: CreateDirectoryOptions): Promise<StorageResponse<IDirectory>>;
    move(dest: string | IDirectory, options?: MoveDirectoryOptions): Promise<StorageResponse<IDirectory>>;
    copy(dest: string | IDirectory, options?: CopyDirectoryOptions): Promise<StorageResponse<IDirectory>>;
}
