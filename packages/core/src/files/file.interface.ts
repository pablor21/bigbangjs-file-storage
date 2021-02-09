import { IBucket } from '../buckets';
import { CopyFileOptions, CreateFileOptions, GetFileOptions, MoveFileOptions, StorageResponse, Streams } from '../types';
import { IncomingMessage } from 'http';

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

export interface IStorageFile {
    bucket: IBucket;
    name: string;
    path: string;
    meta?: IFileMeta;
    getAbsolutePath(): string;
    delete(): Promise<StorageResponse<boolean>>;
    getStorageUri(): string;
    getPublicUrl(options?: any): Promise<string>;
    getSignedUrl(options?: any): Promise<string>;
    save(options?: CreateFileOptions): Promise<StorageResponse<IStorageFile>>;
    copy(dest: string | IStorageFile, options?: CopyFileOptions): Promise<StorageResponse<IStorageFile>>;
    move(dest: string | IStorageFile, options?: MoveFileOptions): Promise<StorageResponse<IStorageFile>>;
    setContents(contents: string | Buffer | Streams.Readable | IncomingMessage): void;
    getContents(options?: GetFileOptions): Promise<StorageResponse<Buffer>>;
    getStream(options?: GetFileOptions): Promise<StorageResponse<Streams.Readable>>;
    getNativePath(): string;
}
