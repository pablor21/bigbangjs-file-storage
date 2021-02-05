import EventEmitter from 'events';
import path from 'path';
import { BucketConfigOptions, IBucket } from '../buckets';
import { StorageException, StorageExceptionType } from '../exceptions';
import { FileStorage } from '../filestorage';
import { StorageEventType } from '../eventnames';
import { objectNull, Registry, stringNullOrEmpty } from '../lib';
import { CopyDirectoryOptions, CopyFileOptions, CreateDirectoryOptions, CreateFileOptions, DeleteFileEntryOptions, DirectoryListOptions, FileEntryListOptions, FileListOptions, GetFileOptions, ListResult, MoveDirectoryOptions, Pattern, StorageResponse, Streams } from '../types';
import { IStorageProvider } from './provider.interface';
import { ProviderConfigOptions } from './types';
import { IFileEntry, IDirectory, IFile } from '../files';


export abstract class AbstractProvider<ProviderConfigType extends ProviderConfigOptions, BucketConfigType extends BucketConfigOptions, NativeResponseType = any> extends EventEmitter implements IStorageProvider<BucketConfigType, NativeResponseType> {

    public abstract readonly type: string;
    public readonly name: string;
    public readonly config: ProviderConfigType;
    public readonly storage: FileStorage;
    protected _buckets: Registry<string, IBucket<BucketConfigType, NativeResponseType>> = new Registry();
    protected _ready: boolean;

    constructor(storage: FileStorage, name: string, config: string | ProviderConfigType) {
        super();
        this.name = name;
        this.storage = storage;
        this.config = this.parseConfig(config);
    }

    public log(level: 'info' | 'debug' | 'warn' | 'error', ...args: any) {
        this.storage.log(level, ...args);
    }

    public ready() {
        return this._ready;
    }

    public getBucket(name?: string): IBucket {
        name = name || this.config.defaultBucket || '';
        if (stringNullOrEmpty(name) || (!this._buckets.has(name!))) {
            throw new StorageException(StorageExceptionType.NOT_FOUND, `Bucket ${name} not found in this provider!`, { name: name! });
        }
        return this._buckets.get(name);
    }

    public async removeBucket(name: string): Promise<StorageResponse<boolean>> {
        await this.makeReady();
        if (!this._buckets.has(name)) {
            return this.makeResponse(true);
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const bucket = this._buckets.get(name)!;
        this.emit(StorageEventType.BEFORE_REMOVE_BUCKET, bucket);
        this._buckets.remove(name);
        this.emit(StorageEventType.BUCKET_REMOVED, bucket);
        return this.makeResponse(true);
    }

    public async listBuckets(): Promise<StorageResponse<IBucket[]>> {
        return this.makeResponse(this._buckets.list());
    }

    public async directoryExists<RType extends IDirectory | boolean = any>(bucket: IBucket, path: string | IDirectory, returning?: boolean): Promise<StorageResponse<RType, NativeResponseType>> {
        await this.makeReady();
        const exists = await this.exists<RType>(bucket, path, true);
        if (!exists.result) {
            return this.makeResponse(false, exists.nativeResponse);
        }
        if (exists.result && (exists.result as IDirectory).getType() !== 'DIRECTORY') {
            return this.makeResponse(false, exists.nativeResponse);
        }

        if (returning) {
            return this.makeResponse(exists.result, exists.nativeResponse);
        }
        return this.makeResponse(true, exists.nativeResponse);

    }


    public async fileExists<RType extends IFile | boolean = any>(bucket: IBucket, path: string | IFile, returning?: boolean): Promise<StorageResponse<RType, NativeResponseType>> {
        await this.makeReady();
        const exists = await this.exists<RType>(bucket, path, true);

        if (!exists.result) {
            return this.makeResponse(false, exists.nativeResponse);
        }

        if (exists.result && (exists.result as IFile).getType() !== 'FILE') {
            return this.makeResponse(false, exists.nativeResponse);
        }

        if (returning) {
            return this.makeResponse(exists.result, exists.nativeResponse);
        }
        return this.makeResponse(true, exists.nativeResponse);
    }

    public async listDirectories<RType extends ListResult<any>>(bucket: IBucket, path: string | IDirectory, options?: DirectoryListOptions): Promise<StorageResponse<RType, NativeResponseType>> {
        options = options || {};
        (options as FileEntryListOptions).type = 'DIRECTORY';
        return this.list(bucket, path, options as FileEntryListOptions);
    }

    public async listFiles<RType extends ListResult<any>>(bucket: IBucket, path: string | IDirectory, options?: FileListOptions): Promise<StorageResponse<RType, NativeResponseType>> {
        options = options || {};
        (options as FileEntryListOptions).type = 'FILE';
        return this.list(bucket, path, options as FileEntryListOptions);
    }

    public async getFile<Rtype extends IFile = IFile>(bucket: IBucket, path: string): Promise<StorageResponse<Rtype, NativeResponseType>> {
        const info = await this.getFileEntry(bucket, path);
        if (info.result && info.result.getType() === 'FILE') {
            return this.makeResponse(info.result, info.nativeResponse);
        }
        return this.makeResponse(undefined);
    }

    public async getDirectory<Rtype extends IDirectory = IDirectory>(bucket: IBucket, path: string): Promise<StorageResponse<Rtype, NativeResponseType>> {
        const info = await this.getFileEntry(bucket, path);
        if (info.result && info.result.getType() === 'DIRECTORY') {
            return this.makeResponse(info.result, info.nativeResponse);
        }
        return this.makeResponse(undefined);
    }

    public async exists<RType extends IFileEntry | boolean = any>(bucket: IBucket, path: string | IFileEntry, returning?: boolean): Promise<StorageResponse<RType, NativeResponseType>> {
        path = typeof (path) === 'string' ? path : path.getAbsolutePath();
        const info = await this.getFileEntry(bucket, path);
        if (info.result) {
            if (returning) {
                return this.makeResponse(info.result, info.nativeResponse);
            }
            return this.makeResponse(true, info.nativeResponse);
        }
        return this.makeResponse(false, info.nativeResponse);
    }


    public getStorageUri(bucket: IBucket, fileName: string | IFileEntry): string {
        return this.storage.makeFileUri(this, bucket, fileName);
    }

    public async getPublicUrl(bucket: IBucket, fileName: string | IFileEntry, options?: any): Promise<string> {
        const uri = this.getStorageUri(bucket, fileName);
        return this.storage.getPublicUrl(uri, options);
    }

    public async getSignedUrl(bucket: IBucket, fileName: string | IFileEntry, options?: any): Promise<string> {
        const uri = this.getStorageUri(bucket, fileName);
        return this.storage.getSignedUrl(uri, options);
    }


    // ABSTRACT METHODS
    public abstract init(): Promise<StorageResponse<boolean, NativeResponseType>>;
    public abstract dispose(): Promise<StorageResponse<boolean, NativeResponseType>>;
    public abstract addBucket(name: string, config?: BucketConfigType): Promise<StorageResponse<IBucket, NativeResponseType>>;
    public abstract destroyBucket(name: string): Promise<StorageResponse<boolean, NativeResponseType>>;
    public abstract listUnregisteredBuckets(creationOptions?: BucketConfigOptions): Promise<StorageResponse<BucketConfigType[], NativeResponseType>>;
    public abstract makeDirectory<RType extends IDirectory | string = any>(bucket: IBucket, path: string | IDirectory, options?: CreateDirectoryOptions): Promise<StorageResponse<RType, NativeResponseType>>;
    public abstract delete(bucket: IBucket, path: string | IFileEntry, options?: DeleteFileEntryOptions): Promise<StorageResponse<boolean, NativeResponseType>>;
    public abstract emptyDirectory(bucket: IBucket, path: string | IDirectory): Promise<StorageResponse<boolean, NativeResponseType>>;
    public abstract moveDirectory<RType extends IDirectory | string = any>(bucket: IBucket, src: string | IDirectory, dest: string | IDirectory, options?: MoveDirectoryOptions): Promise<StorageResponse<RType, NativeResponseType>>;
    public abstract copyDirectory<RType extends IDirectory | string = any>(bucket: IBucket, src: string | IDirectory, dest: string | IDirectory, options?: CopyDirectoryOptions): Promise<StorageResponse<RType, NativeResponseType>>;
    public abstract getFileEntry<Rtype extends IFileEntry = IFileEntry>(bucket: IBucket, path: string): Promise<StorageResponse<Rtype, NativeResponseType>>;
    public abstract list<RType extends ListResult<any>>(bucket: IBucket, path: string | IDirectory, options?: FileEntryListOptions): Promise<StorageResponse<RType, NativeResponseType>>;
    public abstract putFile<RType extends IFile | string = any>(bucket: IBucket, fileName: string | IFile, contents: string | Buffer | Streams.Readable, options?: CreateFileOptions): Promise<StorageResponse<RType, NativeResponseType>>;
    public abstract getFileStream(bucket: IBucket, fileName: string | IFile, options?: GetFileOptions): Promise<StorageResponse<Streams.Readable, NativeResponseType>>;
    public abstract getFileContents(bucket: IBucket, fileName: string | IFile, options?: GetFileOptions): Promise<StorageResponse<Buffer, NativeResponseType>>;
    public abstract copyFile<RType extends string | IFile = any>(bucket: IBucket, src: string | IFile, dest: string | IFile, options?: CopyFileOptions): Promise<StorageResponse<RType, NativeResponseType>>;
    public abstract moveFile<RType extends string | IFile = any>(bucket: IBucket, src: string | IFile, dest: string | IFile, options?: CopyFileOptions): Promise<StorageResponse<RType, NativeResponseType>>;
    protected abstract parseConfig(config: string | ProviderConfigType): ProviderConfigType;
    protected abstract generateFileObject(bucket: IBucket, path: string, options?: any): Promise<IFileEntry>;


    protected resolveFileUri(bucket: IBucket, uri: string): string {
        const parts = this.storage.resolveFileUri(uri);
        if (parts && parts.bucket === bucket && parts.provider === this) {
            return parts.path;
        }
        return uri;
    }

    /**
     * Check if a bucket exists and throws an exception
     * @param name the name of the bucket
     */
    protected ensureBucketNotRegistered(name: string) {
        if (this._buckets.has(name) || this.storage.buckets.has(name)) {
            throw new StorageException(StorageExceptionType.DUPLICATED_ELEMENT, `The bucket ${name} already exists!`, { name, provider: this });
        }
    }

    protected makeResponse(responseResult: any, nativeResponse?: NativeResponseType): StorageResponse<any, NativeResponseType> {
        return {
            result: responseResult,
            nativeResponse: nativeResponse as NativeResponseType,
        };
    }

    protected extractBucketOptions(bucket: IBucket): BucketConfigType {
        return bucket.config as BucketConfigType;
    }

    protected async makeReady(): Promise<StorageResponse<boolean, NativeResponseType>> {
        if (!this.ready()) {
            return this.init();
        }
        return this.makeResponse(true);
    }

    protected fileNameMatches(name: string | string[], pattern: Pattern): boolean | string[] {
        return this.storage.matches(name, pattern);
    }

    protected slug(fileName: string, replacement = '-'): string {
        return this.storage.slug(fileName, replacement);
    }

    protected async getMime(fileName: string): Promise<string> {
        return this.storage.getMime(fileName);
    }

    protected async resolveBucketAlias(name: string): Promise<string> {
        return this.storage.resolveBucketAlias(name, this);
    }

    protected normalizePath(dir?: string): string {
        if (!dir) {
            return '/';
        }

        dir.replace(/\\/g, '/');
        let result = '';
        dir.split('/').map(d => {
            if (d !== '/' && !stringNullOrEmpty(d)) {
                result += '/' + this.slug(d);
            }
        });

        return path.normalize(result).replace(/\\/g, '/');
    }

    protected shouldReturnObject(returning: boolean | undefined): boolean {
        return returning === true || objectNull(returning) && this.storage.config.returningByDefault;
    }

}
