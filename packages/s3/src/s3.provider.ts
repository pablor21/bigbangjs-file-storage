import path from 'path';
import fs from 'fs';
import S3Client from "aws-sdk/clients/s3";
import {
    AbstractProvider,
    IStorageProvider,
    FileStorage,
    BucketConfigOptions,
    StorageExceptionType,
    stringNullOrEmpty,
    Streams,
    CreateFileOptions,
    DeleteFileOptions,
    GetFileOptions,
    IStorageFile,
    ListFilesOptions,
    ListResult,
    StorageResponse,
    StorageEventType,
    IFileMeta,
    StorageFile,
    Pattern,
    DeleteManyFilesOptions,
    SignedUrlOptions,
    castValue,
    CopyFileOptions,
    constructError,
    joinPath,
    ResolveUriReturn,
    Registry,
    convertToReadStream,
    throwError,
    objectNull,
} from "@bigbangjs/file-storage";
import { S3BucketConfig, S3NativeResponse, S3ProviderConfig } from './types';
import { IncomingMessage } from 'http';
import { S3Bucket } from './s3.bucket';

const defaultConfig: S3ProviderConfig = {
    region: 'us-east-2',
    useDualstack: true,
    sslEnabled: true,
    useNativeUrlGenerator: true,

};

export class S3Provider extends AbstractProvider<S3ProviderConfig, S3BucketConfig, S3NativeResponse, S3Bucket> implements IStorageProvider<S3BucketConfig, S3NativeResponse, S3Bucket>{

    public readonly supportsCrossBucketOperations: boolean;
    public readonly type: string = 'S3';
    protected _client: S3Client;
    protected _buckets: Registry<string, S3Bucket> = new Registry();
    protected _keyFileContents: any;

    constructor(storage: FileStorage, config: string | S3ProviderConfig = defaultConfig) {
        super(storage, config);
        this.supportsCrossBucketOperations = true;
    }

    public get client(): S3Client {
        return this._client;
    }

    protected validateConfig() {
        super.validateConfig();
        if (stringNullOrEmpty(this.config.region) || objectNull(this.config.credentials) || stringNullOrEmpty(this.config.credentials.accessKeyId) || stringNullOrEmpty(this.config.credentials.secretAccessKey)) {
            throw constructError(`The values for region, accessKeyId and secretAccessKey path must be provided [${this.name}]!`, StorageExceptionType.INVALID_PARAMS);
        }
    }



    protected parseConfig(config: string | S3ProviderConfig): S3ProviderConfig {
        const ret: S3ProviderConfig = {};
        if (typeof (config) === 'string') {
            Object.assign(ret, defaultConfig, S3Provider.parseUriToOptions(config));
        } else {
            Object.assign(ret, defaultConfig, config);
            if (typeof (config.uri) === 'string') {
                Object.assign(ret, S3Provider.parseUriToOptions(config.uri));
            }
        }

        if (ret.keyFile) {
            const keyFilePath = path.resolve(ret.keyFile);
            this._keyFileContents = JSON.parse(fs.readFileSync(keyFilePath).toString());
            ret.credentials = {
                accessKeyId: this._keyFileContents.accessKeyId,
                secretAccessKey: this._keyFileContents.secretAccessKey
            }

            if (!ret.buckets) {
                ret.buckets = this._keyFileContents.buckets;
            }
        }

        return ret as S3ProviderConfig;
    }


    /**
     * Parse a uri to options
     * @param uri the uri
     * ```
     * example: s3://accessKeyId:secretAccessKey@keyFile?region=region&ssl=true&dualStack=true&useNativeUrlGenerator=true&signedUrlExpiration=3000&mode=0777
     * ```
     */
    public static parseUriToOptions(uri: string): S3ProviderConfig {
        const ret: S3ProviderConfig = defaultConfig;
        const parsedUrl = new URL(uri);

        ret.credentials = ret.credentials || {
            accessKeyId: null,
            secretAccessKey: null,
        };

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
            ret.keyFile = joinPath(parsedUrl.hostname, parsedUrl.pathname);
        }

        if (parsedUrl.username) {
            ret.credentials.accessKeyId = parsedUrl.username;
        }

        if (parsedUrl.password) {
            ret.credentials.secretAccessKey = parsedUrl.password;
        }

        // S3 config
        if (parsedUrl.searchParams.has('region')) {
            ret.region = parsedUrl.searchParams.get('region');
        }
        if (parsedUrl.searchParams.has('apiVersion')) {
            ret.apiVersion = parsedUrl.searchParams.get('apiVersion');
        }
        if (parsedUrl.searchParams.has('computeChecksums')) {
            ret.computeChecksums = castValue<boolean>(parsedUrl.searchParams.get('computeChecksums'), 'boolean', undefined);
        }
        if (parsedUrl.searchParams.has('convertResponseTypes')) {
            ret.convertResponseTypes = castValue<boolean>(parsedUrl.searchParams.get('convertResponseTypes'), 'boolean', undefined);
        }
        if (parsedUrl.searchParams.has('correctClockSkew')) {
            ret.correctClockSkew = castValue<boolean>(parsedUrl.searchParams.get('correctClockSkew'), 'boolean', undefined);
        }
        if (parsedUrl.searchParams.has('customUserAgent')) {
            ret.customUserAgent = parsedUrl.searchParams.get('customUserAgent');
        }
        if (parsedUrl.searchParams.has('sslEnabled')) {
            ret.sslEnabled = castValue<boolean>(parsedUrl.searchParams.get('sslEnabled'), 'boolean', true);
        }
        if (parsedUrl.searchParams.has('useDualstack')) {
            ret.useDualstack = castValue<boolean>(parsedUrl.searchParams.get('useDualstack'), 'boolean', true);
        }
        if (parsedUrl.searchParams.has('defaultBucket')) {
            ret.defaultBucket = parsedUrl.searchParams.get('defaultBucket');
        }
        if (parsedUrl.searchParams.has('dynamoDbCrc32')) {
            ret.dynamoDbCrc32 = castValue<boolean>(parsedUrl.searchParams.get('dynamoDbCrc32'), 'boolean', undefined);
        }
        if (parsedUrl.searchParams.has('endpoint')) {
            ret.endpoint = parsedUrl.searchParams.get('endpoing');
        }
        if (parsedUrl.searchParams.has('endpointCacheSize')) {
            ret.endpointCacheSize = castValue<number>(parsedUrl.searchParams.get('endpointCacheSize'), 'number', undefined);
        }
        if (parsedUrl.searchParams.has('endpointDiscoveryEnabled')) {
            ret.endpointDiscoveryEnabled = castValue<boolean>(parsedUrl.searchParams.get('endpointDiscoveryEnabled'), 'boolean', undefined);
        }
        if (parsedUrl.searchParams.has('hostPrefixEnabled')) {
            ret.hostPrefixEnabled = castValue<boolean>(parsedUrl.searchParams.get('hostPrefixEnabled'), 'boolean', undefined);
        }
        if (parsedUrl.searchParams.has('maxRedirects')) {
            ret.maxRedirects = castValue<number>(parsedUrl.searchParams.get('maxRedirects'), 'number', undefined);
        }
        if (parsedUrl.searchParams.has('maxRetries')) {
            ret.maxRetries = castValue<number>(parsedUrl.searchParams.get('maxRetries'), 'number', undefined);
        }
        if (parsedUrl.searchParams.has('stsRegionalEndpoints')) {
            ret.stsRegionalEndpoints = parsedUrl.searchParams.get('stsRegionalEndpoints') as "legacy" | "regional";
        }
        if (parsedUrl.searchParams.has('useAccelerateEndpoint')) {
            ret.useAccelerateEndpoint = castValue<boolean>(parsedUrl.searchParams.get('useAccelerateEndpoint'), 'boolean', undefined);
        }
        if (parsedUrl.searchParams.has('s3UseArnRegion')) {
            ret.s3UseArnRegion = castValue<boolean>(parsedUrl.searchParams.get('s3UseArnRegion'), 'boolean', undefined);
        }
        return ret;
    }


    public async init(): Promise<StorageResponse<boolean, S3NativeResponse>> {
        try {
            this._client = new S3Client(this.config);
            if (this.config.buckets && Array.isArray(this.config.buckets)) {
                const addBucketsPromises = this.config.buckets.map(async b => {
                    await this.addBucket(b as S3BucketConfig);
                });
                await Promise.all(addBucketsPromises);
            }
            this._ready = true;
            return this.makeResponse(true);
        } catch (ex) {
            this.parseException(ex);
        }
    }
    public async dispose(): Promise<StorageResponse<boolean, S3NativeResponse>> {
        try {
            this._ready = false;
            this._client = undefined;
            return this.makeResponse(true);
        } catch (ex) {
            this.parseException(ex);
        }
    }
    public async addBucket(bucket?: S3BucketConfig | S3Bucket | string, tryCreate = true): Promise<StorageResponse<S3Bucket, S3NativeResponse>> {
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
        let bucketInstance: S3Bucket = null;

        try {
            this.emit(StorageEventType.BEFORE_ADD_BUCKET, bucket);
            if (bucket instanceof S3Bucket) {
                bucketInstance = bucket;
            } else {
                bucketInstance = new S3Bucket(this, alias, bucket);
            }
            let response = null;
            try {
                response = await this.client.headBucket({ Bucket: bucketInstance.bucketName }).promise();
                this._buckets.add(bucketInstance.name, bucketInstance);
                this.emit(StorageEventType.BUCKET_ADDED, bucketInstance);
                return this.makeResponse(bucketInstance, response);
            } catch (ex) {
                if (ex.code === 'NotFound' && bucketInstance.config.tryCreate && tryCreate) {
                    await this.client.createBucket({ Bucket: bucketInstance.bucketName }).promise();
                    return this.addBucket(bucketInstance, false);
                } else {
                    throw ex;
                }
            }

        } catch (ex) {
            const error = constructError(ex.message, StorageExceptionType.NATIVE_ERROR, ex);
            this.emit(StorageEventType.BUCKET_ADD_ERROR, error);
            throw error;
        }
    }
    public async destroyBucket(b: string | S3Bucket): Promise<StorageResponse<boolean, S3NativeResponse>> {
        await this.makeReady();
        const name = typeof (b) === 'string' ? b : b.name;
        if (!this._buckets.has(name)) {
            throw constructError(`Bucket ${name} not found in this adapter!`, StorageExceptionType.NOT_FOUND, { name: name });
        }

        try {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const bucket = this._buckets.get(name)!;
            this.emit(StorageEventType.BEFORE_DESTROY_BUCKET, bucket);
            //delete all files
            let response = {};
            try {
                response = await this.client.deleteBucket({ Bucket: bucket.bucketName, }).promise();
                this._buckets.remove(name);
            } catch (ex) {
                // if the service  response indicates that the bucket does not exist, continue
                if (ex.code !== 'NoSuchBucket' && ex.code !== 'NotFound') {
                    throw ex;
                }
            }

            this.emit(StorageEventType.BUCKET_DESTROYED, bucket);
            return this.makeResponse(true, response);
        } catch (ex) {
            const error = constructError(ex.message, StorageExceptionType.NATIVE_ERROR, ex);
            this.emit(StorageEventType.BUCKET_DESTROY_ERROR, error);
            throw error;
        }

    }
    public async listUnregisteredBuckets(creationOptions?: BucketConfigOptions): Promise<StorageResponse<S3BucketConfig[], S3NativeResponse>> {
        await this.makeReady();
        try {
            const options = Object.assign({}, {
                mode: '0777'
            }, creationOptions);
            const ret: S3BucketConfig[] = [];
            const registerdBuckets = (await this.listBuckets()).result;
            const allBuckets = await this.client.listBuckets().promise();
            const cantidates = allBuckets.Buckets.filter(b => !registerdBuckets.find(f => f.bucketName === b.Name));
            cantidates.map(c => {
                ret.push({
                    name: c.Name,
                    mode: options.mode,
                    bucketName: c.Name,
                    useNativeUrlGenerator: this.config.useNativeUrlGenerator
                })
            });

            return this.makeResponse(ret);
        } catch (ex) {
            this.parseException(ex);
        }
    }

    public async getPublicUrl(bucket: S3Bucket, fileName: string | IStorageFile, options?: any): Promise<string> {
        if (this.shouldUseNativeUrlGenerator(bucket)) {
            return `https://${bucket.bucketName}.s3.amazonaws.com/${this.resolveBucketPath(bucket, fileName)}`;
        } else {
            return super.getPublicUrl(bucket, fileName, options);
        }
    }

    public async getSignedUrl(bucket: S3Bucket, fileName: string | IStorageFile, options?: SignedUrlOptions): Promise<string> {
        options = options || {};
        let url: string;
        options.expiration = options.expiration || bucket.config.defaultSignedUrlExpiration || this.config.defaultSignedUrlExpiration || this.storage.config.defaultSignedUrlExpiration;
        if (this.shouldUseNativeUrlGenerator(bucket)) {
            url = this.client.getSignedUrl('getObject', {
                Bucket: bucket.bucketName,
                Key: this.resolveBucketPath(bucket, fileName),
                Expires: options.expiration
            });

        } else {
            url = await super.getSignedUrl(bucket, fileName, options);
        }
        return url;
    }


    public async deleteFile(bucket: S3Bucket, path: string | IStorageFile, options?: DeleteFileOptions): Promise<StorageResponse<boolean, S3NativeResponse>> {
        await this.makeReady();
        this.checkWritePermission(bucket);
        try {
            path = this.resolveBucketPath(bucket, path);
            this.isFileOrTrow(path, 'path');
            const result = await this.client.deleteObject({
                Bucket: bucket.bucketName,
                Key: path
            }).promise();
            return this.makeResponse(true, result)
        } catch (ex) {
            if (ex.code === 'NotFound') {
                return this.makeResponse(true, ex);
            }
            this.parseException(ex);
        }

    }

    public async deleteFiles(bucket: S3Bucket, path: string, pattern: Pattern = '**', options?: DeleteManyFilesOptions): Promise<StorageResponse<boolean, S3NativeResponse>> {
        await this.makeReady();
        this.checkWritePermission(bucket);
        try {
            path = this.resolveBucketPath(bucket, path);
            const toDelete = await this.listFiles(bucket, path, { pattern, returning: false, recursive: true });
            if (toDelete.result.entries.length === 0) {
                return this.makeResponse(true);
            }
            const params: S3Client.DeleteObjectsRequest = {
                Bucket: bucket.bucketName,
                Delete: {
                    Objects: [

                    ]
                },
            };

            toDelete.result.entries.map(r => {
                params.Delete.Objects.push({
                    Key: this.resolveFileUri(bucket, r).path
                })
            });

            const response = await this.client.deleteObjects(params).promise();
            return this.makeResponse(true, response);
        } catch (ex) {
            this.parseException(ex);
        }
    }

    public async copyFile<RType extends string | IStorageFile = IStorageFile>(bucket: S3Bucket, src: string | IStorageFile, dest: string | IStorageFile, options?: CopyFileOptions): Promise<StorageResponse<RType, S3NativeResponse>> {
        await this.makeReady();
        this.checkWritePermission(bucket);
        try {
            // parse paths
            src = this.resolveBucketPath(bucket, src, false);
            this.isFileOrTrow(src, 'src');

            // resolved uri
            const isDirectory = this.isDirectory(this.getFilenameFromFile(dest));
            const destResolvedUri = this.resolveFileUri(bucket, dest, true);
            this.checkWritePermission(destResolvedUri.bucket as S3Bucket);
            dest = this.makeSlug(this.getFilenameFromFile(destResolvedUri.path));
            // if the dest is a directory, join the file to the dest
            if (isDirectory) {
                dest = joinPath(dest, this.extractFilenameFromPath(src));
                this.isFileOrTrow(dest, 'dest');
            }

            const params: S3Client.CopyObjectRequest = {
                Bucket: this.getBucketName(destResolvedUri.bucket as S3Bucket),
                CopySource: joinPath(this.getBucketName(bucket), src),
                Key: dest
            };
            const result = await this.client.copyObject(params).promise();
            if (this.shouldReturnObject(options?.returning)) {
                return this.makeResponse(await this.generateFileObject(destResolvedUri.bucket as S3Bucket, dest), result);
            }
            return this.makeResponse(this.getStorageUri(destResolvedUri.bucket as S3Bucket, dest), result);

        } catch (ex) {
            this.parseException(ex);
        }
    }

    public async fileExists<RType extends boolean | IStorageFile = any>(bucket: S3Bucket, path: string | IStorageFile, returning?: boolean): Promise<StorageResponse<RType, S3NativeResponse>> {
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
            if (ex.code === 'NotFound') {
                return this.makeResponse(false);
            }
            this.parseException(ex);
        }
    }

    public async listFiles<RType extends IStorageFile[] | string[] = IStorageFile[]>(bucket: S3Bucket, path: string, options?: ListFilesOptions): Promise<StorageResponse<ListResult<RType>, S3NativeResponse>> {

        await this.makeReady();
        this.checkReadPermission(bucket);
        const ret: any[] = [];
        try {
            path = this.resolveBucketPath(bucket, path);
            const params: S3Client.ListObjectsRequest = {
                Bucket: bucket.bucketName,
                Delimiter: (!options?.recursive) ? '/' : undefined,
                Prefix: !stringNullOrEmpty(path) ? path : undefined,
                MaxKeys: options?.maxResults || 1000,
            }
            let response: S3Client.ListObjectsOutput;
            do {
                response = (await this.client.listObjects(params).promise());
                let result = response.Contents;
                // filter by pattern
                if (options?.pattern) {
                    const pattern = options.pattern;
                    if (options.pattern) {
                        result = result.filter(f => {
                            const matches = this.fileNameMatches(f.Key, options.pattern);
                            return matches;
                        });
                    } else {
                        this.log('warn', `Invalid glob pattern ${pattern}`);
                    }
                }
                // filter by function
                if (options?.filter && typeof (options?.filter) === 'function') {
                    result = await Promise.all(result.filter(async f => await options.filter(f.Key, path)))
                }

                await Promise.all(result.map(async c => {
                    if (this.shouldReturnObject(options?.returning)) {
                        ret.push(this.generateFileObject(bucket, c.Key, await this.makeFileMetaFromResponse(bucket, c.Key, c)));
                    } else {
                        ret.push(this.getStorageUri(bucket, c.Key));
                    }
                }));
                //there are more results
                if (response.IsTruncated) {
                    params.Marker = response.NextMarker || response.Contents[response.Contents.length - 1].Key;
                }
            } while (response.IsTruncated);
            const promiseResult = await Promise.all(ret);
            return this.makeResponse({
                entries: promiseResult
            }, response);
        } catch (ex) {
            this.parseException(ex);
        }
    }
    public async putFile<RType extends string | IStorageFile = any>(bucket: S3Bucket, fileName: string | IStorageFile, contents: string | Buffer | Streams.Readable | IncomingMessage, options?: CreateFileOptions): Promise<StorageResponse<RType, S3NativeResponse>> {
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
            const params = {
                Bucket: bucket.bucketName,
                Key: fileName,
                Body: convertToReadStream(contents)
            } as S3Client.PutObjectRequest;
            const response = await this.client.upload(params).promise();
            let ret: any = this.storage.makeFileUri(this, bucket, fileName);
            if (this.shouldReturnObject(options?.returning)) {
                ret = await this.generateFileObject(bucket, fileName);
            }
            return this.makeResponse(ret, response);
        } catch (ex) {
            this.parseException(ex);
        }
    }
    public async getFileStream(bucket: S3Bucket, fileName: string | IStorageFile, options?: GetFileOptions): Promise<StorageResponse<Streams.Readable, S3NativeResponse>> {
        await this.makeReady();
        this.checkReadPermission(bucket);
        const params = {
            Bucket: bucket.bucketName,
            Key: this.resolveBucketPath(bucket, fileName),
            Range: `bytes=${options?.start || 0}-${options?.end}`,
        };
        const stream = this.client.getObject(params).createReadStream();
        return this.makeResponse(stream);
    }


    protected async makeFileMetaFromResponse(bucket: S3Bucket, path: string, data: any): Promise<IFileMeta> {
        const parts = path.split('/');
        const mime = await this.getMime(path);
        return {
            path: parts.slice(0, parts.length - 1).join('/'),
            name: parts.slice().reverse()[0],
            nativeAbsolutePath: this.getNativePath(bucket, path),
            nativeMeta: data,
            type: 'FILE',
            updatedAt: data.LastModified,
            size: (data.ContentLength as number) || data.Size,
            uri: this.getStorageUri(bucket, path),
            mime: mime,
            exists: true
        } as IFileMeta;


    }


    protected async generateFileMeta(path: string, bucket?: S3Bucket): Promise<IFileMeta | undefined> {
        await this.makeReady();
        try {
            const info = await this.client.headObject(
                {
                    Bucket: bucket.bucketName,
                    Key: path
                }
            ).promise();
            return await this.makeFileMetaFromResponse(bucket, path, info);

        } catch (ex) {
            this.parseException(ex);
        }
    }

    protected async generateFileObject(bucket: S3Bucket, path: string | IStorageFile, meta?: IFileMeta): Promise<IStorageFile> {
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

    public async removeEmptyDirectories(bucket: S3Bucket, path: string): Promise<StorageResponse<boolean, S3NativeResponse>> {
        return this.makeResponse(true, {});
    }

    public getNativePath(bucket: S3Bucket, fileName: string | IStorageFile): string {
        const path = this.resolveFileUri(bucket, fileName);
        return `s3://${bucket.bucketName}/${path.path}`;
    }


    protected normalizePath(dir?: string): string {
        dir = super.normalizePath(dir);
        if (dir) {
            if (dir.indexOf('/') === 0) {
                return dir.substring(1);
            }
        }
        return dir;
    }
    public resolveFileUri(bucket: S3Bucket, src: string | IStorageFile, allowCrossBucket = false): ResolveUriReturn {
        const parts = super.resolveFileUri(bucket, src, allowCrossBucket);
        if (parts.path.indexOf('/') === 0) {
            parts.path = parts.path.substring(1);
        }
        return parts;
    }

    protected getBucketName(bucket: string | S3Bucket): string {
        if (typeof (bucket) === 'string') {
            bucket = this.getBucket(bucket);
        }
        return bucket.bucketName;
    }

    protected shouldUseNativeUrlGenerator(bucket: S3Bucket): boolean {
        return bucket.config.useNativeUrlGenerator === true || (bucket.config.useNativeUrlGenerator === undefined && this.config.useNativeUrlGenerator === true);
    }


}