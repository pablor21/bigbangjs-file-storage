import {
    AbstractProvider,
    IStorageProvider,
    FileStorage,
    ProviderConfigOptions,
    BucketConfigOptions,
    StorageExceptionType,
    Streams,
    CopyFileOptions,
    CreateFileOptions,
    DeleteFileOptions,
    GetFileOptions,
    IBucket,
    IStorageFile,
    ListFilesOptions,
    ListResult,
    StorageResponse,
    CopyManyFilesOptions,
    MoveManyFilesOptions,
    Pattern,
    DeleteManyFilesOptions,
    constructError,
    StorageEventType,
    Registry,
    stringNullOrEmpty,
    castValue
} from "@bigbangjs/file-storage";

import { Storage as GSStorage, StorageOptions as GCSStorageOptions } from '@google-cloud/storage';
import { GCSBucket, GCSBucketConfig } from './gcs.bucket';

export type GCSProviderConfig = {
    useNativeUrlGenerator?: boolean;
} & ProviderConfigOptions & GCSStorageOptions;

const defaultConfig: GCSProviderConfig = {
    useNativeUrlGenerator: true,
};


export type GCSNativeResponse = {

}

export class GCSProvider extends AbstractProvider<GCSProviderConfig, GCSBucket, GCSBucketConfig, GCSNativeResponse> implements IStorageProvider<GCSBucket, GCSBucketConfig, GCSNativeResponse>{
    public supportsCrossBucketOperations: boolean;

    public readonly type: string = 'GCS';
    protected client: GSStorage;
    protected _buckets: Registry<string, GCSBucket> = new Registry();

    constructor(storage: FileStorage, name: string, config: string | GCSProviderConfig = defaultConfig) {
        super(storage, name, config);
        this.supportsCrossBucketOperations = true;
        this.validateOptions();
    }

    protected validateOptions() {
        if (stringNullOrEmpty(this.config?.projectId)) {
            throw constructError(`The value for projectId must be specified!`, StorageExceptionType.INVALID_PARAMS);
        }
    }

    protected parseConfig(config: string | GCSProviderConfig): GCSProviderConfig {
        const ret = {};
        if (typeof (config) === 'string') {
            Object.assign(ret, defaultConfig, GCSProvider.parseUriToOptions(config));
        } else {
            Object.assign(ret, defaultConfig, config);
            if (typeof (config.uri) === 'string') {
                Object.assign(ret, GCSProvider.parseUriToOptions(config.uri));
            }
        }
        return ret as GCSProviderConfig;
    }

    /**
     * Parse a uri to options
     * @param uri the uri
     * ```
     * example: gcs://projectId@keyfilename?useNativeUrlGenerator=true&signedUrlExpiration=3000&mode=0777
     * ```
     */
    public static parseUriToOptions(uri: string): GCSProviderConfig {
        const ret: GCSProviderConfig = defaultConfig;
        const parsedUrl = new URL(uri);

        if (parsedUrl.searchParams.has('mode')) {
            ret.mode = parsedUrl.searchParams.get('mode') || '0777';
        }

        if (parsedUrl.searchParams.has('useNativeUrlGenerator') && (!stringNullOrEmpty(parsedUrl.searchParams.get('useNativeUrlGenerator')))) {
            const useNativeUrlGenerator = parsedUrl.searchParams.get('useNativeUrlGenerator');
            ret.useNativeUrlGenerator = castValue<boolean>(useNativeUrlGenerator, 'boolean', true);
        }

        if (parsedUrl.searchParams.has('signedUrlExpiration') && (!stringNullOrEmpty(parsedUrl.searchParams.get('signedUrlExpiration')))) {
            const defaultSignedUrlExpiration = parsedUrl.searchParams.get('signedUrlExpiration');
            ret.defaultSignedUrlExpiration = castValue<number>(defaultSignedUrlExpiration, 'number', undefined);
        }

        if (parsedUrl.pathname) {
            ret.keyFilename = parsedUrl.pathname;
        }

        if (parsedUrl.username) {
            ret.projectId = parsedUrl.username;
        }

        return ret;
    }


    public async init(): Promise<StorageResponse<boolean, GCSNativeResponse>> {
        try {
            this._ready = true;
            this.client = new GSStorage(this.config);
            return this.makeResponse(true);
        } catch (ex) {
            this.parseException(ex);
        }
    }
    public async dispose(): Promise<StorageResponse<boolean, GCSNativeResponse>> {
        this._ready = false;
        return this.makeResponse(true);
    }
    public async addBucket(name: string, config?: GCSBucketConfig): Promise<StorageResponse<GCSBucket, GCSNativeResponse>> {
        await this.makeReady();
        this.emit(StorageEventType.BEFORE_ADD_BUCKET, config);
        const alias = this.resolveBucketAlias(name);
        this.ensureBucketNotRegistered(alias);
        try {
            config = Object.assign({}, {
                mode: '0777',
                bucketName: name,
                tryCreate: true,
                useNativeUrlGenerator: this.config.useNativeUrlGenerator
            }, config || {});


            let response = this.client.bucket(config.bucketName);

            try {
                await response.getMetadata();
            } catch (ex) {
                if (ex.code === 404 && config.tryCreate) {
                    const b = await this.client.createBucket(config.bucketName, {

                    });
                    return this.addBucket(name, config);
                }
                this.parseException(ex);
            }

            const bucket = new GCSBucket(this, name, alias, response, config);
            this._buckets.add(name, bucket);
            this.emit(StorageEventType.BUCKET_ADDED, bucket);
            return this.makeResponse(bucket, response);
        } catch (ex) {
            const message = ex.message || `The bucket ${name} cannot be accessed!`;
            const error = constructError(message, StorageExceptionType.NATIVE_ERROR, ex);
            this.emit(StorageEventType.BUCKET_ADD_ERROR, error);
            throw error;
        }
    }
    public async destroyBucket(b: string | GCSBucket): Promise<StorageResponse<boolean, GCSNativeResponse>> {
        await this.makeReady();
        const name = typeof (b) === 'string' ? b : b.name;
        if (!this._buckets.has(name)) {
            throw constructError(`Bucket ${name} not found in this adapter!`, StorageExceptionType.NOT_FOUND, { name: name });
        }

        try {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const bucket = this._buckets.get(name)!;
            this.emit(StorageEventType.BEFORE_DESTROY_BUCKET, bucket);

            const response = await bucket.gcsBucket.delete();
            this._buckets.remove(name);

            this.emit(StorageEventType.BUCKET_DESTROYED, bucket);
            return this.makeResponse(true, response);
        } catch (ex) {
            const error = constructError(ex.message, StorageExceptionType.NATIVE_ERROR, ex);
            this.emit(StorageEventType.BUCKET_DESTROY_ERROR, error);
            throw error;
        }
    }
    public listUnregisteredBuckets(creationOptions?: BucketConfigOptions): Promise<StorageResponse<GCSBucketConfig[], GCSNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    public deleteFile(bucket: GCSBucket, path: string | IStorageFile, options?: DeleteFileOptions): Promise<StorageResponse<boolean, GCSNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    public deleteFiles(bucket: GCSBucket, path: string, pattern: Pattern, options?: DeleteManyFilesOptions): Promise<StorageResponse<boolean, GCSNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    public fileExists<RType extends boolean | IStorageFile = any>(bucket: GCSBucket, path: string | IStorageFile, returning?: boolean): Promise<StorageResponse<RType, GCSNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    public listFiles<RType extends IStorageFile[] | string[] = IStorageFile[]>(bucket: GCSBucket, path: string, options?: ListFilesOptions): Promise<StorageResponse<ListResult<RType>, GCSNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    public putFile<RType extends string | IStorageFile = any>(bucket: GCSBucket, fileName: string | IStorageFile, contents: string | Buffer | Streams.Readable, options?: CreateFileOptions): Promise<StorageResponse<RType, GCSNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    public getFileStream(bucket: GCSBucket, fileName: string | IStorageFile, options?: GetFileOptions): Promise<StorageResponse<Streams.Readable, GCSNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    public getFileContents(bucket: GCSBucket, fileName: string | IStorageFile, options?: GetFileOptions): Promise<StorageResponse<Buffer, GCSNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    public copyFile<RType extends string | IStorageFile = IStorageFile>(bucket: GCSBucket, src: string | IStorageFile, dest: string | IStorageFile, options?: CopyFileOptions): Promise<StorageResponse<RType, GCSNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    public moveFile<RType extends string | IStorageFile = IStorageFile>(bucket: GCSBucket, src: string | IStorageFile, dest: string | IStorageFile, options?: CopyFileOptions): Promise<StorageResponse<RType, GCSNativeResponse>> {
        this.client.bucket('test');
        throw new Error('Method not implemented.');
    }
    protected generateFileObject(bucket: GCSBucket, path: string, options?: any): Promise<IStorageFile> {
        throw new Error('Method not implemented.');
    }
    public copyFiles<RType extends string[] | IStorageFile[] = IStorageFile[]>(bucket: GCSBucket, src: string, dest: string, pattern: Pattern, options?: CopyManyFilesOptions): Promise<StorageResponse<RType, GCSNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    public moveFiles<RType extends string[] | IStorageFile[] = IStorageFile[]>(bucket: GCSBucket, src: string, dest: string, pattern: Pattern, options?: MoveManyFilesOptions): Promise<StorageResponse<RType, GCSNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    public removeEmptyDirectories(bucket: GCSBucket, path: string): Promise<StorageResponse<boolean, GCSNativeResponse>> {
        throw new Error('Method not implemented.');
    }

}