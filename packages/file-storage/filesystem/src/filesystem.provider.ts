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
    IFile,
    File,
    IFileMeta,
    IStorageProvider,
    ProviderConfigOptions,
    StorageEventType,
    StorageException,
    StorageExceptionType,
    StorageResponse,
    stringNullOrEmpty,
    objectNull,
    Streams,
    CreateFileOptions,
    GetFileOptions,
    ListFilesOptions,
    ListResult,
    Pattern,
    MoveFileOptions,
    DeleteManyFilesOptions,

} from "@bigbangjs/file-storage";

export type FileSystemProviderConfig = {
    root?: string;
} & ProviderConfigOptions;

const defaultConfig: FileSystemProviderConfig = {
    root: path.join(process.cwd(), 'storage')
};

export type FileSystemBucketConfig = {
    root: string;
} & BucketConfigOptions;

export type FileSystemNativeResponse = {

}

export class FilesystemProvider extends AbstractProvider<FileSystemProviderConfig, FileSystemBucketConfig, FileSystemNativeResponse> implements IStorageProvider<FileSystemBucketConfig, FileSystemNativeResponse>{

    public readonly type: string = 'FILESYSTEM';
    constructor(storage: FileStorage, name: string, config: string | FileSystemProviderConfig = defaultConfig) {
        super(storage, name, config);
        this.validateOptions();
    }

    protected validateOptions() {
        if (stringNullOrEmpty(this.config.root)) {
            throw new StorageException(StorageExceptionType.INVALID_PARAMS, `The root path must be provided [${this.name}]!`);
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
            ret.root = path.resolve(path.normalize(path.join(parsedUrl.hostname, parsedUrl.pathname)));
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
            await fs.promises.mkdir(path.join(this.config.root, config.root), { recursive: true });
            this._buckets.add(name, bucket);
            this.emit(StorageEventType.BUCKET_ADDED, bucket);
            return this.makeResponse(bucket);
        } catch (ex) {
            const error = new StorageException(StorageExceptionType.NATIVE_ERROR, ex.message, ex);
            this.emit(StorageEventType.BUCKET_ADD_ERROR, error);
            throw error;
        }
    }

    public async destroyBucket(b: string | IBucket): Promise<StorageResponse<boolean, FileSystemNativeResponse>> {
        await this.makeReady();
        const name = typeof (b) === 'string' ? b : b.name;
        if (!this._buckets.has(name)) {
            throw new StorageException(StorageExceptionType.NOT_FOUND, `Bucket ${name} not found in this adapter!`, { name: name });
        }

        try {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const bucket = this._buckets.get(name)!;
            this.emit(StorageEventType.BEFORE_DESTROY_BUCKET, bucket);
            this._buckets.remove(name);
            await fs.promises.rmdir(this.resolveBucketPath(bucket));
            this.emit(StorageEventType.BUCKET_DESTROYED, bucket);
            return this.makeResponse(true);
        } catch (ex) {
            const error = new StorageException(StorageExceptionType.NATIVE_ERROR, ex.message, ex);
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

    public async deleteFile(bucket: IBucket<FileSystemNativeResponse>, dir: string | IFile, options?: DeleteFileOptions): Promise<StorageResponse<boolean, FileSystemNativeResponse>> {
        await this.makeReady();
        if (!bucket.canWrite()) {
            throw new StorageException(StorageExceptionType.PERMISSION_ERROR, `Cannot write on bucket ${bucket.name}!`);
        }
        try {
            dir = this.resolveFileUri(bucket, dir);
            const info = await this.generateFileObject(bucket, dir);
            if (info) {
                const completeDir = this.resolveBucketPath(bucket, dir);
                await fs.promises.unlink(completeDir);
                if (this.shouldCleanupDirectory(bucket, options?.cleanup)) {
                    const parts = completeDir.split('/');
                    await this.cleanDirectories(parts.splice(0, parts.length - 1).join('/'));
                }
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

    public async deleteFiles(bucket: IBucket<any, any>, src: string, pattern: Pattern, options?: DeleteManyFilesOptions): Promise<StorageResponse<boolean, FileSystemNativeResponse>> {
        await this.makeReady();
        if (!bucket.canWrite()) {
            throw new StorageException(StorageExceptionType.PERMISSION_ERROR, `Cannot write on bucket ${bucket.name}!`);
        }
        try {
            src = this.resolveFileUri(bucket, src);
            const toDelete = (await this.listFiles(bucket, src, { pattern, recursive: true, returning: false })).result;
            const promises: Promise<StorageResponse<boolean, FileSystemNativeResponse>>[] = [];
            toDelete.entries.map(c => {
                promises.push(this.deleteFile(bucket, c, {
                    cleanup: false // avoid cleanup
                }));
            });
            await Promise.all(promises);
            if (this.shouldCleanupDirectory(bucket, options?.cleanup)) {
                await this.cleanDirectories(this.resolveBucketPath(bucket, src));
            }
            return this.makeResponse(true);
        } catch (ex) {
            this.parseException(ex);
        }
    }



    public async fileExists<RType extends boolean | IFile = any>(bucket: IBucket<any, any>, path: string | IFile, returning?: boolean): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        await this.makeReady();
        if (!bucket.canRead()) {
            throw new StorageException(StorageExceptionType.PERMISSION_ERROR, `Cannot read on bucket ${bucket.name}!`);
        }
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

    public async listFiles<RType extends string[] | IFile[] = IFile[]>(bucket: IBucket<any, any>, path: string, options?: ListFilesOptions): Promise<StorageResponse<ListResult<RType>, FileSystemNativeResponse>> {
        await this.makeReady();
        if (!bucket.canRead()) {
            throw new StorageException(StorageExceptionType.PERMISSION_ERROR, `Cannot read on bucket ${bucket.name}!`);
        }
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

    public async putFile<RType extends string | IFile = any>(bucket: IBucket<any, any>, fileName: string | IFile, contents: string | Buffer | Streams.Readable, options?: CreateFileOptions): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        await this.makeReady();

        fileName = this.resolveFileUri(bucket, fileName);
        const absPath = this.resolveBucketPath(bucket, fileName);

        if (!bucket.canWrite()) {
            throw new StorageException(StorageExceptionType.PERMISSION_ERROR, `Cannot write on bucket ${bucket.name}!`);
        }

        if (options?.overwrite === false) {
            const exists = (await this.fileExists(bucket, fileName, false)).result;
            if (exists) {
                const fName = this.getFilenameFromFile(fileName);
                throw new StorageException(StorageExceptionType.DUPLICATED_ELEMENT, `The file ${fName} already exists!`);
            }
        }

        try {
            // ensure directory
            await this.ensureDirExists(absPath);

            const writeStream = fs.createWriteStream(absPath, { flags: 'w' });
            let readStream: Streams.Readable = null;
            let promise = null;
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
                promise = fs.promises.writeFile(absPath, contents.toString(), { flag: 'w' });
            }

            let ret: any = this.storage.makeFileUri(this, bucket, this.convertAbsolutePathToBucketPath(bucket, absPath));
            if (this.shouldReturnObject(options?.returning)) {
                ret = await this.generateFileObject(bucket, fileName);

            }
            return this.makeResponse(ret);
        } catch (ex) {
            this.parseException(ex);
        }
    }

    public async getFileStream(bucket: IBucket<any, any>, fileName: string | IFile, options?: GetFileOptions): Promise<StorageResponse<Streams.Readable, FileSystemNativeResponse>> {

        if (!bucket.canRead()) {
            throw new StorageException(StorageExceptionType.PERMISSION_ERROR, `Cannot read on bucket ${bucket.name}!`);
        }
        fileName = this.resolveFileUri(bucket, fileName);
        const absPath = this.resolveBucketPath(bucket, fileName);
        const result = fs.createReadStream(absPath, {
            start: options?.start,
            end: options?.end
        });
        return this.makeResponse(result);
    }

    public async copyFile<RType extends string | IFile = IFile>(bucket: IBucket<any, any>, src: string | IFile, dest: string | IFile, options?: CopyFileOptions): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        await this.makeReady();

        if (!bucket.canWrite()) {
            throw new StorageException(StorageExceptionType.PERMISSION_ERROR, `Cannot write on bucket ${bucket.name}!`);
        }

        try {
            src = this.resolveFileUri(bucket, src);
            dest = this.resolveFileUri(bucket, dest);
            const srcPath = this.resolveBucketPath(bucket, src);
            const destPath = this.resolveBucketPath(bucket, dest);
            await this.ensureDirExists(destPath);

            await fs.promises.copyFile(srcPath, destPath);
            if (this.shouldReturnObject(options?.returning)) {
                return this.makeResponse(await this.generateFileObject(bucket, dest));
            }
            return this.makeResponse(this.storage.makeFileUri(this, bucket, this.convertAbsolutePathToBucketPath(bucket, dest)));
        } catch (ex) {
            this.parseException(ex);
        }

    }

    public async moveFile<RType extends IFile | string = IFile>(bucket: IBucket<any, any>, src: string | IFile, dest: string | IFile, options?: MoveFileOptions): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        await this.makeReady();
        if (!bucket.canWrite()) {
            throw new StorageException(StorageExceptionType.PERMISSION_ERROR, `Cannot write on bucket ${bucket.name}!`);
        }
        try {

            src = this.resolveFileUri(bucket, src);
            dest = this.resolveFileUri(bucket, dest);
            const srcAbsPath = this.resolveBucketPath(bucket, src);
            const destAbsPath = this.resolveBucketPath(bucket, dest);

            await this.ensureDirExists(destAbsPath);

            await fs.promises.rename(srcAbsPath, destAbsPath);

            if (this.shouldCleanupDirectory(bucket, options?.cleanup)) {
                const parts = srcAbsPath.split('/');
                await this.cleanDirectories(parts.slice(0, parts.length - 1).join('/'));
            }

            if (this.shouldReturnObject(options?.returning)) {
                return this.makeResponse(await this.generateFileObject(bucket, dest));
            }
            return this.makeResponse(this.storage.makeFileUri(this, bucket, this.convertAbsolutePathToBucketPath(bucket, dest)));

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

    protected async cleanDirectories(dir: string) {
        const stats = await fs.promises.stat(dir);
        if (!stats.isDirectory()) {
            return;
        }
        let fileNames = await fs.promises.readdir(dir);
        if (fileNames.length > 0) {
            const promises = fileNames.map(
                (fileName) => this.cleanDirectories(path.join(dir, fileName)),
            );
            await Promise.all(promises);
            fileNames = await fs.promises.readdir(dir);
        }

        if (fileNames.length === 0) {
            await fs.promises.rmdir(dir);
        }
    }

    protected async generateList(dir: string, base: string, options: ListFilesOptions, type: 'DIRECTORY' | 'FILE' | 'BOTH' = 'FILE', bucket: IBucket, metaGenerator: (path: string, bucket: IBucket) => Promise<IFileMeta | IFile>, all: any[] = []) {
        await this.makeReady();

        const absDir = this.normalizePath(path.join(base, dir));
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
                    const p = path.join(dir, f.name);
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
                return metaGenerator(path.join(dir, r.name), bucket);
            })));
            result.map(r => all.push(r));
        } else {
            result.map(r => {
                all.push(path.join(dir, r.name));
            });
        }
        if (options?.recursive) {
            await Promise.all(entries.filter(f => f.isDirectory()).map(async f => await this.generateList(path.join(dir, f.name), base, options, type, bucket, metaGenerator, all)));
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

    protected async generateFileObject(bucket: IBucket, src: string | IFile, meta?: IFileMeta): Promise<IFile | undefined> {
        await this.makeReady();
        const completeSrc = this.resolveBucketPath(bucket, src);
        let ret;
        meta = meta || await this.generateFileMeta(completeSrc, bucket);
        if (!meta) {
            return;
        }
        ret = new File(bucket, meta);
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

    protected getBucketPath(bucket: IBucket) {
        return this.extractBucketOptions(bucket).root || bucket.name;
    }

    /**
     * Obtains a full path of the bucket + dir
     * @param bucket the target bucket
     * @param dir the path
     */
    protected resolveBucketPath(bucket: IBucket, dir?: string | IFile) {
        if (typeof (dir) === 'string') {
            dir = this.resolveFileUri(bucket, dir);
        }
        if (objectNull(dir)) {
            dir = '/';
        }
        dir = typeof (dir) === 'string' ? dir : dir.getAbsolutePath();
        dir = stringNullOrEmpty(dir) ? '/' : dir;
        dir = path.join(this.getBucketPath(bucket), dir || '/');
        const ret = this.resolvePath(dir);
        return ret;
    }

    protected convertAbsolutePathToBucketPath(bucket: IBucket, dir?: string) {
        const bucketPath = this.resolveBucketPath(bucket);
        return dir.replace(bucketPath, '');
    }

    protected resolvePath(source: string | IFile): string {
        source = typeof (source) === 'string' ? source : source.getAbsolutePath();
        source = source ? this.normalizePath(source) : source;
        if (source.startsWith('/')) {
            source = source.substr(1);
        }
        if (!source) {
            return path.resolve(this.config.root);
        }
        return path.resolve(this.config.root, source);
    }


}