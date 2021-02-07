import path from 'path';
import fs from 'fs';
import S3Client from "aws-sdk/clients/s3";
import {
    AbstractProvider,
    IStorageProvider,
    FileStorage,
    StorageException,
    ProviderConfigOptions,
    BucketConfigOptions,
    StorageExceptionType,
    stringNullOrEmpty,
    Streams,
    CreateFileOptions,
    DeleteFileOptions,
    GetFileOptions,
    IBucket,
    IFile,
    ListFilesOptions,
    ListResult,
    StorageResponse,
    Bucket,
    StorageEventType,
    IFileMeta,
    File,
    Pattern,
    DeleteManyFilesOptions,
    SignedUrlOptions,
    castValue,
    CopyFileOptions,
} from "@bigbangjs/file-storage";

export type S3ProviderConfig = {
    accessKeyId?: string;
    secretAccessKey?: string;
    region?: string;
    keyFile?: string;
    dualStack?: boolean;
    ssl?: boolean;
    useNativeUrlGenerator?: boolean;
} & ProviderConfigOptions & S3Client.ClientConfiguration;

const defaultConfig: S3ProviderConfig = {
    region: 'us-east-2',
    dualStack: true,
    ssl: true,
    useNativeUrlGenerator: true,

};

export type S3BucketConfig = {
    bucketName?: string;
    tryCreate?: boolean,
    useNativeUrlGenerator?: boolean,
} & BucketConfigOptions;

export type S3NativeResponse = {

}

export class S3Provider extends AbstractProvider<S3ProviderConfig, S3BucketConfig, S3NativeResponse> implements IStorageProvider<S3BucketConfig, S3NativeResponse>{
    public readonly supportsCrossBucketOperations: boolean;
    public readonly type: string = 'S3';
    protected client: S3Client;

    constructor(storage: FileStorage, name: string, config: string | S3ProviderConfig = defaultConfig) {
        super(storage, name, config);
        this.supportsCrossBucketOperations = true;
        this.validateOptions();
    }

    protected validateOptions() {
        if (stringNullOrEmpty(this.config.region) || stringNullOrEmpty(this.config.accessKeyId) || stringNullOrEmpty(this.config.secretAccessKey)) {
            throw new StorageException(StorageExceptionType.INVALID_PARAMS, `The values for region, accessKeyId and secretAccessKey path must be provided [${this.name}]!`);
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
            const contents = JSON.parse(fs.readFileSync(keyFilePath).toString());
            ret.accessKeyId = contents.accessKeyId;
            ret.secretAccessKey = contents.secretAccessKey;
        }

        return ret as S3ProviderConfig;
    }



    public static parseUriToOptions(uri: string): S3ProviderConfig {
        const ret: S3ProviderConfig = defaultConfig;
        const parsedUrl = new URL(uri);

        if (parsedUrl.searchParams.has('mode')) {
            ret.mode = parsedUrl.searchParams.get('mode') || '0777';
        }

        if (!stringNullOrEmpty(parsedUrl.hostname)) {
            ret.region = parsedUrl.hostname;
        }

        if (parsedUrl.username && parsedUrl.password) {
            ret.accessKeyId = parsedUrl.username;
            ret.secretAccessKey = parsedUrl.password;
        }

        if (parsedUrl.searchParams.has('keyFile')) {
            ret.keyFile = parsedUrl.searchParams.get('keyFile');
        }

        if (parsedUrl.searchParams.has('ssl') && (!stringNullOrEmpty(parsedUrl.searchParams.get('ssl')))) {
            const ssl = parsedUrl.searchParams.get('ssl');
            ret.ssl = castValue<boolean>(ssl, 'boolean', true);
        }

        if (parsedUrl.searchParams.has('dualStack') && (!stringNullOrEmpty(parsedUrl.searchParams.get('dualStack')))) {
            const dualStack = parsedUrl.searchParams.get('dualStack');
            ret.dualStack = castValue<boolean>(dualStack, 'boolean', true);
        }

        if (parsedUrl.searchParams.has('useNativeUrlGenerator') && (!stringNullOrEmpty(parsedUrl.searchParams.get('useNativeUrlGenerator')))) {
            const useNativeUrlGenerator = parsedUrl.searchParams.get('useNativeUrlGenerator');
            ret.useNativeUrlGenerator = castValue<boolean>(useNativeUrlGenerator, 'boolean', true);
        }

        if (parsedUrl.searchParams.has('signedUrlExpiration') && (!stringNullOrEmpty(parsedUrl.searchParams.get('signedUrlExpiration')))) {
            const defaultSignedUrlExpiration = parsedUrl.searchParams.get('signedUrlExpiration');
            ret.defaultSignedUrlExpiration = castValue<number>(defaultSignedUrlExpiration, 'number', undefined);
        }
        return ret;
    }


    public async init(): Promise<StorageResponse<boolean, S3NativeResponse>> {
        try {
            this._ready = true;
            this.client = new S3Client(this.config);
            return this.makeResponse(true);
        } catch (ex) {
            this.parseException(ex);
        }
    }
    public async dispose(): Promise<StorageResponse<boolean, S3NativeResponse>> {
        try {
            this._ready = false;
            this.client = undefined;
            return this.makeResponse(true);
        } catch (ex) {
            this.parseException(ex);
        }
    }
    public async addBucket(name: string, config?: S3BucketConfig): Promise<StorageResponse<IBucket, S3NativeResponse>> {
        await this.makeReady();
        this.emit(StorageEventType.BEFORE_ADD_BUCKET, config);
        const alias = await this.resolveBucketAlias(name);
        this.ensureBucketNotRegistered(alias);
        try {
            config = Object.assign({}, {
                mode: '0777',
                bucketName: name,
                tryCreate: true,
                useNativeUrlGenerator: this.config.useNativeUrlGenerator
            }, config || {});

            let response = null;
            try {
                //check that the bucket exists
                response = await this.client.headBucket({ Bucket: config.bucketName }).promise();
            } catch (ex) {
                if (ex.code === 'NotFound' && config.tryCreate) {
                    response = await this.client.createBucket({ Bucket: config.bucketName }).promise();
                } else {
                    throw ex;
                }
            }

            const bucket = new Bucket(this, name, alias, config);
            this._buckets.add(name, bucket);
            this.emit(StorageEventType.BUCKET_ADDED, bucket);
            return this.makeResponse(bucket, response);
        } catch (ex) {
            const message = ex.message || `The bucket ${name} cannot be accessed!`;
            const error = new StorageException(StorageExceptionType.NATIVE_ERROR, message, ex);
            this.emit(StorageEventType.BUCKET_ADD_ERROR, error);
            throw error;
        }
    }
    public async destroyBucket(b: string | IBucket): Promise<StorageResponse<boolean, S3NativeResponse>> {
        await this.makeReady();
        const name = typeof (b) === 'string' ? b : b.name;
        if (!this._buckets.has(name)) {
            throw new StorageException(StorageExceptionType.NOT_FOUND, `Bucket ${name} not found in this adapter!`, { name: name });
        }

        try {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const bucket = this._buckets.get(name)!;
            this.emit(StorageEventType.BEFORE_DESTROY_BUCKET, bucket);
            //delete all files
            await this.deleteFiles(bucket, '');
            this._buckets.remove(name);
            const response = await this.client.deleteBucket({ Bucket: bucket.config.bucketName, }).promise();
            this.emit(StorageEventType.BUCKET_DESTROYED, bucket);
            return this.makeResponse(true, response);
        } catch (ex) {
            const error = new StorageException(StorageExceptionType.NATIVE_ERROR, ex.message, ex);
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
            const cantidates = allBuckets.Buckets.filter(b => !registerdBuckets.find(f => f.config.bucketName === b.Name));
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

    public async getPublicUrl(bucket: IBucket, fileName: string | IFile, options?: any): Promise<string> {
        if (this.shouldUseNativeUrlGenerator(bucket)) {
            return `https://${bucket.config.bucketName}.s3.amazonaws.com/${this.resolveBucketPath(bucket, fileName)}`;
        } else {
            return super.getPublicUrl(bucket, fileName, options);
        }
    }

    public async getSignedUrl(bucket: IBucket, fileName: string | IFile, options?: SignedUrlOptions): Promise<string> {
        options = options || {};
        options.expiration = options.expiration || bucket.config.defaultSignedUrlExpiration || this.config.defaultSignedUrlExpiration || this.storage.config.defaultSignedUrlExpiration;
        if (this.shouldUseNativeUrlGenerator(bucket)) {
            return this.client.getSignedUrl('getObject', {
                Bucket: bucket.config.bucketName,
                Key: this.resolveBucketPath(bucket, fileName),
                Expires: options.expiration
            });

        } else {
            return super.getSignedUrl(bucket, fileName, options);
        }
    }


    public async deleteFile(bucket: IBucket, path: string | IFile, options?: DeleteFileOptions): Promise<StorageResponse<boolean, S3NativeResponse>> {
        await this.makeReady();
        if (!bucket.canRead()) {
            throw new StorageException(StorageExceptionType.PERMISSION_ERROR, `Cannot read on bucket ${bucket.name}!`);
        }
        try {
            path = this.resolveBucketPath(bucket, path);
            const result = await this.client.deleteObject({
                Bucket: bucket.config.bucketName,
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

    public async deleteFiles(bucket: IBucket, path: string, pattern: Pattern = '**', options?: DeleteManyFilesOptions): Promise<StorageResponse<boolean, S3NativeResponse>> {
        await this.makeReady();
        if (!bucket.canWrite()) {
            throw new StorageException(StorageExceptionType.PERMISSION_ERROR, `Cannot write on bucket ${bucket.name}!`);
        }
        try {
            path = this.resolveFileUri(bucket, path);
            const toDelete = await this.listFiles(bucket, path, { pattern, returning: false, recursive: true });
            if (toDelete.result.entries.length === 0) {
                return this.makeResponse(true);
            }
            const params: S3Client.DeleteObjectsRequest = {
                Bucket: bucket.config.bucketName,
                Delete: {
                    Objects: [

                    ]
                }
            };

            toDelete.result.entries.map(r => {
                params.Delete.Objects.push({
                    Key: this.resolveFileUri(bucket, r)
                })
            });

            const response = await this.client.deleteObjects(params).promise();
            return this.makeResponse(true, response);
        } catch (ex) {
            this.parseException(ex);
        }
    }

    public async copyFile<RType extends string | IFile = IFile>(bucket: IBucket, src: string | IFile, dest: string | IFile, options?: CopyFileOptions): Promise<StorageResponse<RType, S3NativeResponse>> {
        await this.makeReady();
        if (!bucket.canWrite()) {
            throw new StorageException(StorageExceptionType.PERMISSION_ERROR, `Cannot write on bucket ${bucket.name}!`);
        }
        try {
            src = this.resolveBucketPath(bucket, src);
            dest = this.resolveBucketPath(bucket, dest);
            const params: S3Client.CopyObjectRequest = {
                Bucket: bucket.config.bucketName,
                CopySource: bucket.config.bucketName + '/' + src,
                Key: dest
            };
            const result = await this.client.copyObject(params).promise();
            if (this.shouldReturnObject(options?.returning)) {
                return this.makeResponse(await this.generateFileObject(bucket, dest), result);
            }
            return this.makeResponse(this.getStorageUri(bucket, dest), result);

        } catch (ex) {
            this.parseException(ex);
        }
    }

    public async fileExists<RType extends boolean | IFile = any>(bucket: IBucket, path: string | IFile, returning?: boolean): Promise<StorageResponse<RType, S3NativeResponse>> {
        await this.makeReady();
        if (!bucket.canRead()) {
            throw new StorageException(StorageExceptionType.PERMISSION_ERROR, `Cannot read on bucket ${bucket.name}!`);
        }
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

    public async listFiles<RType extends IFile[] | string[] = IFile[]>(bucket: IBucket, path: string, options?: ListFilesOptions): Promise<StorageResponse<ListResult<RType>, S3NativeResponse>> {

        await this.makeReady();
        if (!bucket.canRead()) {
            throw new StorageException(StorageExceptionType.PERMISSION_ERROR, `Cannot read on bucket ${bucket.name}!`);
        }
        const ret: any[] = [];
        try {
            path = this.resolveFileUri(bucket, path);
            const params: S3Client.ListObjectsRequest = {
                Bucket: bucket.config.bucketName,
                Delimiter: (!options?.recursive) ? '/' : undefined,
                Prefix: path,
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
    public async putFile<RType extends string | IFile = any>(bucket: IBucket, fileName: string | IFile, contents: string | Buffer | Streams.Readable, options?: CreateFileOptions): Promise<StorageResponse<RType, S3NativeResponse>> {
        await this.makeReady();

        if (!bucket.canWrite()) {
            throw new StorageException(StorageExceptionType.PERMISSION_ERROR, `Cannot write on bucket ${bucket.name}!`);
        }

        if (options?.overwrite === false) {
            const exists = (await this.fileExists(bucket, fileName, false)).result;
            if (exists) {
                const fName = typeof (fileName) === 'string' ? fileName : fileName.getAbsolutePath();
                throw new StorageException(StorageExceptionType.DUPLICATED_ELEMENT, `The file ${fName} already exists!`);
            }
        }

        try {

            fileName = this.resolveBucketPath(bucket, fileName);

            let readStream: Streams.Readable = null;
            const params = {
                Bucket: bucket.config.bucketName,
                Key: fileName,
                Body: '' as any
            } as S3Client.PutObjectRequest;
            if (contents instanceof Buffer || typeof (contents) === 'string') {
                readStream = new Streams.Readable();
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                readStream._read = (): void => { };
                readStream.push(contents);
                readStream.push(null);
            } else if (contents instanceof Streams.Readable) {
                readStream = contents;
            }
            params.Body = readStream;

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
    public async getFileStream(bucket: IBucket, fileName: string | IFile, options?: GetFileOptions): Promise<StorageResponse<Streams.Readable, S3NativeResponse>> {
        await this.makeReady();

        if (!bucket.canRead()) {
            throw new StorageException(StorageExceptionType.PERMISSION_ERROR, `Cannot read on bucket ${bucket.name}!`);
        }
        const params = {
            Bucket: bucket.config.bucketName,
            Key: this.resolveBucketPath(bucket, fileName),
            Range: `bytes=${options?.start || 0}-${options?.end}`,
        };
        const stream = this.client.getObject(params).createReadStream();
        return this.makeResponse(stream);
    }


    protected async makeFileMetaFromResponse(bucket: IBucket, path: string, data: any): Promise<IFileMeta> {
        const parts = path.split('/');
        const mime = await this.getMime(path);
        return {
            path: parts.slice(0, parts.length - 1).join('/'),
            name: parts.slice().reverse()[0],
            nativeAbsolutePath: path,
            nativeMeta: data,
            type: 'FILE',
            updatedAt: data.LastModified,
            size: (data.ContentLength as number) || data.Size,
            uri: this.getStorageUri(bucket, path),
            mime: mime,
            exists: true
        } as IFileMeta;


    }


    protected async generateFileMeta(path: string, bucket?: IBucket): Promise<IFileMeta | undefined> {
        await this.makeReady();
        try {
            const info = await this.client.headObject(
                {
                    Bucket: bucket.config.bucketName,
                    Key: path
                }
            ).promise();
            return this.makeFileMetaFromResponse(bucket, path, info);

        } catch (ex) {
            this.parseException(ex);
        }
    }

    protected async generateFileObject(bucket: IBucket, path: string | IFile, meta?: IFileMeta): Promise<IFile> {
        await this.makeReady();
        try {
            let ret;
            meta = meta || await this.generateFileMeta(this.resolveBucketPath(bucket, path), bucket);
            if (!meta) {
                return;
            }
            ret = new File(bucket, meta);
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

    public async removeEmptyDirectories(bucket: IBucket, path: string): Promise<StorageResponse<boolean, S3NativeResponse>> {
        return this.makeResponse(true, {});
    }

    protected shouldUseNativeUrlGenerator(bucket: IBucket): boolean {
        return bucket.config.useNativeUrlGenerator === true || (bucket.config.useNativeUrlGenerator === undefined && this.config.useNativeUrlGenerator === true);
    }


    protected resolveBucketPath(bucket: IBucket, dir?: string | IFile) {
        dir = this.getFilenameFromFile(dir);
        dir = this.resolveFileUri(bucket, dir);
        return dir;
    }

    protected normalizePath(dir?: string): string {
        if (!dir) {
            return '';
        }

        dir.replace(/\\/g, '/');
        if (dir.indexOf('/') === 0) {
            dir = dir.substring(1);
        }
        let result = '';
        dir.split('/').map(d => {
            if (d !== '/' && !stringNullOrEmpty(d)) {
                result += '/' + this.slug(d);
            }
        });
        if (result.indexOf('/') === 0) {
            result = result.substring(1);
        }
        return path.normalize(result).replace(/\\/g, '/');
    }

}