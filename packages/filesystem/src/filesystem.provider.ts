import path from 'path';
import fs from 'fs';
import {
    AbstractProvider,
    BucketConfigOptions,
    CopyFileOptions,
    DeleteFileOptions,
    FileStorage,
    IStorageFile,
    StorageFile,
    IFileMeta,
    IStorageProvider,
    StorageEventType,
    StorageExceptionType,
    StorageResponse,
    stringNullOrEmpty,
    Streams,
    CreateFileOptions,
    GetFileOptions,
    ListFilesOptions,
    ListResult,
    MoveFileOptions,
    constructError,
    joinPath,
    castValue,
    writeToStream,
    convertToReadStream,
    objectNull,
    throwError,

} from "@bigbangjs/file-storage";
import { FileSystemBucketConfig, FileSystemNativeResponse, FileSystemProviderConfig } from './types';
import { FilesystemBucket } from './filesystem.bucket';

const defaultConfig: FileSystemProviderConfig = {
    root: joinPath(process.cwd(), 'storage')
};


export class FilesystemProvider extends AbstractProvider<FileSystemProviderConfig, FileSystemBucketConfig, FileSystemNativeResponse, FilesystemBucket> implements IStorageProvider<FileSystemBucketConfig, FileSystemNativeResponse, FilesystemBucket>{

    public readonly supportsCrossBucketOperations: boolean;
    public readonly type: string = 'FILESYSTEM';
    constructor(storage: FileStorage, config: string | FileSystemProviderConfig = defaultConfig) {
        super(storage, config);
        this.supportsCrossBucketOperations = true;
    }

    protected validateConfig() {
        super.validateConfig();
        if (stringNullOrEmpty(this.config.root)) {
            throw constructError(`The root path must be provided [${this.name}]!`, StorageExceptionType.INVALID_PARAMS);
        }
    }

    protected parseConfig(config: string | FileSystemProviderConfig): FileSystemProviderConfig {
        const ret = {};
        if (typeof (config) === 'string') {
            Object.assign(ret, defaultConfig, this.parseUriToOptions(config));
        } else {
            Object.assign(ret, defaultConfig, config);
            if (typeof (config.uri) === 'string') {
                Object.assign(ret, this.parseUriToOptions(config.uri));
            }
        }
        return ret as FileSystemProviderConfig;
    }


    /**
     * Parse a uri to options
     * @param uri the uri
     * ```
     * example: fs://pathtoroot?signedUrlExpiration=3000&mode=0777
     * ```
     */
    public parseUriToOptions(uri: string): FileSystemProviderConfig {
        const ret: FileSystemProviderConfig = defaultConfig;
        const parsedUrl = new URL(uri);

        if (parsedUrl.searchParams.has('name')) {
            ret.name = parsedUrl.searchParams.get('name');
        }

        if (parsedUrl.searchParams.has('mode')) {
            ret.mode = parsedUrl.searchParams.get('mode') || '0777';
        }

        if (parsedUrl.searchParams.has('signedUrlExpiration') && (!stringNullOrEmpty(parsedUrl.searchParams.get('signedUrlExpiration')))) {
            const defaultSignedUrlExpiration = parsedUrl.searchParams.get('signedUrlExpiration');
            ret.defaultSignedUrlExpiration = castValue<number>(defaultSignedUrlExpiration, 'number', undefined);
        }

        if (parsedUrl.searchParams.has('autoCleanup') && (!stringNullOrEmpty(parsedUrl.searchParams.get('autoCleanup')))) {
            const autoCleanup = parsedUrl.searchParams.get('autoCleanup');
            ret.autoCleanup = castValue<boolean>(autoCleanup, 'boolean', undefined);
        }

        if (parsedUrl.hostname || parsedUrl.pathname) {
            ret.root = path.resolve(path.normalize(joinPath(parsedUrl.hostname, parsedUrl.pathname)));
        }
        return ret;
    }

    public async init(): Promise<StorageResponse<boolean, FileSystemNativeResponse>> {
        try {
            await fs.promises.mkdir(this.config.root, {
                recursive: true
            });

            this._ready = true;
            if (this.config.buckets && Array.isArray(this.config.buckets)) {
                const addBucketsPromises = this.config.buckets.map(async b => {
                    await this.addBucket(b as FileSystemBucketConfig);
                });
                await Promise.all(addBucketsPromises);
            }

            return this.makeResponse(true);
        } catch (ex) {
            this.parseException(ex);
        }
    }

    public async dispose(): Promise<StorageResponse<boolean, FileSystemNativeResponse>> {
        return this.makeResponse(true);
    }

    public async addBucket(bucket: FileSystemBucketConfig | FilesystemBucket | string): Promise<StorageResponse<FilesystemBucket, FileSystemNativeResponse>> {


        if (objectNull(bucket)) {
            throwError(`Invalid bucket config!`, StorageExceptionType.INVALID_PARAMS);
        }

        let name;
        if (typeof (bucket) === 'string') {
            const url = new URL(bucket);
            name = url.searchParams.get("name");
        } else {
            name = bucket.name;
        }

        const alias = this.resolveBucketAlias(name);
        this.ensureBucketNotRegistered(alias);
        let bucketInstance: FilesystemBucket = null;

        try {
            this.emit(StorageEventType.BEFORE_ADD_BUCKET, bucket);
            if (bucket instanceof FilesystemBucket) {
                bucketInstance = bucket;
            } else {
                bucketInstance = new FilesystemBucket(this, alias, bucket);
            }

            await fs.promises.mkdir(joinPath(this.config.root, bucketInstance.config.root), { recursive: true });
            this._buckets.add(bucketInstance.name, bucketInstance);
            this.emit(StorageEventType.BUCKET_ADDED, bucketInstance);
            return this.makeResponse(bucketInstance);

        } catch (ex) {
            const error = constructError(ex.message, StorageExceptionType.NATIVE_ERROR, ex);
            this.emit(StorageEventType.BUCKET_ADD_ERROR, error);
            throw error;
        }
    }

    public async destroyBucket(bucket: string | FilesystemBucket): Promise<StorageResponse<boolean, FileSystemNativeResponse>> {
        await this.makeReady();
        const name = typeof (bucket) === 'string' ? bucket : bucket.name;
        if (!this._buckets.has(name)) {
            throw constructError(`Bucket ${name} not found in this adapter!`, StorageExceptionType.NOT_FOUND, { name: name });
        }

        try {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            bucket = this._buckets.get(name);
            if (bucket) {
                this.emit(StorageEventType.BEFORE_DESTROY_BUCKET, bucket);
                try {
                    await fs.promises.rm(this.resolveBucketPath(bucket, '/'), { recursive: true })
                } catch (ex) {

                }
                this._buckets.remove(name);
                this.emit(StorageEventType.BUCKET_DESTROYED, bucket);
            }
            return this.makeResponse(true);
        } catch (ex) {
            const error = constructError(ex.message, StorageExceptionType.NATIVE_ERROR, ex);
            this.emit(StorageEventType.BUCKET_DESTROY_ERROR, error);
            throw error;
        }
    }

    public async emptyBucket(bucket: string | FilesystemBucket): Promise<StorageResponse<boolean, FileSystemNativeResponse>> {
        try {
            const name = typeof (bucket) === 'string' ? bucket : bucket.name;
            if (!this._buckets.has(name)) {
                return this.makeResponse(true);
            }
            bucket = this.getBucket(name);
            try {
                await fs.promises.rm(this.resolveBucketPath(bucket), { recursive: true });
            } catch (ex) { }
            return this.makeResponse(true);
        } catch (err) {
            this.parseException(err);
        }
    }


    public async listUnregisteredBuckets(creationOptions?: BucketConfigOptions): Promise<StorageResponse<FileSystemBucketConfig[], FileSystemNativeResponse>> {
        await this.makeReady();
        try {
            const options = Object.assign({}, {
                mode: '0777'
            }, creationOptions);
            const ret: FileSystemBucketConfig[] = [];
            const registerdBuckets = (await this.listBuckets()).result;
            const allBuckets = (await fs.promises.readdir(this.config.root, { withFileTypes: true })).filter((v) => {
                return v.isDirectory();
            });
            allBuckets.map(f => {
                const candidate = registerdBuckets.filter(b => (b.config as FileSystemBucketConfig).root === f.name).length === 0;
                if (candidate) {
                    ret.push({
                        name: f.name,
                        root: f.name,
                        mode: options.mode,
                        autoCleanup: true,
                        defaultSignedUrlExpiration: this.config.defaultSignedUrlExpiration
                    })
                }
            });
            return this.makeResponse(ret);
        } catch (ex) {
            this.parseException(ex);
        }
    }


    //  BUCKET API
    public async deleteFile(bucket: FilesystemBucket, dir: string | IStorageFile, options?: DeleteFileOptions): Promise<StorageResponse<boolean, FileSystemNativeResponse>> {
        await this.makeReady();
        this.checkWritePermission(bucket);
        this.isFileOrTrow(this.getFilenameFromFile(dir), 'path');
        try {
            dir = this.resolveBucketPath(bucket, dir);
            await fs.promises.unlink(dir);
            if (this.shouldCleanupDirectory(bucket, options?.cleanup)) {
                await this.cleanDirectories(this.extractDirectoryFromPath(dir));
            }
            return this.makeResponse(true);
        } catch (ex) {
            if (ex.code === 'ENOENT') {
                // if the directory doesn't exists, return true
                return this.makeResponse(true);
            }
            this.parseException(ex);
        }
    }

    public async fileExists<RType extends boolean | IStorageFile = any>(bucket: FilesystemBucket, path: string | IStorageFile, returning?: boolean): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        await this.makeReady();
        this.checkReadPermission(bucket);
        try {
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
            this.parseException(ex);
        }
    }

    public async listFiles<RType extends string[] | IStorageFile[] = IStorageFile[]>(bucket: FilesystemBucket, path: string, options?: ListFilesOptions): Promise<StorageResponse<ListResult<RType>, FileSystemNativeResponse>> {
        await this.makeReady();
        this.checkReadPermission(bucket);
        try {
            const completePath = this.resolveBucketPath(bucket);
            const fileObjectGenerator = async (path: string, bucket: FilesystemBucket) => {
                path = this.convertAbsolutePathToBucketPath(bucket, path);
                const result = await this.generateFileObject(bucket, path);
                if (!result) {
                    this.log('warn', path);
                }
                return result;
            }
            if (stringNullOrEmpty(path)) {
                path = '/';
            }
            const entries = await this.generateList(path, completePath, options, 'FILE', bucket, fileObjectGenerator);
            const result: any = {
            }
            if (!this.shouldReturnObject(options?.returning)) {
                result.entries = entries.map(e => {
                    return this.getStorageUri(bucket, e);
                })
            } else {
                result.entries = entries;
            }
            return this.makeResponse(result);
        } catch (ex) {
            this.parseException(ex);
        }
    }

    public async putFile<RType extends string | IStorageFile = any>(bucket: FilesystemBucket, fileName: string | IStorageFile, contents: string | Buffer | Streams.Readable, options?: CreateFileOptions): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
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
            // ensure directory
            await this.ensureDirExists(this.extractDirectoryFromPath(absFilename));
            let promise = null;
            const writeStream = fs.createWriteStream(absFilename, { flags: 'w' });
            const readStream: Streams.Readable = convertToReadStream(contents)
            if (readStream) {
                promise = writeToStream(readStream, writeStream);
            } else {
                promise = fs.promises.writeFile(absFilename, contents.toString(), { flag: 'w' });
            }

            await promise;

            let ret: any = this.storage.makeFileUri(this, bucket, this.convertAbsolutePathToBucketPath(bucket, absFilename));
            if (this.shouldReturnObject(options?.returning)) {
                ret = await this.generateFileObject(bucket, fileName);

            }
            return this.makeResponse(ret);
        } catch (ex) {
            this.parseException(ex);
        }
    }

    public async getFileStream(bucket: FilesystemBucket, fileName: string | IStorageFile, options?: GetFileOptions): Promise<StorageResponse<Streams.Readable, FileSystemNativeResponse>> {
        await this.makeReady();
        this.checkReadPermission(bucket);
        const absPath = this.resolveBucketPath(bucket, fileName);
        this.isFileOrTrow(absPath);
        const result = fs.createReadStream(absPath, {
            start: options?.start,
            end: options?.end
        });
        return this.makeResponse(result);
    }



    public async copyFile<RType extends string | IStorageFile = IStorageFile>(bucket: FilesystemBucket, src: string | IStorageFile, dest: string | IStorageFile, options?: CopyFileOptions): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        await this.makeReady();
        this.checkReadPermission(bucket);

        try {
            // parse paths
            src = this.resolveBucketPath(bucket, src, false);
            this.isFileOrTrow(src, 'src');

            // resolved uri
            const isDirectory = this.isDirectory(this.getFilenameFromFile(dest));
            const destResolvedUri = this.resolveFileUri(bucket, dest, true);
            this.checkWritePermission(destResolvedUri.bucket as FilesystemBucket);
            dest = this.makeSlug(this.getFilenameFromFile(destResolvedUri.path));
            // if the dest is a directory, join the file to the dest
            if (isDirectory) {
                dest = joinPath(dest, this.extractFilenameFromPath(src));
                this.isFileOrTrow(dest, 'dest');
            }

            // get the complete filepath of the dest
            const completeDest = this.resolveBucketPath(destResolvedUri.bucket as FilesystemBucket, dest);
            // check or create that the directory exists
            await this.ensureDirExists(this.extractDirectoryFromPath(completeDest));
            // copy the file
            await fs.promises.copyFile(src, completeDest);

            if (this.shouldReturnObject(options?.returning)) {
                return this.makeResponse(await this.generateFileObject(destResolvedUri.bucket as FilesystemBucket, dest));
            }
            return this.makeResponse(this.storage.makeFileUri(this, destResolvedUri.bucket, dest));
        } catch (ex) {
            this.parseException(ex);
        }

    }

    public async moveFile<RType extends IStorageFile | string = IStorageFile>(bucket: FilesystemBucket, src: string | IStorageFile, dest: string | IStorageFile, options?: MoveFileOptions): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        await this.makeReady();
        this.checkReadPermission(bucket);
        try {
            // parse paths
            src = this.resolveBucketPath(bucket, src, false);
            this.isFileOrTrow(src, 'src');

            // resolved uri
            const isDirectory = this.isDirectory(this.getFilenameFromFile(dest));
            const destResolvedUri = this.resolveFileUri(bucket, dest, true);
            this.checkWritePermission(destResolvedUri.bucket as FilesystemBucket);
            dest = this.makeSlug(this.getFilenameFromFile(destResolvedUri.path));
            // if the dest is a directory, join the file to the dest
            if (isDirectory) {
                dest = joinPath(dest, this.extractFilenameFromPath(src));
                this.isFileOrTrow(dest, 'dest');
            }

            // get the complete filepath of the dest
            const completeDest = this.resolveBucketPath(destResolvedUri.bucket as FilesystemBucket, dest);
            // check or create that the directory exists
            await this.ensureDirExists(this.extractDirectoryFromPath(completeDest));
            // copy the file
            await fs.promises.rename(src, completeDest);

            // cleanup empty dirs
            if (this.shouldCleanupDirectory(bucket, options?.cleanup)) {
                await this.cleanDirectories(this.extractDirectoryFromPath(src));
            }

            if (this.shouldReturnObject(options?.returning)) {
                return this.makeResponse(await this.generateFileObject(destResolvedUri.bucket as FilesystemBucket, dest));
            }
            return this.makeResponse(this.storage.makeFileUri(this, destResolvedUri.bucket, dest));


        } catch (ex) {
            this.parseException(ex);
        }
    }


    public async removeEmptyDirectories(bucket: FilesystemBucket, basePath = ''): Promise<StorageResponse<boolean, FileSystemNativeResponse>> {
        await this.makeReady();
        try {
            const absPath = this.resolveBucketPath(bucket, basePath);
            await this.cleanDirectories(absPath);
            return this.makeResponse(true);
        } catch (ex) {
            this.parseException(ex);
        }
    }

    public getNativePath(bucket: FilesystemBucket, fileName: string | IStorageFile): string {
        return this.resolveBucketPath(bucket, fileName);
    }

    protected async cleanDirectories(dir: string) {
        const stats = await fs.promises.stat(dir);
        if (!stats.isDirectory()) {
            return;
        }
        let fileNames = await fs.promises.readdir(dir);
        if (fileNames.length > 0) {
            const promises = fileNames.map(
                (fileName) => this.cleanDirectories(joinPath(dir, fileName)),
            );
            await Promise.all(promises);
            fileNames = await fs.promises.readdir(dir);
        }

        if (fileNames.length === 0) {
            await fs.promises.rmdir(dir);
        }
    }

    protected async generateList(dir: string, base: string, options: ListFilesOptions, type: 'DIRECTORY' | 'FILE' | 'BOTH' = 'FILE', bucket: FilesystemBucket, metaGenerator: (path: string, bucket: FilesystemBucket) => Promise<IFileMeta | IStorageFile>, all: any[] = []) {
        await this.makeReady();

        const absDir = this.normalizePath(joinPath(base, dir));
        const entries: fs.Dirent[] = await fs.promises.readdir(absDir, { withFileTypes: true });
        let result = [];
        if (type === 'DIRECTORY') {
            result = entries.filter(f => f.isDirectory());
        } else if (type === 'FILE') {
            result = entries.filter(f => f.isFile());
        } else {
            result = entries.filter(f => f.isDirectory() || f.isFile());
        }

        // filter by pattern
        if (options?.pattern) {
            const pattern = options.pattern;
            if (options.pattern) {
                result = result.filter(f => {
                    let p = joinPath(dir, f.name);
                    if (p.indexOf('/') === 0) {
                        p = p.substring(1);
                    }
                    const matches = this.fileNameMatches(p, options.pattern);
                    return matches;
                });
            } else {
                this.log('warn', `Invalid glob pattern ${pattern}`);
            }
        }
        // filter by function
        if (options?.filter && typeof (options?.filter) === 'function') {
            result = await Promise.all(result.filter(async f => await options.filter(f.name, dir)))
        }


        if (this.shouldReturnObject(options?.returning)) {
            result = (await Promise.all(result.map(async r => {
                return metaGenerator(joinPath(dir, r.name), bucket);
            })));
            result.map(r => all.push(r));
        } else {
            result.map(r => {
                all.push(joinPath(dir, r.name));
            });
        }
        if (options?.recursive) {
            await Promise.all(entries.filter(f => f.isDirectory()).map(async f => await this.generateList(joinPath(dir, f.name), base, options, type, bucket, metaGenerator, all)));
        }
        return all;

    }

    protected async generateFileMeta(src: string, bucket?: FilesystemBucket): Promise<IFileMeta | undefined> {
        await this.makeReady();
        let stats, relativePath;
        try {
            stats = await fs.promises.stat(src);
        } catch (ex) {
            //this.log('error', ex);
            return;
        }

        if (bucket) {
            relativePath = this.convertAbsolutePathToBucketPath(bucket, src);
        } else {
            relativePath = src;
        }

        const relativePathParts = relativePath.split('/');
        let path = relativePathParts.slice(0, relativePathParts.length - 1).join('/');
        if (stringNullOrEmpty(path)) {
            path = '/';
        }
        const mime = await this.getMime(src);
        const meta = {
            path: path,
            name: relativePathParts.slice().reverse()[0],
            nativeAbsolutePath: this.getNativePath(bucket, path),
            nativeMeta: stats,
            type: 'FILE',
            createdAt: stats.birthtime,
            updatedAt: stats.mtime,
            size: stats.size,
            uri: this.getStorageUri(bucket, relativePath),
            mime: mime,
            exists: true
        } as IFileMeta;
        return meta;
    }

    protected async generateFileObject(bucket: FilesystemBucket, src: string | IStorageFile, meta?: IFileMeta): Promise<IStorageFile | undefined> {
        await this.makeReady();
        const completeSrc = this.resolveBucketPath(bucket, src);
        let ret;
        meta = meta || await this.generateFileMeta(completeSrc, bucket);
        if (!meta) {
            return;
        }
        ret = new StorageFile(bucket, meta);
        ret.uri = this.storage.makeFileUri(this, bucket, src);
        if (typeof (src) === 'string') {
            return ret;
        } else {
            ret = src;
            src.bucket = bucket;
            src.meta = meta;
            return ret;
        }
    }

    protected async ensureDirExists(absPath: string): Promise<void> {
        const parts = absPath.split('/');
        const dir = this.normalizePath(parts.slice(0, parts.length - 1).join('/'));
        await fs.promises.mkdir(dir, { recursive: true });

    }

    protected getBucketRootPath(bucket: FilesystemBucket) {
        return this.extractBucketOptions(bucket).root || bucket.name;
    }

    /**
     * Obtains a full path of the bucket + dir
     * @param bucket the target bucket
     * @param dir the path
     */
    protected resolveBucketPath(bucket: FilesystemBucket, dir?: string | IStorageFile, allowCrossBucket = false): string {
        const resolved = this.resolveFileUri(bucket, dir, allowCrossBucket);
        return joinPath(this.config.root, this.getBucketRootPath(resolved.bucket as FilesystemBucket), this.normalizePath(resolved.path) || '/').replace(/\\/g, '/');
    }

    protected convertAbsolutePathToBucketPath(bucket: FilesystemBucket, dir?: string) {
        const bucketPath = this.resolveBucketPath(bucket);
        return dir.replace(bucketPath, '');
    }

}