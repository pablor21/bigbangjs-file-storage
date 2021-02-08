import path from 'path';
import fs from 'fs';
import {
    AbstractProvider,
    Bucket,
    BucketConfigOptions,
    CopyFileOptions,
    DeleteFileOptions,
    FileStorage,
    IBucket,
    IStorageFile,
    StorageFile,
    IFileMeta,
    IStorageProvider,
    ProviderConfigOptions,
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

} from "@bigbangjs/file-storage";

export type FileSystemProviderConfig = {
    root?: string;
} & ProviderConfigOptions;

const defaultConfig: FileSystemProviderConfig = {
    root: joinPath(process.cwd(), 'storage')
};

export type FileSystemBucketConfig = {
    root: string;
} & BucketConfigOptions;

export type FileSystemNativeResponse = {

}

export class FilesystemProvider extends AbstractProvider<FileSystemProviderConfig, FileSystemBucketConfig, FileSystemNativeResponse> implements IStorageProvider<FileSystemBucketConfig, FileSystemNativeResponse>{

    public readonly supportsCrossBucketOperations: boolean;
    public readonly type: string = 'FILESYSTEM';
    constructor(storage: FileStorage, name: string, config: string | FileSystemProviderConfig = defaultConfig) {
        super(storage, name, config);
        this.supportsCrossBucketOperations = true;
        this.validateOptions();
    }

    protected validateOptions() {
        if (stringNullOrEmpty(this.config.root)) {
            throw constructError(`The root path must be provided [${this.name}]!`, StorageExceptionType.INVALID_PARAMS);
        }
    }

    protected parseConfig(config: string | FileSystemProviderConfig): FileSystemProviderConfig {
        const ret = {};
        if (typeof (config) === 'string') {
            Object.assign(ret, defaultConfig, FilesystemProvider.parseUriToOptions(config));
        } else {
            Object.assign(ret, defaultConfig, config);
            if (typeof (config.uri) === 'string') {
                Object.assign(ret, FilesystemProvider.parseUriToOptions(config.uri));
            }
        }
        return ret as FileSystemProviderConfig;
    }

    public static parseUriToOptions(uri: string): FileSystemProviderConfig {
        const ret: FileSystemProviderConfig = defaultConfig;
        const parsedUrl = new URL(uri);

        if (parsedUrl.searchParams.has('mode')) {
            ret.mode = parsedUrl.searchParams.get('mode') || '0777';
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
            return this.makeResponse(true);
        } catch (ex) {
            this.parseException(ex);
        }
    }

    public async dispose(): Promise<StorageResponse<boolean, FileSystemNativeResponse>> {
        return this.makeResponse(true);
    }

    public async addBucket(name: string, config?: FileSystemBucketConfig): Promise<StorageResponse<IBucket, FileSystemNativeResponse>> {
        await this.makeReady();
        this.emit(StorageEventType.BEFORE_ADD_BUCKET, config);
        const alias = await this.resolveBucketAlias(name);
        this.ensureBucketNotRegistered(alias);
        try {
            config = Object.assign({}, {
                root: name,
                mode: '0777'
            }, config || {});

            const bucket = new Bucket(this, name, alias, config);
            await fs.promises.mkdir(joinPath(this.config.root, config.root), { recursive: true });
            this._buckets.add(name, bucket);
            this.emit(StorageEventType.BUCKET_ADDED, bucket);
            return this.makeResponse(bucket);
        } catch (ex) {
            const error = constructError(ex.message, StorageExceptionType.NATIVE_ERROR, ex);
            this.emit(StorageEventType.BUCKET_ADD_ERROR, error);
            throw error;
        }
    }

    public async destroyBucket(b: string | IBucket): Promise<StorageResponse<boolean, FileSystemNativeResponse>> {
        await this.makeReady();
        const name = typeof (b) === 'string' ? b : b.name;
        if (!this._buckets.has(name)) {
            throw constructError(`Bucket ${name} not found in this adapter!`, StorageExceptionType.NOT_FOUND, { name: name });
        }

        try {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const bucket = this._buckets.get(name)!;
            this.emit(StorageEventType.BEFORE_DESTROY_BUCKET, bucket);
            this._buckets.remove(name);
            try {
                await fs.promises.rmdir(this.resolveBucketPath(bucket));
            } catch (ex) { }
            this.emit(StorageEventType.BUCKET_DESTROYED, bucket);
            return this.makeResponse(true);
        } catch (ex) {
            const error = constructError(ex.message, StorageExceptionType.NATIVE_ERROR, ex);
            this.emit(StorageEventType.BUCKET_DESTROY_ERROR, error);
            throw error;
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
                        mode: options.mode
                    })
                }
            });
            return this.makeResponse(ret);
        } catch (ex) {
            this.parseException(ex);
        }
    }


    //  BUCKET API
    public async deleteFile(bucket: IBucket<FileSystemNativeResponse>, dir: string | IStorageFile, options?: DeleteFileOptions): Promise<StorageResponse<boolean, FileSystemNativeResponse>> {
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

    public async fileExists<RType extends boolean | IStorageFile = any>(bucket: IBucket<any, any>, path: string | IStorageFile, returning?: boolean): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
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

    public async listFiles<RType extends string[] | IStorageFile[] = IStorageFile[]>(bucket: IBucket<any, any>, path: string, options?: ListFilesOptions): Promise<StorageResponse<ListResult<RType>, FileSystemNativeResponse>> {
        await this.makeReady();
        this.checkReadPermission(bucket);
        try {
            const completePath = this.resolveBucketPath(bucket);
            const fileObjectGenerator = async (path: string, bucket: IBucket) => {
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

    public async putFile<RType extends string | IStorageFile = any>(bucket: IBucket<any, any>, fileName: string | IStorageFile, contents: string | Buffer | Streams.Readable, options?: CreateFileOptions): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
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
            let readStream: Streams.Readable = null;
            if (contents instanceof Buffer) {
                readStream = new Streams.Readable();
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                readStream._read = (): void => { };
                readStream.push(contents);
                readStream.push(null);
            } else if (contents instanceof Streams.Readable) {
                readStream = contents;
            }

            if (readStream) {
                promise = new Promise((resolve, reject) => {
                    readStream
                        .pipe(writeStream)
                        .on("error", (err) => reject(this.parseException(err)))
                        .on("finish", resolve);
                    writeStream.on("error", reject);
                });
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

    public async getFileStream(bucket: IBucket<any, any>, fileName: string | IStorageFile, options?: GetFileOptions): Promise<StorageResponse<Streams.Readable, FileSystemNativeResponse>> {
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



    public async copyFile<RType extends string | IStorageFile = IStorageFile>(bucket: IBucket<any, any>, src: string | IStorageFile, dest: string | IStorageFile, options?: CopyFileOptions): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        await this.makeReady();
        this.checkReadPermission(bucket);

        try {
            // parse paths
            src = this.resolveBucketPath(bucket, src, false);
            this.isFileOrTrow(src, 'src');

            // resolved uri
            const destResolvedUri = this.resolveFileUri(bucket, dest, true);
            this.checkWritePermission(destResolvedUri.bucket);
            dest = this.makeSlug(this.getFilenameFromFile(destResolvedUri.path));
            // if the dest is a directory, join the file to the dest
            if (this.isDirectory(this.getFilenameFromFile(dest))) {
                dest = joinPath(dest, this.extractFilenameFromPath(src));
                this.isFileOrTrow(dest, 'dest');
            }

            // get the complete filepath of the dest
            const completeDest = this.resolveBucketPath(destResolvedUri.bucket, dest);
            // check or create that the directory exists
            await this.ensureDirExists(this.extractDirectoryFromPath(completeDest));
            // copy the file
            await fs.promises.copyFile(src, completeDest);

            if (this.shouldReturnObject(options?.returning)) {
                return this.makeResponse(await this.generateFileObject(destResolvedUri.bucket, dest));
            }
            return this.makeResponse(this.storage.makeFileUri(this, destResolvedUri.bucket, dest));
        } catch (ex) {
            this.parseException(ex);
        }

    }

    public async moveFile<RType extends IStorageFile | string = IStorageFile>(bucket: IBucket<any, any>, src: string | IStorageFile, dest: string | IStorageFile, options?: MoveFileOptions): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        await this.makeReady();
        this.checkReadPermission(bucket);
        try {
            // parse paths
            src = this.resolveBucketPath(bucket, src, false);
            this.isFileOrTrow(src, 'src');

            // resolved uri
            const destResolvedUri = this.resolveFileUri(bucket, dest, true);
            this.checkWritePermission(destResolvedUri.bucket);
            dest = this.makeSlug(this.getFilenameFromFile(destResolvedUri.path));
            // if the dest is a directory, join the file to the dest
            if (this.isDirectory(this.getFilenameFromFile(dest))) {
                dest = joinPath(dest, this.extractFilenameFromPath(src));
                this.isFileOrTrow(dest, 'dest');
            }

            // get the complete filepath of the dest
            const completeDest = this.resolveBucketPath(destResolvedUri.bucket, dest);
            // check or create that the directory exists
            await this.ensureDirExists(this.extractDirectoryFromPath(completeDest));
            // copy the file
            await fs.promises.rename(src, completeDest);

            // cleanup empty dirs
            if (this.shouldCleanupDirectory(bucket, options?.cleanup)) {
                await this.cleanDirectories(this.extractDirectoryFromPath(src));
            }

            if (this.shouldReturnObject(options?.returning)) {
                return this.makeResponse(await this.generateFileObject(destResolvedUri.bucket, dest));
            }
            return this.makeResponse(this.storage.makeFileUri(this, destResolvedUri.bucket, dest));


        } catch (ex) {
            this.parseException(ex);
        }
    }


    public async removeEmptyDirectories(bucket: IBucket, basePath = ''): Promise<StorageResponse<boolean, FileSystemNativeResponse>> {
        await this.makeReady();
        try {
            const absPath = this.resolveBucketPath(bucket, basePath);
            await this.cleanDirectories(absPath);
            return this.makeResponse(true);
        } catch (ex) {
            this.parseException(ex);
        }
    }

    public getNativePath(bucket: IBucket, fileName: string | IStorageFile): string {
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

    protected async generateList(dir: string, base: string, options: ListFilesOptions, type: 'DIRECTORY' | 'FILE' | 'BOTH' = 'FILE', bucket: IBucket, metaGenerator: (path: string, bucket: IBucket) => Promise<IFileMeta | IStorageFile>, all: any[] = []) {
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

    protected async generateFileMeta(src: string, bucket?: IBucket): Promise<IFileMeta | undefined> {
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
            nativeAbsolutePath: src,
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

    protected async generateFileObject(bucket: IBucket, src: string | IStorageFile, meta?: IFileMeta): Promise<IStorageFile | undefined> {
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

    protected getBucketRootPath(bucket: IBucket) {
        return this.extractBucketOptions(bucket).root || bucket.name;
    }

    /**
     * Obtains a full path of the bucket + dir
     * @param bucket the target bucket
     * @param dir the path
     */
    protected resolveBucketPath(bucket: IBucket, dir?: string | IStorageFile, allowCrossBucket = false): string {
        const resolved = this.resolveFileUri(bucket, dir, allowCrossBucket);
        return joinPath(this.config.root, this.getBucketRootPath(resolved.bucket), this.normalizePath(resolved.path) || '/').replace(/\\/g, '/');
    }

    protected convertAbsolutePathToBucketPath(bucket: IBucket, dir?: string) {
        const bucketPath = this.resolveBucketPath(bucket);
        return dir.replace(bucketPath, '');
    }

}