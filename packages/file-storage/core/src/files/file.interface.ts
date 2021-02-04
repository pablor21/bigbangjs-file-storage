import { IBucket } from '../buckets';
import { CopyDirectoryOptions, CreateDirectoryOptions, MoveDirectoryOptions, StorageResponse } from '../types';

export interface FileEntryMeta {
    name: string;
    path: string;
    absolutePath: string;
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
}

export interface IFileMeta extends FileEntryMeta {
    size?: number;
    mime?: string;
}

export interface IFile extends IFileEntry {
    meta?: IFileMeta;
    save(): Promise<StorageResponse<IFile>>;
    move(dest: string | IFile, options?: MoveDirectoryOptions): Promise<StorageResponse<IFile>>;
    copy<RType extends IFile | boolean = IFile>(dest: string | IFile, options?: CopyDirectoryOptions): Promise<StorageResponse<RType>>;
}

export interface IDirectoryMeta extends FileEntryMeta {
}

export interface IDirectory extends IFileEntry {
    meta?: IDirectoryMeta;
    save(): Promise<StorageResponse<IDirectory>>;
    empty(): Promise<StorageResponse<boolean>>;
    makeDirectory<RType extends IDirectory | boolean = IDirectory>(dest: string | IDirectory, options?: CreateDirectoryOptions): Promise<StorageResponse<RType>>;
    move(dest: string | IDirectory, options?: MoveDirectoryOptions): Promise<StorageResponse<IDirectory>>;
    copy<RType extends IDirectory | boolean = IDirectory>(dest: string | IDirectory, options?: CopyDirectoryOptions): Promise<StorageResponse<RType>>;
}
