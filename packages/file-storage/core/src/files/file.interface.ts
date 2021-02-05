import { IBucket } from '../buckets';
import { CopyFileOptions, CreateFileOptions, MoveFileOptions, StorageResponse } from '../types';

export interface IFileMeta {
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

export interface IFile {
    bucket: IBucket;
    name: string;
    path: string;
    meta?: IFileMeta;
    getAbsolutePath(): string;
    delete(): Promise<StorageResponse<boolean>>;
    getStorageUri(): string;
    getPublicUrl(options?: any): Promise<string>;
    getSignedUrl(options?: any): Promise<string>;
    save(options?: CreateFileOptions): Promise<StorageResponse<IFile>>;
    copy(dest: string | IFile, options?: CopyFileOptions): Promise<StorageResponse<IFile>>;
    move(dest: string | IFile, options?: MoveFileOptions): Promise<StorageResponse<IFile>>;
}
