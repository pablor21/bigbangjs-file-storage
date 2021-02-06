import EventEmitter from 'events';
import path from 'path';
import { BucketConfigOptions, IBucket } from '../buckets';
import { StorageException, StorageExceptionType } from '../exceptions';
import { FileStorage } from '../filestorage';
import { StorageEventType } from '../eventnames';
import { objectNull, Registry, stringNullOrEmpty } from '../lib';
import { CopyFileOptions, CopyManyFilesOptions, CreateFileOptions, DeleteFileOptions, DeleteManyFilesOptions, GetFileOptions, ListFilesOptions, ListResult, MoveFileOptions, MoveManyFilesOptions, Pattern, StorageResponse, Streams } from '../types';
import { IStorageProvider } from './provider.interface';
import { ProviderConfigOptions } from './types';
import { IFile } from '../files';


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
        // name = this.resolveBucketAlias(name);
        if (stringNullOrEmpty(name) || (!this._buckets.has(name!))) {
            throw new StorageException(StorageExceptionType.NOT_FOUND, `Bucket ${name} not found in this provider!`, { name: name! });
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

    public async getFile<Rtype extends IFile = IFile>(bucket: IBucket, path: string): Promise<StorageResponse<Rtype, NativeResponseType>> {
        return await this.fileExists(bucket, path, true);
    }


    public getStorageUri(bucket: IBucket, fileName: string | IFile): string {
        return this.storage.makeFileUri(this, bucket, fileName);
    }

    public async getPublicUrl(bucket: IBucket, fileName: string | IFile, options?: any): Promise<string> {
        const uri = this.getStorageUri(bucket, fileName);
        return this.storage.getPublicUrl(uri, options);
    }

    public async getSignedUrl(bucket: IBucket, fileName: string | IFile, options?: any): Promise<string> {
        const uri = this.getStorageUri(bucket, fileName);
        return this.storage.getSignedUrl(uri, options);
    }

    public async getFileContents(bucket: IBucket, fileName: string | IFile, options?: GetFileOptions): Promise<StorageResponse<Buffer, NativeResponseType>> {
        await this.makeReady();
        if (!bucket.canRead()) {
            throw new StorageException(StorageExceptionType.DUPLICATED_ELEMENT, `Cannot read on bucket ${bucket.name}!`);
        }
        const parts: any = [];
        const stream = (await this.getFileStream(bucket, fileName, options)).result;
        stream.on('data', data => parts.push(data));
        const promise = new Promise((resolve, reject) => {
            stream.on('end', () => resolve(Buffer.concat(parts)));
            stream.on('error', err => reject(this.parseException(err)));
        });
        return this.makeResponse(await promise);
    }

    public async copyFiles<RType extends string[] | IFile[] = IFile[]>(bucket: IBucket, src: string, dest: string, pattern: Pattern, options?: CopyManyFilesOptions): Promise<StorageResponse<RType, NativeResponseType>> {
        await this.makeReady();
        if (!bucket.canWrite()) {
            throw new StorageException(StorageExceptionType.PERMISSION_ERROR, `Cannot write on bucket ${bucket.name}!`);
        }
        try {
            src = this.resolveFileUri(bucket, src);
            const toCopy = await this.listFiles(bucket, src, { pattern, returning: false, recursive: true });
            const promises: Promise<StorageResponse<IFile | string, NativeResponseType>>[] = [];
            toCopy.result.entries.map(c => {
                const f = this.resolveFileUri(bucket, this.getFilenameFromFile(c));
                const destPath = path.join(dest, f.replace(src, ''));
                promises.push(this.copyFile(bucket, c, destPath, options));
            });
            const result = await Promise.all(promises);

            return this.makeResponse(result);
        } catch (ex) {
            this.parseException(ex);
        }
    }


    public async moveFiles<RType extends string[] | IFile[] = IFile[]>(bucket: IBucket, src: string, dest: string, pattern: Pattern, options?: MoveManyFilesOptions): Promise<StorageResponse<RType, NativeResponseType>> {
        await this.makeReady();
        if (!bucket.canWrite()) {
            throw new StorageException(StorageExceptionType.PERMISSION_ERROR, `Cannot write on bucket ${bucket.name}!`);
        }
        try {
            src = this.resolveFileUri(bucket, src);
            const toMove = await this.listFiles(bucket, src, { pattern, returning: false, recursive: true });
            const promises: Promise<StorageResponse<IFile | string, NativeResponseType>>[] = [];
            toMove.result.entries.map(c => {
                const f = this.resolveFileUri(bucket, this.getFilenameFromFile(c));
                const destPath = path.join(dest, f.replace(src, ''));
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
            return this.makeResponse(result);
        } catch (ex) {
            this.parseException(ex);
        }

    }


    public async deleteFiles(bucket: IBucket, path: string, pattern: Pattern = '**', options?: DeleteManyFilesOptions): Promise<StorageResponse<boolean, NativeResponseType>> {
        await this.makeReady();
        if (!bucket.canWrite()) {
            throw new StorageException(StorageExceptionType.PERMISSION_ERROR, `Cannot write on bucket ${bucket.name}!`);
        }
        try {
            path = this.resolveFileUri(bucket, path);
            const toDelete = await this.listFiles(bucket, path, { pattern, returning: false, recursive: true });
            const promises: Promise<StorageResponse<boolean, NativeResponseType>>[] = [];
            toDelete.result.entries.map(c => {
                promises.push(this.deleteFile(bucket, c, {
                    cleanup: false, // avoid cleanup
                }));
            });
            const result = await Promise.all(promises);
            if (this.shouldCleanupDirectory(bucket, options?.cleanup)) {
                await this.removeEmptyDirectories(bucket, path);
            }

            return this.makeResponse(true);
        } catch (ex) {
            this.parseException(ex);
        }
    }


    public async copyFile<RType extends string | IFile = IFile>(bucket: IBucket, src: string | IFile, dest: string | IFile, options?: CopyFileOptions): Promise<StorageResponse<RType, NativeResponseType>> {
        await this.makeReady();
        const stream = (await this.getFileStream(bucket, src)).result;
        return this.putFile(bucket, dest, stream, options);
    }

    public async moveFile<RType extends string | IFile = IFile>(bucket: IBucket, src: string | IFile, dest: string | IFile, options?: MoveFileOptions): Promise<StorageResponse<RType, NativeResponseType>> {
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
    public abstract deleteFile(bucket: IBucket, path: string | IFile, options?: DeleteFileOptions): Promise<StorageResponse<boolean, NativeResponseType>>;
    public abstract fileExists<RType extends IFile | boolean = any>(bucket: IBucket, path: string | IFile, returning?: boolean): Promise<StorageResponse<RType, NativeResponseType>>;
    public abstract listFiles<RType extends IFile[] | string[] = IFile[]>(bucket: IBucket, path: string, options?: ListFilesOptions): Promise<StorageResponse<ListResult<RType>, NativeResponseType>>;
    public abstract putFile<RType extends IFile | string = any>(bucket: IBucket, fileName: string | IFile, contents: string | Buffer | Streams.Readable, options?: CreateFileOptions): Promise<StorageResponse<RType, NativeResponseType>>;
    public abstract getFileStream(bucket: IBucket, fileName: string | IFile, options?: GetFileOptions): Promise<StorageResponse<Streams.Readable, NativeResponseType>>;
    public abstract removeEmptyDirectories(bucket: IBucket, path: string): Promise<StorageResponse<boolean, NativeResponseType>>;
    protected abstract parseConfig(config: string | ProviderConfigType): ProviderConfigType;
    protected abstract generateFileObject(bucket: IBucket, path: string, options?: any): Promise<IFile>;

    protected resolveFileUri(bucket: IBucket, uri: string | IFile): string {
        uri = this.getFilenameFromFile(uri);
        const parts = this.storage.resolveFileUri(uri);
        if (parts && parts.bucket === bucket && parts.provider === this) {
            return this.normalizePath(parts.path);
        }
        return this.normalizePath(uri);
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

    protected resolveBucketAlias(name: string): string {
        return this.storage.resolveBucketAlias(name, this);
    }

    protected getFilenameFromFile(file: string | IFile = '') {
        if (typeof (file) !== 'string') {
            return file.getAbsolutePath();
        }
        return file;
    }


    protected normalizePath(dir?: string): string {
        if (!dir) {
            return '';
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

    protected shouldCleanupDirectory(bucket: IBucket, cleanup: boolean | undefined): boolean {
        return cleanup === true || (undefined === cleanup && (bucket.config.autoCleanup === true || this.config.autoCleanup === true || this.storage.config.autoCleanup === true));
    }


    protected parseException(ex: Error, type: StorageExceptionType = StorageExceptionType.NATIVE_ERROR) {
        if (ex instanceof StorageException) {
            throw ex;
        }
        throw new StorageException(type, ex.message, ex);
    }

}
