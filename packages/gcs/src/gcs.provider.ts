import {
    AbstractProvider,
    IStorageProvider,
    FileStorage,
    BucketConfigOptions,
    StorageExceptionType,
    Streams,
    CopyFileOptions,
    CreateFileOptions,
    DeleteFileOptions,
    GetFileOptions,
    IStorageFile,
    ListFilesOptions,
    ListResult,
    StorageResponse,
    constructError,
    StorageEventType,
    Registry,
    stringNullOrEmpty,
    castValue,
    joinPath,
    writeToStream,
    convertToReadStream,
    IFileMeta,
    StorageFile,
    SignedUrlOptions,
    objectNull,
    throwError
} from "@bigbangjs/file-storage";
import path from 'path';
import fs from 'fs';
import { Storage as GSStorage, Bucket as GCSNativeBucket, GetFilesOptions as GCSNativeGetFilesOptions } from '@google-cloud/storage';
import { GCSBucket } from './gcs.bucket';
import { GCSBucketConfig, GCSNativeResponse, GCSProviderConfig } from "./types";

const defaultConfig: GCSProviderConfig = {
    useNativeUrlGenerator: true,
    tryCreateBuckets: true,
};



export class GCSProvider extends AbstractProvider<GCSProviderConfig, GCSBucketConfig, GCSNativeResponse, GCSBucket> implements IStorageProvider<GCSBucketConfig, GCSNativeResponse, GCSBucket>{
    public supportsCrossBucketOperations: boolean;
    public readonly type: string = 'GCS';
    protected _client: GSStorage;
    protected _buckets: Registry<string, GCSBucket> = new Registry();
    protected _keyFileContents: any;

    constructor(storage: FileStorage, config: string | GCSProviderConfig = defaultConfig) {
        super(storage, config);
        this.supportsCrossBucketOperations = true;
        this.validateConfig();
    }

    public get client(): GSStorage {
        return this._client;
    }

    protected validateConfig() {
        super.validateConfig();
        if (stringNullOrEmpty(this.config?.projectId)) {
            throw constructError(`The value for projectId must be specified!`, StorageExceptionType.INVALID_PARAMS);
        }
    }

    protected parseConfig(config: string | GCSProviderConfig): GCSProviderConfig {
        const ret: GCSProviderConfig = {};
        if (typeof (config) === 'string') {
            Object.assign(ret, defaultConfig, this.parseUriToOptions(config));
        } else {
            if (typeof (config.uri) === 'string') {
                Object.assign(ret, this.parseUriToOptions(config.uri));
            }
            Object.assign(ret, defaultConfig, config);
        }

        if (ret.keyFilename) {
            const keyFilePath = path.resolve(ret.keyFilename);
            this._keyFileContents = JSON.parse(fs.readFileSync(keyFilePath).toString());
            ret.projectId = this._keyFileContents.project_id;
            if (!ret.buckets) {
                ret.buckets = this._keyFileContents.buckets;
            }
        }

        return ret as GCSProviderConfig;
    }

    /**
     * Parse a uri to options
     * @param uri the uri
     * ```
     * example: gcs://keyfilename?useNativeUrlGenerator=true&signedUrlExpiration=3000&mode=0777
     * ```
     */
    public parseUriToOptions(uri: string): GCSProviderConfig {
        const ret: GCSProviderConfig = defaultConfig;
        const parsedUrl = new URL(uri);

        if (parsedUrl.searchParams.has('mode')) {
            ret.mode = parsedUrl.searchParams.get('mode') || '0777';
        }

        if (parsedUrl.searchParams.has('useNativeUrlGenerator') && (!stringNullOrEmpty(parsedUrl.searchParams.get('useNativeUrlGenerator')))) {
            const useNativeUrlGenerator = parsedUrl.searchParams.get('useNativeUrlGenerator');
            ret.useNativeUrlGenerator = castValue<boolean>(useNativeUrlGenerator, 'boolean', true);
        }

        if (parsedUrl.searchParams.has('tryCreateBuckets')) {
            ret.useNativeUrlGenerator = castValue<boolean>(parsedUrl.searchParams.get('tryCreateBuckets'), 'boolean', defaultConfig.tryCreateBuckets);
        }

        if (parsedUrl.searchParams.has('signedUrlExpiration') && (!stringNullOrEmpty(parsedUrl.searchParams.get('signedUrlExpiration')))) {
            const defaultSignedUrlExpiration = parsedUrl.searchParams.get('signedUrlExpiration');
            ret.defaultSignedUrlExpiration = castValue<number>(defaultSignedUrlExpiration, 'number', undefined);
        }

        if (parsedUrl.pathname || parsedUrl.hostname) {
            ret.keyFilename = joinPath(parsedUrl.hostname, parsedUrl.pathname);
        }


        // google storage options
        if (parsedUrl.searchParams.has('autoRetry')) {
            ret.autoRetry = castValue<boolean>(parsedUrl.searchParams.get('autoRetry'), 'boolean');
        }

        if (parsedUrl.searchParams.has('maxRetries')) {
            ret.maxRetries = castValue<number>(parsedUrl.searchParams.get('maxRetries'), 'number');
        }

        if (parsedUrl.searchParams.has('userAgent')) {
            ret.userAgent = parsedUrl.searchParams.get('userAgent');
        }

        if (parsedUrl.searchParams.has('apiEndpoint')) {
            ret.apiEndpoint = parsedUrl.searchParams.get('apiEndpoint');
        }

        if (parsedUrl.searchParams.has('projectId')) {
            ret.projectId = parsedUrl.searchParams.get('projectId');
        }

        return ret;
    }


    public async init(): Promise<StorageResponse<boolean, GCSNativeResponse>> {
        try {
            this._client = new GSStorage(this.config);

            if (this.config.buckets && Array.isArray(this.config.buckets)) {
                const addBucketsPromises = this.config.buckets.map(async b => {
                    await this.addBucket(b as GCSBucketConfig);
                });
                await Promise.all(addBucketsPromises);
            }
            this._ready = true;
            return this.makeResponse(true);
        } catch (ex) {
            this.parseException(ex);
        }
    }
    public async dispose(): Promise<StorageResponse<boolean, GCSNativeResponse>> {
        this._ready = false;
        return this.makeResponse(true);
    }
    public async addBucket(bucket: GCSBucket | GCSBucketConfig | string, tryCreate = true): Promise<StorageResponse<GCSBucket, GCSNativeResponse>> {

        if (!this._client) {
            throwError(`You must initialize the provider before add buckets [${this.name}]`, StorageExceptionType.NATIVE_ERROR);
        }

        if (objectNull(bucket)) {
            throwError(`Invalid bucket config!`, StorageExceptionType.INVALID_PARAMS);
        }

        let name;
        if (typeof (bucket) === 'string') {
            const url = new URL(bucket);
            name = url.searchParams.get("name");
            tryCreate = castValue<boolean>(url.searchParams.get("name"), 'boolean', tryCreate);
        } else {
            name = bucket.name;
        }

        const alias = this.resolveBucketAlias(name);
        this.ensureBucketNotRegistered(alias);
        let bucketInstance: GCSBucket = null;

        try {
            this.emit(StorageEventType.BEFORE_ADD_BUCKET, bucket);
            if (bucket instanceof GCSBucket) {
                bucketInstance = bucket;
            } else {
                bucketInstance = new GCSBucket(this, alias, bucket);
            }

            try {
                await bucketInstance.gcsBucket.getMetadata();
                this._buckets.add(bucketInstance.name, bucketInstance);
                this.emit(StorageEventType.BUCKET_ADDED, bucketInstance);
            } catch (ex) {
                if (ex.code === 404 && bucketInstance.config.tryCreate && tryCreate) {
                    await this.client.createBucket(bucketInstance.bucketName);
                    return this.addBucket(bucketInstance, false);
                }
                this.parseException(ex);
            }
            return this.makeResponse(bucketInstance);
        } catch (ex) {
            const error = constructError(ex.message, StorageExceptionType.NATIVE_ERROR, ex);
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

    public async listUnregisteredBuckets(creationOptions?: BucketConfigOptions): Promise<StorageResponse<GCSBucketConfig[], GCSNativeResponse>> {
        await this.makeReady();
        try {
            const options = Object.assign({}, {
                mode: '0777',
                useNativeUrlGenerator: this.config.useNativeUrlGenerator
            }, creationOptions);
            const ret: GCSBucketConfig[] = [];
            const registerdBuckets = (await this.listBuckets()).result;
            const allBuckets = await this.client.getBuckets();
            const cantidates = allBuckets[0].filter((b: GCSNativeBucket) => !registerdBuckets.find(f => {
                return f.gcsBucket.name === b.name
            }));
            cantidates.map(c => {
                ret.push({
                    name: c.name,
                    mode: options.mode,
                    bucketName: c.name,
                    useNativeUrlGenerator: options.useNativeUrlGenerator
                })
            });

            return this.makeResponse(ret);
        } catch (ex) {
            this.parseException(ex);
        }
    }

    public async deleteFile(bucket: GCSBucket, path: string | IStorageFile, options?: DeleteFileOptions): Promise<StorageResponse<boolean, GCSNativeResponse>> {
        await this.makeReady();
        this.checkWritePermission(bucket);

        try {
            path = this.resolveBucketPath(bucket, path);
            this.isFileOrTrow(path, 'path');
            const result = await bucket.gcsBucket.file(path).delete();
            return this.makeResponse(true, result)
        } catch (ex) {
            if (ex.code === 404) {
                return this.makeResponse(true, {});
            }
            this.parseException(ex);
        }
    }
    public async fileExists<RType extends boolean | IStorageFile = any>(bucket: GCSBucket, path: string | IStorageFile, returning?: boolean): Promise<StorageResponse<RType, GCSNativeResponse>> {
        await this.makeReady();
        this.checkReadPermission(bucket);
        try {
            path = this.resolveBucketPath(bucket, path);
            const info = await this.generateFileObject(bucket, path);
            if (info) {
                if (returning) {
                    return this.makeResponse(info);
                }
                return this.makeResponse(true);
            } else {
                return this.makeResponse(false);
            }
        } catch (ex) {
            if (ex.code === 404) {
                return this.makeResponse(false);
            }
            this.parseException(ex);
        }
    }
    public async listFiles<RType extends IStorageFile[] | string[] = IStorageFile[]>(bucket: GCSBucket, path: string, options?: ListFilesOptions): Promise<StorageResponse<ListResult<RType>, GCSNativeResponse>> {
        await this.makeReady();
        this.checkReadPermission(bucket);
        const ret: any[] = [];
        try {
            path = this.resolveBucketPath(bucket, path);
            if (path.indexOf('/') === 0) {
                path = path.substring(1);
            }
            const params: GCSNativeGetFilesOptions = {
                prefix: !stringNullOrEmpty(path) ? path : undefined,
                maxResults: options?.maxResults,
                autoPaginate: false,
                delimiter: (!options?.recursive) ? '/' : undefined,
            }
            let response;
            do {
                response = (await bucket.gcsBucket.getFiles(params));
                let result = response[0];
                // filter by pattern
                if (options?.pattern) {
                    const pattern = options.pattern;
                    if (options.pattern) {
                        result = result.filter(f => {
                            const matches = this.fileNameMatches(f.name, options.pattern);
                            return matches;
                        });
                    } else {
                        this.log('warn', `Invalid glob pattern ${pattern}`);
                    }
                }
                // filter by function
                if (options?.filter && typeof (options?.filter) === 'function') {
                    result = await Promise.all(result.filter(async f => await options.filter(f.name, path)))
                }

                await Promise.all(result.map(async c => {
                    if (this.shouldReturnObject(options?.returning)) {
                        ret.push(this.generateFileObject(bucket, c.name, await this.makeFileMetaFromResponse(bucket, c.name, c)));
                    } else {
                        ret.push(this.getStorageUri(bucket, c.name));
                    }
                }));
                //there are more results
                if (response[1]) {
                    Object.assign(params, response[1]);
                }
            } while (response[1]);
            const promiseResult = await Promise.all(ret);
            return this.makeResponse({
                entries: promiseResult
            }, response);
        } catch (ex) {
            this.parseException(ex);
        }
    }

    public async putFile<RType extends string | IStorageFile = any>(bucket: GCSBucket, fileName: string | IStorageFile, contents: string | Buffer | Streams.Readable, options?: CreateFileOptions): Promise<StorageResponse<RType, GCSNativeResponse>> {
        await this.makeReady();
        this.checkWritePermission(bucket);

        fileName = this.makeSlug(fileName);
        const absFilename = this.resolveBucketPath(bucket, fileName, false);
        this.isFileOrTrow(absFilename, 'fileName');

        if (options?.overwrite === false) {
            const exists = (await this.fileExists(bucket, fileName, false)).result;
            if (exists) {
                const fName = this.getFilenameFromFile(fileName);
                throw constructError(`The file ${fName} already exists!`, StorageExceptionType.DUPLICATED_ELEMENT);
            }
        }

        try {
            const file = bucket.gcsBucket.file(fileName);
            const writeStream = file.createWriteStream();
            const readStream = convertToReadStream(contents);
            await writeToStream(readStream, writeStream);
            let ret: any = this.storage.makeFileUri(this, bucket, fileName);
            if (this.shouldReturnObject(options?.returning)) {
                ret = await this.generateFileObject(bucket, fileName);
            }
            return this.makeResponse(ret, {});
        } catch (ex) {
            this.parseException(ex);
        }
    }
    public async getFileStream(bucket: GCSBucket, fileName: string | IStorageFile, options?: GetFileOptions): Promise<StorageResponse<Streams.Readable, GCSNativeResponse>> {
        await this.makeReady();
        this.checkReadPermission(bucket);
        fileName = this.resolveBucketPath(bucket, fileName);
        const file = bucket.gcsBucket.file(fileName);
        const stream = file.createReadStream({
            start: options?.start,
            end: options?.end
        });
        return this.makeResponse(stream);
    }

    public async copyFile<RType extends string | IStorageFile = IStorageFile>(bucket: GCSBucket, src: string | IStorageFile, dest: string | IStorageFile, options?: CopyFileOptions): Promise<StorageResponse<RType, GCSNativeResponse>> {
        await this.makeReady();
        this.checkWritePermission(bucket);
        try {
            // parse paths
            src = this.resolveBucketPath(bucket, src, false);
            this.isFileOrTrow(src, 'src');

            // resolved uri
            const isDirectory = this.isDirectory(this.getFilenameFromFile(dest));
            const destResolvedUri = this.resolveFileUri(bucket, dest, true);
            this.checkWritePermission(destResolvedUri.bucket as GCSBucket);
            dest = this.makeSlug(this.getFilenameFromFile(destResolvedUri.path));
            // if the dest is a directory, join the file to the dest
            if (isDirectory) {
                dest = joinPath(dest, this.extractFilenameFromPath(src));
                this.isFileOrTrow(dest, 'dest');
            }

            const destUrl = destResolvedUri.bucket.getNativePath(dest);
            const result = await bucket.gcsBucket.file(src).copy(destUrl)

            if (this.shouldReturnObject(options?.returning)) {
                return this.makeResponse(await this.generateFileObject(destResolvedUri.bucket as GCSBucket, dest), result);
            }
            return this.makeResponse(this.getStorageUri(destResolvedUri.bucket as GCSBucket, dest), result);


        } catch (ex) {
            this.parseException(ex);
        }
    }

    public async moveFile<RType extends string | IStorageFile = IStorageFile>(bucket: GCSBucket, src: string | IStorageFile, dest: string | IStorageFile, options?: CopyFileOptions): Promise<StorageResponse<RType, GCSNativeResponse>> {
        await this.makeReady();
        this.checkWritePermission(bucket);
        try {
            // parse paths
            src = this.resolveBucketPath(bucket, src, false);
            this.isFileOrTrow(src, 'src');

            // resolved uri
            const isDirectory = this.isDirectory(this.getFilenameFromFile(dest));
            const destResolvedUri = this.resolveFileUri(bucket, dest, true);
            this.checkWritePermission(destResolvedUri.bucket as GCSBucket);
            dest = this.makeSlug(this.getFilenameFromFile(destResolvedUri.path));
            // if the dest is a directory, join the file to the dest
            if (isDirectory) {
                dest = joinPath(dest, this.extractFilenameFromPath(src));
                this.isFileOrTrow(dest, 'dest');
            }

            const destUrl = destResolvedUri.bucket.getNativePath(dest);
            const result = await bucket.gcsBucket.file(src).move(destUrl)

            if (this.shouldReturnObject(options?.returning)) {
                return this.makeResponse(await this.generateFileObject(destResolvedUri.bucket as GCSBucket, dest), result);
            }
            return this.makeResponse(this.getStorageUri(destResolvedUri.bucket as GCSBucket, dest), result);


        } catch (ex) {
            this.parseException(ex);
        }
    }

    public async emptyBucket(bucket: GCSBucket): Promise<StorageResponse<boolean, GCSNativeResponse>> {
        try {
            await bucket.gcsBucket.deleteFiles();
            return this.makeResponse(true);
        } catch (ex) {
            this.parseException(ex);
        }
    }

    public async removeEmptyDirectories(bucket: GCSBucket, path: string): Promise<StorageResponse<boolean, GCSNativeResponse>> {
        return this.makeResponse(true, {});
    }

    public async getPublicUrl(bucket: GCSBucket, fileName: string | IStorageFile, options?: any): Promise<string> {
        if (this.shouldUseNativeUrlGenerator(bucket)) {
            return bucket.gcsBucket.file(this.getFilenameFromFile(fileName)).publicUrl();
        } else {
            return super.getPublicUrl(bucket, fileName, options);
        }
    }

    public async getSignedUrl(bucket: GCSBucket, fileName: string | IStorageFile, options?: SignedUrlOptions): Promise<string> {
        options = options || {};
        let url: string;
        options.expiration = options.expiration || bucket.config.defaultSignedUrlExpiration || this.config.defaultSignedUrlExpiration || this.storage.config.defaultSignedUrlExpiration;
        if (this.shouldUseNativeUrlGenerator(bucket)) {
            const config: any = {
                version: 'v4',
                action: "read",
                expires: Date.now() + options.expiration * 1000,
            };
            url = (await bucket.gcsBucket.file(this.getFilenameFromFile(fileName)).getSignedUrl(config))[0];
        } else {
            url = await super.getSignedUrl(bucket, fileName, options);
        }
        return url;
    }

    public getNativePath(bucket: GCSBucket, fileName: string | IStorageFile): string {
        const path = this.resolveFileUri(bucket, fileName);
        const file = bucket.gcsBucket.file(this.getFilenameFromFile(path.path));
        return `gs://${bucket.gcsBucket.name}/${file.name}`;
    }


    protected async makeFileMetaFromResponse(bucket: GCSBucket, path: string, data: any): Promise<IFileMeta> {
        const parts = path.split('/');
        const mime = await this.getMime(path);
        return {
            path: parts.slice(0, parts.length - 1).join('/'),
            name: parts.slice().reverse()[0],
            nativeAbsolutePath: this.getNativePath(bucket, path),
            nativeMeta: data,
            type: 'FILE',
            updatedAt: data.updated,
            createdAt: data.timeCreated,
            size: Number(data.size || 0),
            uri: this.getStorageUri(bucket, path),
            mime: mime,
            exists: true
        } as IFileMeta;

    }

    protected async generateFileMeta(path: string, bucket: GCSBucket): Promise<IFileMeta | undefined> {
        await this.makeReady();
        try {
            const info = await bucket.gcsBucket.file(path).getMetadata();
            if (!info || !info[0]) {
                return;
            }
            return await this.makeFileMetaFromResponse(bucket, path, info[0]);
        } catch (ex) {
            this.parseException(ex);
        }
    }

    protected async generateFileObject(bucket: GCSBucket, path: string | IStorageFile, meta?: IFileMeta): Promise<IStorageFile> {
        await this.makeReady();
        try {
            let ret;
            meta = meta || await this.generateFileMeta(this.resolveBucketPath(bucket, path), bucket);
            if (!meta) {
                return;
            }
            ret = new StorageFile(bucket, meta);
            ret.uri = this.storage.makeFileUri(this, bucket, path);
            if (typeof (path) === 'string') {
                return ret;
            } else {
                ret = path;
                path.bucket = bucket;
                path.meta = meta;
                return ret;
            }

        } catch (ex) {
            this.parseException(ex);
        }
    }

    protected shouldUseNativeUrlGenerator(bucket: GCSBucket): boolean {
        return bucket.config.useNativeUrlGenerator === true || (bucket.config.useNativeUrlGenerator === undefined && this.config.useNativeUrlGenerator === true);
    }


}