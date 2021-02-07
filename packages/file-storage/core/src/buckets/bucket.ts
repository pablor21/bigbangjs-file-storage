import { StorageResponse, ListResult, GetFileOptions, Streams, CreateFileOptions, CopyFileOptions, ListFilesOptions, MoveFileOptions, DeleteFileOptions, CopyManyFilesOptions, MoveManyFilesOptions, Pattern, DeleteManyFilesOptions, SignedUrlOptions } from '../types';
import { canRead, canWrite } from '../lib';
import { IBucket } from './bucket.interface';
import { BucketConfigOptions } from './types';
import { IStorageProvider } from '../providers';
import { IStorageFile } from '../files';

export class Bucket<ConfigType extends BucketConfigOptions = any, NativeResponseType = any> implements IBucket<ConfigType, NativeResponseType> {

    public readonly name: string;
    public readonly absoluteName: string;
    public readonly config: ConfigType;
    public readonly provider: IStorageProvider<ConfigType, NativeResponseType>;
    public nativeProperites: any = {};

    constructor(provider: IStorageProvider<ConfigType, NativeResponseType>, name: string, absoltuteName: string, config: BucketConfigOptions | Record<string, any>) {
        this.config = config as ConfigType;
        this.name = name;
        this.absoluteName = absoltuteName;
        this.provider = provider;
    }

    public getNativePath(path: string | IStorageFile): string {
        return this.provider.getNativePath(this, path);
    }

    public async remove(): Promise<StorageResponse<boolean>> {
        return this.provider.removeBucket(this);
    }

    public async destroy(): Promise<StorageResponse<boolean, NativeResponseType>> {
        return this.provider.destroyBucket(this);
    }

    public canRead(): boolean {
        return canRead(this.config.mode);
    }

    public canWrite(): boolean {
        return canWrite(this.config.mode);
    }

    public async deleteFile(dir: string | IStorageFile, options?: DeleteFileOptions): Promise<StorageResponse<boolean, NativeResponseType>> {
        return this.provider.deleteFile(this, dir, options);
    }

    public async deleteFiles(dir: string, pattern: Pattern, options?: DeleteManyFilesOptions): Promise<StorageResponse<boolean, NativeResponseType>> {
        return this.provider.deleteFiles(this, dir, pattern, options);
    }

    public async listFiles<RType extends IStorageFile[] | string[] = IStorageFile[]>(path?: string, options?: ListFilesOptions): Promise<StorageResponse<ListResult<RType>, NativeResponseType>> {
        return this.provider.listFiles(this, path, options);
    }

    public async fileExists<RType extends IStorageFile | boolean = IStorageFile>(path: string | IStorageFile, returning?: boolean): Promise<StorageResponse<RType, NativeResponseType>> {
        return this.provider.fileExists(this, path, returning);
    }

    public async getFile<Rtype extends IStorageFile = IStorageFile>(path: string): Promise<StorageResponse<Rtype, NativeResponseType>> {
        return this.provider.getFile(this, path);
    }

    public async putFile<RType extends IStorageFile | string = IStorageFile>(fileName: string | IStorageFile, contents: string | Buffer | Streams.Readable, options?: CreateFileOptions): Promise<StorageResponse<RType, NativeResponseType>> {
        return this.provider.putFile(this, fileName, contents, options);
    }

    public async getFileStream(fileName: string | IStorageFile, options?: GetFileOptions): Promise<StorageResponse<Streams.Readable, NativeResponseType>> {
        return this.provider.getFileStream(this, fileName, options);
    }

    public async getFileContents(fileName: string | IStorageFile, options?: GetFileOptions): Promise<StorageResponse<Buffer, NativeResponseType>> {
        return this.provider.getFileContents(this, fileName, options);
    }

    public async copyFile<RType extends IStorageFile | string = IStorageFile>(src: string | IStorageFile, dest: string | IStorageFile, options?: CopyFileOptions): Promise<StorageResponse<RType, NativeResponseType>> {
        return this.provider.copyFile(this, src, dest, options);
    }

    public async moveFile<RType extends IStorageFile | string = IStorageFile>(src: string | IStorageFile, dest: string | IStorageFile, options?: MoveFileOptions): Promise<StorageResponse<RType, NativeResponseType>> {
        return this.provider.moveFile(this, src, dest, options);
    }


    public getStorageUri(fileName: string | IStorageFile): string {
        return this.provider.getStorageUri(this, fileName);
    }

    public async getPublicUrl(fileName: string | IStorageFile, options?: any): Promise<string> {
        return this.provider.getPublicUrl(this, fileName, options);
    }

    public async getSignedUrl(fileName: string | IStorageFile, options?: SignedUrlOptions): Promise<string> {
        return this.provider.getSignedUrl(this, fileName, options);
    }

    public async copyFiles<RType extends IStorageFile[] | string[] = IStorageFile[]>(src: string, dest: string, pattern: Pattern, options?: CopyManyFilesOptions): Promise<StorageResponse<RType, NativeResponseType>> {
        return this.provider.copyFiles(this, src, dest, pattern, options);
    }

    public async moveFiles<RType extends IStorageFile[] | string[] = IStorageFile[]>(src: string, dest: string, pattern: Pattern, options?: MoveManyFilesOptions): Promise<StorageResponse<RType, NativeResponseType>> {
        return this.provider.moveFiles(this, src, dest, pattern, options);
    }

    public async removeEmptyDirectories(basePath = '/'): Promise<StorageResponse<boolean, NativeResponseType>> {
        return this.provider.removeEmptyDirectories(this, basePath);
    }

}
