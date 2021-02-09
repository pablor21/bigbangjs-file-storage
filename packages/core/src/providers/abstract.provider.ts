import EventEmitter from 'events';
import path from 'path';
import { IncomingMessage } from 'http';
import { Bucket, BucketConfigOptions, IBucket } from '../buckets';
import { constructError, StorageExceptionType, throwError } from '../exceptions';
import { FileStorage } from '../filestorage';
import { StorageEventType } from '../eventnames';
import { joinPath, joinUrl, objectNull, Registry, slug, streamToBuffer, stringNullOrEmpty } from '../lib';
import { CopyFileOptions, CopyManyFilesOptions, CreateFileOptions, DeleteFileOptions, DeleteManyFilesOptions, GetFileOptions, ListFilesOptions, ListResult, MoveFileOptions, MoveManyFilesOptions, Pattern, ResolveUriReturn, SignedUrlOptions, StorageResponse, Streams } from '../types';
import { IStorageProvider } from './provider.interface';
import { ProviderConfigOptions } from './types';
import { IFileMeta, IStorageFile } from '../files';

const defaultOptions: ProviderConfigOptions = {
    autoCleanup: true,
    mode: '0777',
};

export abstract class AbstractProvider<ProviderConfigType extends ProviderConfigOptions, BucketConfigType extends BucketConfigOptions = any, NativeResponseType = any, BucketType extends IBucket<BucketConfigType, NativeResponseType> = Bucket<BucketConfigType, NativeResponseType>> extends EventEmitter implements IStorageProvider<BucketConfigType, NativeResponseType, BucketType> {

    public abstract readonly type: string;
    public readonly name: string;
    public readonly config: ProviderConfigType;
    public readonly storage: FileStorage;
    public abstract readonly supportsCrossBucketOperations: boolean;
    protected _buckets: Registry<string, BucketType> = new Registry();
    protected _ready: boolean;

    constructor(storage: FileStorage, config: string | ProviderConfigType) {
        super();
        this.storage = storage;
        this.config = this.parseConfig(config);
        this.name = this.config.name;
        this.validateConfig();
    }

    public log(level: 'info' | 'debug' | 'warn' | 'error', ...args: any) {
        this.storage.log(level, ...args);
    }

    public ready() {
        return this._ready;
    }

    public getBucket(name?: string): BucketType {
        name = name || this.config.defaultBucket || '';
        // name = this.resolveBucketAlias(name);
        if (stringNullOrEmpty(name) || (!this._buckets.has(name!))) {
            throwError(`Bucket ${name} not found in this provider!`, StorageExceptionType.NOT_FOUND, { name: name! });
        }
        return this._buckets.get(name);
    }

    public async removeBucket(b: string | BucketType): Promise<StorageResponse<boolean>> {
        await this.makeReady();
        const name = typeof (b) === 'string' ? b : b.name;
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

    public async listBuckets(): Promise<StorageResponse<BucketType[]>> {
        return this.makeResponse(this._buckets.list());
    }

    public async emptyBucket(bucket: string | BucketType): Promise<StorageResponse<boolean, NativeResponseType>> {
        try {
            const name = typeof (bucket) === 'string' ? bucket : bucket.name;
            if (!this._buckets.has(name)) {
                return this.makeResponse(true);
            }
            bucket = this.getBucket(name);
            return this.deleteFiles(bucket, '', '**');
        } catch (err) {
            this.parseException(err);
        }
    }

    public async getFile<Rtype extends IStorageFile = IStorageFile>(bucket: BucketType, path: string): Promise<StorageResponse<Rtype, NativeResponseType>> {
        return await this.fileExists(bucket, path, true);
    }


    public getStorageUri(bucket: BucketType, fileName: string | IStorageFile): string {
        return this.storage.makeFileUri(this, bucket, fileName);
    }

    public async getPublicUrl(bucket: BucketType, fileName: string | IStorageFile, options?: any): Promise<string> {
        const uri = this.getStorageUri(bucket, fileName);
        return this.storage.getPublicUrl(uri, options);
    }

    public async getSignedUrl(bucket: BucketType, fileName: string | IStorageFile, options?: SignedUrlOptions): Promise<string> {
        options = options || {};
        options.expiration = options.expiration || bucket.config.defaultSignedUrlExpiration || this.config.defaultSignedUrlExpiration || this.storage.config.defaultSignedUrlExpiration;
        const uri = this.getStorageUri(bucket, fileName);
        return this.storage.getSignedUrl(uri, options);
    }

    public async getFileContents(bucket: BucketType, fileName: string | IStorageFile, options?: GetFileOptions): Promise<StorageResponse<Buffer, NativeResponseType>> {
        await this.makeReady();
        this.checkReadPermission(bucket);
        const stream = (await this.getFileStream(bucket, fileName, options)).result;
        return this.makeResponse(await streamToBuffer(stream));
    }

    public async copyFiles<RType extends string[] | IStorageFile[] = IStorageFile[]>(bucket: BucketType, src: string, dest: string, pattern: Pattern = '**', options?: CopyManyFilesOptions): Promise<StorageResponse<RType, NativeResponseType>> {
        await this.makeReady();
        this.checkReadPermission(bucket);

        // both need to be directories
        // this.isDirectoryOrThrow(src, 'src');
        // this.isDirectoryOrThrow(dest, 'dest');

        try {
            const srcPath = this.resolveFileUri(bucket, src, false);
            const destPath = this.resolveFileUri(bucket, dest, true);
            const ret: any = [];
            const toCopy = await this.listFiles(bucket, src, { pattern, returning: false, recursive: true, filter: options?.filter });
            const promises: Promise<StorageResponse<string, NativeResponseType>>[] = [];
            toCopy.result.entries.map(c => {
                const fPath = this.resolveFileUri(bucket, c, false);
                const dPath = destPath.bucket.getStorageUri(joinUrl(this.makeSlug(destPath.path), fPath.path.replace(srcPath.path, '/')));
                promises.push(this.copyFile(bucket, c, dPath, options));
            });
            const result = await Promise.all(promises);
            result.map(r => ret.push(r.result));
            return this.makeResponse(ret);
        } catch (ex) {
            this.parseException(ex);
        }
    }


    public async moveFiles<RType extends string[] | IStorageFile[] = IStorageFile[]>(bucket: BucketType, src: string, dest: string, pattern: Pattern, options?: MoveManyFilesOptions): Promise<StorageResponse<RType, NativeResponseType>> {
        await this.makeReady();
        this.checkReadPermission(bucket);
        // both need to be directories
        // this.isDirectoryOrThrow(src, 'src');
        // this.isDirectoryOrThrow(dest, 'dest');
        try {
            const srcPath = this.resolveFileUri(bucket, src, false);
            const destPath = this.resolveFileUri(bucket, dest, true);
            const ret: any = [];
            const toMove = await this.listFiles(bucket, src, { pattern, returning: false, recursive: true, filter: options?.filter });
            const promises: Promise<StorageResponse<IStorageFile | string, NativeResponseType>>[] = [];
            toMove.result.entries.map(c => {
                const fPath = this.resolveFileUri(bucket, c, false);
                const dPath = destPath.bucket.getStorageUri(joinUrl(this.makeSlug(destPath.path), fPath.path.replace(srcPath.path, '/')));
                promises.push(this.moveFile(bucket, c, dPath, {
                    cleanup: false, // avoid cleanup
                    returning: options?.returning,
                    overwrite: options?.overwrite,
                }));
            });
            const result = await Promise.all(promises);
            if (this.shouldCleanupDirectory(bucket, options?.cleanup)) {
                await this.removeEmptyDirectories(bucket, src);
            }
            result.map(r => ret.push(r.result));
            return this.makeResponse(ret);
        } catch (ex) {
            this.parseException(ex);
        }

    }


    public async deleteFiles(bucket: BucketType, path: string, pattern: Pattern = '**', options?: DeleteManyFilesOptions): Promise<StorageResponse<boolean, NativeResponseType>> {
        await this.makeReady();
        this.checkWritePermission(bucket);
        // this.isDirectoryOrThrow(path, 'path');
        try {
            const toDelete = await this.listFiles(bucket, path, { pattern, returning: false, recursive: true });
            const promises: Promise<StorageResponse<boolean, NativeResponseType>>[] = [];
            toDelete.result.entries.map(c => {
                promises.push(this.deleteFile(bucket, c, {
                    cleanup: false, // avoid cleanup
                }));
            });
            await Promise.all(promises);
            if (this.shouldCleanupDirectory(bucket, options?.cleanup)) {
                await this.removeEmptyDirectories(bucket, path);
            }

            return this.makeResponse(true);
        } catch (ex) {
            this.parseException(ex);
        }
    }


    public async copyFile<RType extends string | IStorageFile = IStorageFile>(bucket: BucketType, src: string | IStorageFile, dest: string | IStorageFile, options?: CopyFileOptions): Promise<StorageResponse<RType, NativeResponseType>> {
        await this.makeReady();
        const stream = (await this.getFileStream(bucket, src)).result;
        return this.putFile(bucket, dest, stream, options);
    }

    public async moveFile<RType extends string | IStorageFile = IStorageFile>(bucket: BucketType, src: string | IStorageFile, dest: string | IStorageFile, options?: MoveFileOptions): Promise<StorageResponse<RType, NativeResponseType>> {
        await this.makeReady();
        const result = await this.copyFile<RType>(bucket, src, dest, options);
        await this.deleteFile(bucket, src, { cleanup: options?.cleanup });
        return result;
    }


    // ABSTRACT METHODS
    public abstract init(): Promise<StorageResponse<boolean, NativeResponseType>>;
    public abstract dispose(): Promise<StorageResponse<boolean, NativeResponseType>>;
    public abstract addBucket(bucket: BucketConfigType | BucketType | string): Promise<StorageResponse<BucketType, NativeResponseType>>;
    public abstract destroyBucket(bucket: string | BucketType): Promise<StorageResponse<boolean, NativeResponseType>>;
    public abstract listUnregisteredBuckets(creationOptions?: BucketConfigOptions): Promise<StorageResponse<BucketConfigType[], NativeResponseType>>;
    public abstract deleteFile(bucket: BucketType, path: string | IStorageFile, options?: DeleteFileOptions): Promise<StorageResponse<boolean, NativeResponseType>>;
    public abstract fileExists<RType extends IStorageFile | boolean = any>(bucket: BucketType, path: string | IStorageFile, returning?: boolean): Promise<StorageResponse<RType, NativeResponseType>>;
    public abstract listFiles<RType extends IStorageFile[] | string[] = IStorageFile[]>(bucket: BucketType, path: string, options?: ListFilesOptions): Promise<StorageResponse<ListResult<RType>, NativeResponseType>>;
    public abstract putFile<RType extends IStorageFile | string = any>(bucket: BucketType, fileName: string | IStorageFile, contents: string | Buffer | Streams.Readable | IncomingMessage, options?: CreateFileOptions): Promise<StorageResponse<RType, NativeResponseType>>;
    public abstract getFileStream(bucket: BucketType, fileName: string | IStorageFile, options?: GetFileOptions): Promise<StorageResponse<Streams.Readable, NativeResponseType>>;
    public abstract removeEmptyDirectories(bucket: BucketType, path: string): Promise<StorageResponse<boolean, NativeResponseType>>;
    protected abstract parseConfig(config: string | ProviderConfigType): ProviderConfigType;
    protected abstract generateFileObject(bucket: BucketType, path: string, options?: any): Promise<IStorageFile>;

    public getNativePath(bucket: BucketType, fileName: string | IStorageFile): string {
        return this.resolveBucketPath(bucket, fileName);
    }

    /**
     * Obtains the bucket + directory path
     * @param bucket the target bucket
     * @param dir the directory
     * @param allowCrossBucket allow cross buckets?
     */
    protected resolveBucketPath(bucket: BucketType, dir?: string | IStorageFile, allowCrossBucket = false): string {
        return this.resolveFileUri(bucket, dir, allowCrossBucket).path;
    }

    public resolveFileUri(bucket: BucketType, src: string | IStorageFile, allowCrossBucket = false): ResolveUriReturn {
        const parts = this.storage.resolveFileUri(src);
        if (parts) {
            if (parts.provider !== this) {
                throwError(`The file uri is invalid, wrong provider name!`, StorageExceptionType.INVALID_PARAMS, {
                    expected: this.name,
                    received: parts.provider.name,
                });
            }
            if (parts.bucket !== bucket && ((!allowCrossBucket) || (allowCrossBucket && !this.supportsCrossBucketOperations))) {
                throwError(`The file uri is invalid, wrong bucket name!`, StorageExceptionType.INVALID_PARAMS, {
                    expected: bucket.absoluteName,
                    received: parts.bucket.absoluteName,
                });
            }
            parts.path = this.normalizePath(parts.path);
            return parts;
        }
        return {
            path: this.normalizePath(this.getFilenameFromFile(src)),
            provider: this,
            bucket,
        };
    }


    /**
     * Check if a bucket exists and throws an exception
     * @param name the name of the bucket
     */
    protected ensureBucketNotRegistered(name: string) {
        if (this._buckets.has(name) || this.storage.buckets.has(name)) {
            throwError(`The bucket ${name} already exists!`, StorageExceptionType.DUPLICATED_ELEMENT, { name, provider: this });
        }
    }

    protected checkReadPermission(bucket: BucketType): void {
        if (!bucket.canRead()) {
            throwError(`Cannot read on bucket ${bucket.name}`, StorageExceptionType.PERMISSION_ERROR);
        }
    }

    protected checkWritePermission(bucket: BucketType): void {
        if (!bucket.canWrite()) {
            throwError(`Cannot write on bucket ${bucket.name}`, StorageExceptionType.PERMISSION_ERROR);
        }
    }

    protected makeResponse(responseResult: any, nativeResponse?: NativeResponseType): StorageResponse<any, NativeResponseType> {
        return {
            result: responseResult,
            nativeResponse: nativeResponse as NativeResponseType,
        };
    }

    protected extractBucketOptions(bucket: BucketType): BucketConfigType {
        return bucket.config as BucketConfigType;
    }

    protected async makeReady(): Promise<StorageResponse<boolean, NativeResponseType>> {
        if (!this.ready()) {
            return this.init();
        }
        return this.makeResponse(true);
    }

    protected makeFileUri(bucket: BucketType, fileName: string | IStorageFile): string {
        return this.storage.makeFileUri(this, bucket, fileName);
    }

    protected fileNameMatches(name: string | string[], pattern: Pattern): boolean | string[] {
        return this.storage.matches(name, pattern);
    }

    protected makeSlug(fileName: string | IStorageFile, replacement = '-'): string {
        fileName = this.getFilenameFromFile(fileName);
        return this.storage.makeSlug(fileName, replacement);
    }

    protected async getMime(fileName: string): Promise<string> {
        return this.storage.getMime(fileName);
    }

    protected resolveBucketAlias(name: string): string {
        return this.storage.makeBucketAlias(name, this);
    }

    protected getFilenameFromFile(file: string | IStorageFile = '') {
        return this.storage.getFilenameFromFile(file);
    }

    protected isDirectory(path: string): boolean {
        return this.storage.isDirectory(path);
    }

    protected isFile(path: string): boolean {
        return this.storage.isFile(path);
    }

    protected isFileOrTrow(path: string, paramName = ''): void {
        return this.storage.isFileOrTrow(path, paramName);
    }

    protected isDirectoryOrThrow(path: string, paramName = ''): void {
        return this.storage.isDirectoryOrThrow(path, paramName);
    }

    protected extractDirectoryFromPath(dir: string): string {
        return this.storage.extractDirectoryFromPath(dir);
    }

    protected extractFilenameFromPath(dir: string): string {
        return this.storage.extractFilenameFromPath(dir);
    }

    protected normalizePath(dir?: string): string {
        return this.storage.normalizePath(dir);
    }

    protected shouldReturnObject(returning: boolean | undefined): boolean {
        return returning === true || objectNull(returning) && this.storage.config.returningByDefault;
    }

    protected shouldCleanupDirectory(bucket: BucketType, cleanup: boolean | undefined): boolean {
        return cleanup === true || (undefined === cleanup && (bucket.config.autoCleanup === true || this.config.autoCleanup === true || this.storage.config.autoCleanup === true));
    }

    protected parseException(ex: Error, type: StorageExceptionType = StorageExceptionType.NATIVE_ERROR) {
        if (ex.name === 'ENOENT') {
            // eslint-disable-next-line dot-notation
            ex['type'] = StorageExceptionType.NOT_FOUND;
        }
        this.storage.parseException(ex, type);
    }

    protected validateConfig(): void {
        if (stringNullOrEmpty(this.config.name)) {
            throwError(`Invalid provider config! The name must be provided!`);
        }
    }

}
