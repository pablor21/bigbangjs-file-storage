import EventEmitter from 'events';
import path from 'path';
import { IncomingMessage } from 'http';
import { BucketConfigOptions, IBucket } from '../buckets';
import { constructError, StorageExceptionType, throwError } from '../exceptions';
import { FileStorage } from '../filestorage';
import { StorageEventType } from '../eventnames';
import { objectNull, Registry, stringNullOrEmpty } from '../lib';
import { CopyFileOptions, CopyManyFilesOptions, CreateFileOptions, DeleteFileOptions, DeleteManyFilesOptions, GetFileOptions, ListFilesOptions, ListResult, MoveFileOptions, MoveManyFilesOptions, Pattern, ResolveUriReturn, SignedUrlOptions, StorageResponse, Streams } from '../types';
import { IStorageProvider } from './provider.interface';
import { ProviderConfigOptions } from './types';
import { IStorageFile } from '../files';


export abstract class AbstractProvider<ProviderConfigType extends ProviderConfigOptions, BucketConfigType extends BucketConfigOptions, NativeResponseType = any> extends EventEmitter implements IStorageProvider<BucketConfigType, NativeResponseType> {

    public abstract readonly type: string;
    public readonly name: string;
    public readonly config: ProviderConfigType;
    public readonly storage: FileStorage;
    public abstract readonly supportsCrossBucketOperations: boolean;
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
        // name = this.resolveBucketAlias(name);
        if (stringNullOrEmpty(name) || (!this._buckets.has(name!))) {
            throwError(`Bucket ${name} not found in this provider!`, StorageExceptionType.NOT_FOUND, { name: name! });
        }
        return this._buckets.get(name);
    }

    public async removeBucket(b: string | IBucket): Promise<StorageResponse<boolean>> {
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

    public async listBuckets(): Promise<StorageResponse<IBucket[]>> {
        return this.makeResponse(this._buckets.list());
    }

    public async getFile<Rtype extends IStorageFile = IStorageFile>(bucket: IBucket, path: string): Promise<StorageResponse<Rtype, NativeResponseType>> {
        return await this.fileExists(bucket, path, true);
    }


    public getStorageUri(bucket: IBucket, fileName: string | IStorageFile): string {
        return this.storage.makeFileUri(this, bucket, fileName);
    }

    public async getPublicUrl(bucket: IBucket, fileName: string | IStorageFile, options?: any): Promise<string> {
        const uri = this.getStorageUri(bucket, fileName);
        return this.storage.getPublicUrl(uri, options);
    }

    public async getSignedUrl(bucket: IBucket, fileName: string | IStorageFile, options?: SignedUrlOptions): Promise<string> {
        options = options || {};
        options.expiration = options.expiration || bucket.config.defaultSignedUrlExpiration || this.config.defaultSignedUrlExpiration || this.storage.config.defaultSignedUrlExpiration;
        const uri = this.getStorageUri(bucket, fileName);
        return this.storage.getSignedUrl(uri, options);
    }

    public async getFileContents(bucket: IBucket, fileName: string | IStorageFile, options?: GetFileOptions): Promise<StorageResponse<Buffer, NativeResponseType>> {
        await this.makeReady();
        this.checkReadPermission(bucket);
        const parts: any = [];
        const stream = (await this.getFileStream(bucket, fileName, options)).result;
        stream.on('data', data => parts.push(data));
        const promise = new Promise((resolve, reject) => {
            stream.on('end', () => resolve(Buffer.concat(parts)));
            stream.on('error', err => reject(this.parseException(err)));
        });
        return this.makeResponse(await promise);
    }

    public async copyFiles<RType extends string[] | IStorageFile[] = IStorageFile[]>(bucket: IBucket, src: string, dest: string, pattern: Pattern = '**', options?: CopyManyFilesOptions): Promise<StorageResponse<RType, NativeResponseType>> {
        await this.makeReady();
        this.checkReadPermission(bucket);

        // both need to be directories
        this.isDirectoryOrThrow(src, 'src');
        this.isDirectoryOrThrow(dest, 'dest');

        try {
            const srcPath = this.resolveFileUri(bucket, src, false);
            const ret: any = [];
            const toCopy = await this.listFiles(bucket, src, { pattern, returning: false, recursive: true, filter: options?.filter });
            const promises: Promise<StorageResponse<string, NativeResponseType>>[] = [];
            toCopy.result.entries.map(c => {
                const fPath = this.resolveFileUri(bucket, c, false);
                const destPath = `${dest}/${fPath.path.replace(srcPath.path, '')}`;
                promises.push(this.copyFile(bucket, c, destPath, options));
            });
            const result = await Promise.all(promises);
            result.map(r => ret.push(r.result));
            return this.makeResponse(ret);
        } catch (ex) {
            this.parseException(ex);
        }
    }


    public async moveFiles<RType extends string[] | IStorageFile[] = IStorageFile[]>(bucket: IBucket, src: string, dest: string, pattern: Pattern, options?: MoveManyFilesOptions): Promise<StorageResponse<RType, NativeResponseType>> {
        await this.makeReady();
        this.checkReadPermission(bucket);
        // both need to be directories
        this.isDirectoryOrThrow(src, 'src');
        this.isDirectoryOrThrow(dest, 'dest');
        try {
            const srcPath = this.resolveFileUri(bucket, src, false);
            const ret: any = [];
            const toMove = await this.listFiles(bucket, src, { pattern, returning: false, recursive: true, filter: options?.filter });
            const promises: Promise<StorageResponse<IStorageFile | string, NativeResponseType>>[] = [];
            toMove.result.entries.map(c => {
                const fPath = this.resolveFileUri(bucket, c, false);
                const destPath = `${dest}/${fPath.path.replace(srcPath.path, '')}`;
                promises.push(this.moveFile(bucket, c, destPath, {
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


    public async deleteFiles(bucket: IBucket, path: string, pattern: Pattern = '**', options?: DeleteManyFilesOptions): Promise<StorageResponse<boolean, NativeResponseType>> {
        await this.makeReady();
        this.checkWritePermission(bucket);
        this.isDirectoryOrThrow(path, 'path');
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


    public async copyFile<RType extends string | IStorageFile = IStorageFile>(bucket: IBucket, src: string | IStorageFile, dest: string | IStorageFile, options?: CopyFileOptions): Promise<StorageResponse<RType, NativeResponseType>> {
        await this.makeReady();
        const stream = (await this.getFileStream(bucket, src)).result;
        return this.putFile(bucket, dest, stream, options);
    }

    public async moveFile<RType extends string | IStorageFile = IStorageFile>(bucket: IBucket, src: string | IStorageFile, dest: string | IStorageFile, options?: MoveFileOptions): Promise<StorageResponse<RType, NativeResponseType>> {
        await this.makeReady();
        const result = await this.copyFile<RType>(bucket, src, dest, options);
        await this.deleteFile(bucket, src, { cleanup: options?.cleanup });
        return result;
    }


    // ABSTRACT METHODS
    public abstract init(): Promise<StorageResponse<boolean, NativeResponseType>>;
    public abstract dispose(): Promise<StorageResponse<boolean, NativeResponseType>>;
    public abstract addBucket(name: string, config?: BucketConfigType): Promise<StorageResponse<IBucket, NativeResponseType>>;
    public abstract destroyBucket(name: string): Promise<StorageResponse<boolean, NativeResponseType>>;
    public abstract listUnregisteredBuckets(creationOptions?: BucketConfigOptions): Promise<StorageResponse<BucketConfigType[], NativeResponseType>>;
    public abstract deleteFile(bucket: IBucket, path: string | IStorageFile, options?: DeleteFileOptions): Promise<StorageResponse<boolean, NativeResponseType>>;
    public abstract fileExists<RType extends IStorageFile | boolean = any>(bucket: IBucket, path: string | IStorageFile, returning?: boolean): Promise<StorageResponse<RType, NativeResponseType>>;
    public abstract listFiles<RType extends IStorageFile[] | string[] = IStorageFile[]>(bucket: IBucket, path: string, options?: ListFilesOptions): Promise<StorageResponse<ListResult<RType>, NativeResponseType>>;
    public abstract putFile<RType extends IStorageFile | string = any>(bucket: IBucket, fileName: string | IStorageFile, contents: string | Buffer | Streams.Readable | IncomingMessage, options?: CreateFileOptions): Promise<StorageResponse<RType, NativeResponseType>>;
    public abstract getFileStream(bucket: IBucket, fileName: string | IStorageFile, options?: GetFileOptions): Promise<StorageResponse<Streams.Readable, NativeResponseType>>;
    public abstract removeEmptyDirectories(bucket: IBucket, path: string): Promise<StorageResponse<boolean, NativeResponseType>>;
    protected abstract parseConfig(config: string | ProviderConfigType): ProviderConfigType;
    protected abstract generateFileObject(bucket: IBucket, path: string, options?: any): Promise<IStorageFile>;

    public getNativePath(bucket: IBucket, fileName: string | IStorageFile): string {
        return this.resolveBucketPath(bucket, fileName);
    }

    /**
     * Obtains the bucket + directory path
     * @param bucket the target bucket
     * @param dir the directory
     * @param allowCrossBucket allow cross buckets?
     */
    protected resolveBucketPath(bucket: IBucket, dir?: string | IStorageFile, allowCrossBucket = false): string {
        return this.resolveFileUri(bucket, dir, allowCrossBucket).path;
    }

    public resolveFileUri(bucket: IBucket, src: string | IStorageFile, allowCrossBucket = false): ResolveUriReturn {
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

    protected checkReadPermission(bucket: IBucket): void {
        if (!bucket.canRead()) {
            throwError(`Cannot read on bucket ${bucket.name}`, StorageExceptionType.PERMISSION_ERROR);
        }
    }

    protected checkWritePermission(bucket: IBucket): void {
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

    protected extractBucketOptions(bucket: IBucket): BucketConfigType {
        return bucket.config as BucketConfigType;
    }

    protected async makeReady(): Promise<StorageResponse<boolean, NativeResponseType>> {
        if (!this.ready()) {
            return this.init();
        }
        return this.makeResponse(true);
    }

    protected makeFileUri(bucket: IBucket, fileName: string | IStorageFile): string {
        return this.storage.makeFileUri(this, bucket, fileName);
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

    protected resolveBucketAlias(name: string): string {
        return this.storage.makeBucketAlias(name, this);
    }

    protected getFilenameFromFile(file: string | IStorageFile = '') {
        return this.storage.getFilenameFromFile(file);
    }

    protected isDirectory(path: string): boolean {
        if (stringNullOrEmpty(path)) {
            return true;
        }
        return path.lastIndexOf('/') === path.length - 1;
    }

    protected isFile(path: string): boolean {
        if (stringNullOrEmpty(path)) {
            return false;
        }
        return !this.isDirectory(path);
    }

    protected isFileOrTrow(path: string, paramName = ''): void {
        if (!this.isFile(path)) {
            throw constructError(`The path ${paramName} is not a valid filename!`, StorageExceptionType.INVALID_PARAMS);
        }
    }

    protected isDirectoryOrThrow(path: string, paramName = ''): void {
        if (!this.isDirectory(path)) {
            throw constructError(`The path ${paramName} is not a valid directory! Directories must end with '/'.`, StorageExceptionType.INVALID_PARAMS);
        }
    }

    protected extractDirectoryFromPath(dir: string): string {
        if (this.isDirectory(dir)) {
            return dir;
        }
        const parts = dir.split('/');
        const final = parts.splice(0, parts.length - 1).join('/');
        return path.join(final, '/').replace(/\\/g, '/');
    }

    protected extractFilenameFromPath(dir: string): string {
        if (!this.isFile(dir)) {
            return '';
        }
        const parts = dir.split('/').reverse();
        return parts[0];
    }

    protected normalizePath(dir?: string): string {
        return this.storage.normalizePath(dir);
    }

    protected shouldReturnObject(returning: boolean | undefined): boolean {
        return returning === true || objectNull(returning) && this.storage.config.returningByDefault;
    }

    protected shouldCleanupDirectory(bucket: IBucket, cleanup: boolean | undefined): boolean {
        return cleanup === true || (undefined === cleanup && (bucket.config.autoCleanup === true || this.config.autoCleanup === true || this.storage.config.autoCleanup === true));
    }


    protected parseException(ex: Error, type: StorageExceptionType = StorageExceptionType.NATIVE_ERROR) {
        this.storage.parseException(ex, type);
    }

}
