import path from 'path';
import fs from 'fs-extra';
import {
    AbstractProvider,
    Bucket,
    CreateDirectoryOptions,
    IStorageProvider,
    IBucket,
    IDirectory,
    MoveDirectoryOptions,
    FileStorage,
    StorageException,
    ProviderConfigOptions,
    BucketConfigOptions,
    CopyDirectoryOptions,
    StorageResponse,
    objectNull,
    StorageExceptionType,
    StorageEventType,
    IFileEntry,
    IDirectoryMeta,
    IFileMeta,
    Directory,
    File,
    stringNullOrEmpty,
    ListResult,
    DirectoryListOptions,
    FileEntryListOptions,
    FileEntryMeta,
    FileListOptions,
    Streams,
    CreateFileOptions,
    GetFileOptions,
    IFile,
    DeleteFileEntryOptions,
    CopyFileOptions
} from "@bigbangjs/file-storage";

export type S3ProviderConfig = {
    root?: string;
} & ProviderConfigOptions;

const defaultConfig: S3ProviderConfig = {
    //root: path.join(process.cwd(), 'storage')
};

export type S3BucketConfig = {
    root: string;
} & BucketConfigOptions;

export type FileSystemNativeResponse = {

}

export class S3Provider extends AbstractProvider<S3ProviderConfig, S3BucketConfig, FileSystemNativeResponse> implements IStorageProvider<S3BucketConfig, FileSystemNativeResponse>{

    public readonly type: string = 'S3';
    constructor(storage: FileStorage, name: string, config: string | S3ProviderConfig = defaultConfig) {
        super(storage, name, config);
        this.validateOptions();
    }

    protected validateOptions() {
        if (stringNullOrEmpty(this.config.root)) {
            throw new StorageException(StorageExceptionType.INVALID_PARAMS, `The root path must be provided [${this.name}]!`);
        }
    }

    protected parseConfig(config: string | S3ProviderConfig): S3ProviderConfig {
        const ret = {};
        if (typeof (config) === 'string') {
            Object.assign(ret, defaultConfig, S3Provider.parseUriToOptions(config));
        } else {
            Object.assign(ret, defaultConfig, config);
            if (typeof (config.uri) === 'string') {
                Object.assign(ret, S3Provider.parseUriToOptions(config.uri));
            }
        }
        return ret as S3ProviderConfig;
    }


    protected parseException(ex: Error, type: StorageExceptionType = StorageExceptionType.NATIVE_ERROR) {
        if (ex instanceof StorageException) {
            throw ex;
        }
        throw new StorageException(type, ex.message, ex);
    }

    public static parseUriToOptions(uri: string): S3ProviderConfig {
        const ret: S3ProviderConfig = defaultConfig;
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
            await fs.mkdir(this.config.root, {
                recursive: true
            });
            return this.makeResponse(true);
        } catch (ex) {
            this.parseException(ex);
        }
    }

    public async dispose(): Promise<StorageResponse<boolean, FileSystemNativeResponse>> {
        return this.makeResponse(true);
    }

    public async addBucket(name: string, config?: S3BucketConfig): Promise<StorageResponse<IBucket, FileSystemNativeResponse>> {
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
            await this.makeDirectory(bucket, '');
            this._buckets.add(name, bucket);
            this.emit(StorageEventType.BUCKET_ADDED, bucket);
            return this.makeResponse(bucket);
        } catch (ex) {
            const error = new StorageException(StorageExceptionType.NATIVE_ERROR, ex.message, ex);
            this.emit(StorageEventType.BUCKET_ADD_ERROR, error);
            throw error;
        }
    }

    public async destroyBucket(name: string): Promise<StorageResponse<boolean, FileSystemNativeResponse>> {
        await this.makeReady();
        if (!this._buckets.has(name)) {
            throw new StorageException(StorageExceptionType.NOT_FOUND, `Bucket ${name} not found in this adapter!`, { name: name });
        }

        try {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const bucket = this._buckets.get(name)!;
            this.emit(StorageEventType.BEFORE_DESTROY_BUCKET, bucket);
            this._buckets.remove(name);
            await fs.rmdir(this.resolveBucketPath(bucket));
            this.emit(StorageEventType.BUCKET_DESTROYED, bucket);
            return this.makeResponse(true);
        } catch (ex) {
            const error = new StorageException(StorageExceptionType.NATIVE_ERROR, ex.message, ex);
            this.emit(StorageEventType.BUCKET_DESTROY_ERROR, error);
            throw error;
        }
    }


    public async listUnregisteredBuckets(creationOptions?: BucketConfigOptions): Promise<StorageResponse<S3BucketConfig[], FileSystemNativeResponse>> {
        await this.makeReady();
        try {
            const options = Object.assign({}, {
                mode: '0777'
            }, creationOptions);
            const ret: S3BucketConfig[] = [];
            const registerdBuckets = (await this.listBuckets()).result;
            const allBuckets = (await fs.readdir(this.config.root, { withFileTypes: true })).filter((v) => {
                return v.isDirectory();
            });
            allBuckets.map(f => {
                const candidate = registerdBuckets.filter(b => (b.config as S3BucketConfig).root === f.name).length === 0;
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

    public async makeDirectory<RType extends IDirectory | string = any>(bucket: IBucket, path: string | IDirectory, options?: CreateDirectoryOptions): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        await this.makeReady();
        try {
            const completeDir = this.resolveBucketPath(bucket, path);
            await fs.mkdir(completeDir, {
                mode: options?.permissions,
                recursive: true,
            });

            if (this.shouldReturnObject(options?.returning)) {
                return this.makeResponse(await this.generateFileObject(bucket, path));
            }
            return this.makeResponse(this.storage.makeFileUri(this, bucket, this.convertAbsolutePathToBucketPath(bucket, completeDir)));
        } catch (ex) {
            this.parseException(ex);
        }
    }

    public async delete(bucket: IBucket<FileSystemNativeResponse>, dir: string | IFileEntry, options?: DeleteFileEntryOptions): Promise<StorageResponse<boolean, FileSystemNativeResponse>> {
        await this.makeReady();
        try {
            const info = await this.generateFileObject(bucket, dir);
            if (info) {
                const completeDir = this.resolveBucketPath(bucket, dir);
                const dirStr = typeof (dir) === 'string' ? dir : dir.getAbsolutePath();

                if (options?.pattern || options?.filter) {
                    const pattern = (typeof (options.pattern) === 'string') ? path.join(dirStr, options.pattern) : options.pattern;
                    const toDelete = (await this.list(bucket, dirStr, {
                        type: 'BOTH',
                        recursive: true,
                        pattern: pattern,
                        filter: options.filter,
                        returning: false,
                    })).result;
                    await Promise.all(toDelete.entries.map(async f => {
                        const p = path.join(completeDir, f.substr((dir as string).length));
                        await fs.remove(p);
                    }))
                } else {
                    await fs.remove(completeDir);
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

    public async emptyDirectory(bucket: IBucket<FileSystemNativeResponse>, dir: string): Promise<StorageResponse<boolean, FileSystemNativeResponse>> {
        await this.makeReady();
        try {
            const completeDir = this.resolveBucketPath(bucket, dir);
            if (await fs.stat(completeDir)) {
                await fs.emptyDir(completeDir);
            }
            return this.makeResponse(true);
        } catch (ex) {
            this.parseException(ex);
        }
    }

    public async moveDirectory<RType extends IDirectory | string = any>(bucket: IBucket<FileSystemNativeResponse>, src: string, dest: string, options?: MoveDirectoryOptions): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        await this.makeReady();
        try {
            const srcPath = this.resolveBucketPath(bucket, src);
            const destPath = this.resolveBucketPath(bucket, dest);
            options = options || { overwrite: false }
            await fs.move(srcPath, destPath, options);

            if (this.shouldReturnObject(options?.returning)) {
                //if the src is an object, keep the reference
                const fileInfo = await this.generateFileObject(bucket, dest);
                let ret = fileInfo;
                if (typeof (src) === 'object') {
                    Object.assign(src, fileInfo);
                    ret = src;
                }

                return this.makeResponse(ret)
            }

            return this.makeResponse(this.storage.makeFileUri(this, bucket, this.convertAbsolutePathToBucketPath(bucket, destPath)));
        } catch (ex) {
            this.parseException(ex);
        }
    }

    public async copyDirectory<RType extends IDirectory | string = any>(bucket: IBucket<FileSystemNativeResponse>, src: string, dest: string, options?: CopyDirectoryOptions): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        await this.makeReady();
        try {
            const srcPath = this.resolveBucketPath(bucket, src);
            const destPath = this.resolveBucketPath(bucket, dest);
            await fs.copy(srcPath, destPath, {
                overwrite: options?.overwrite,
                filter: options?.filter,
            });

            if (this.shouldReturnObject(options?.returning)) {
                return this.makeResponse(await this.generateFileObject(bucket, dest));
            }

            return this.makeResponse(this.storage.makeFileUri(this, bucket, this.convertAbsolutePathToBucketPath(bucket, destPath)));
        } catch (ex) {
            this.parseException(ex);
        }
    }

    public async getFileEntry<Rtype extends IFileEntry = IFileEntry>(bucket: IBucket, path: string): Promise<StorageResponse<Rtype, FileSystemNativeResponse>> {
        const info = await this.generateFileObject(bucket, path);
        return this.makeResponse(info);
    }

    public async list<RType extends ListResult<any>>(bucket: IBucket, path: string | IDirectory, options?: FileEntryListOptions): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        await this.makeReady();
        try {
            const completePath = this.resolveBucketPath(bucket);
            const fileObjectGenerator = async (path: string) => {
                path = this.convertAbsolutePathToBucketPath(bucket, path);
                const result = await this.generateFileObject(bucket, path);
                if (!result) {
                    this.log('warn', path);
                }
                return result;
            }
            path = typeof (path) === 'string' ? path : path.path;
            if (stringNullOrEmpty(path)) {
                path = '/';
            }
            const entries = await this.generateList(path, completePath, options as FileEntryListOptions, fileObjectGenerator);
            const result = {
                entries
            }
            return this.makeResponse(result);
        } catch (ex) {
            this.parseException(ex);
        }
    }

    protected async generateList(dir: string, base: string, options: FileEntryListOptions, metaGenerator: (path: string) => Promise<IDirectoryMeta | IFileMeta | IFileEntry> = this.generateFileMeta, all: any[] = []) {
        await this.makeReady();

        const absDir = this.normalizePath(path.join(base, dir));
        const entries: fs.Dirent[] = await fs.readdir(absDir, { withFileTypes: true });
        let result = [];
        if (options?.type === 'DIRECTORY') {
            result = entries.filter(f => f.isDirectory());
        } else if (options?.type === 'FILE') {
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
            result = await Promise.all(result.filter(async f => await options.filter(f.name, dir, f.isDirectory() ? 'DIRECTORY' : 'FILE')))
        }


        if (undefined === options?.returning || options?.returning === true) {
            result = (await Promise.all(result.map(async r => {
                return metaGenerator(path.join(dir, r.name));
            })));
            result.map(r => all.push(r));
        } else {
            result.map(r => {
                all.push(path.join(dir, r.name));
            });
        }



        if (options?.recursive) {
            await Promise.all(entries.filter(f => f.isDirectory()).map(async f => await this.generateList(path.join(dir, f.name), base, options, metaGenerator, all)));
        }
        return all;

    }

    public async putFile<RType extends IFile | string = any>(bucket: IBucket, fileName: string | IFile, contents: string | Buffer | Streams.Readable, options?: CreateFileOptions): Promise<StorageResponse<RType, FileSystemNativeResponse>> {

        const absPath = this.resolveBucketPath(bucket, fileName);

        // ensure directory
        const parts = absPath.split('/');
        const file = parts.pop();
        await fs.mkdirs(this.normalizePath(parts.join('/')));

        const writeStream = fs.createWriteStream(absPath);
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
                    .on("error", reject)
                    .on("finish", resolve);
                writeStream.on("error", reject);
            });
        } else {
            promise = fs.writeFile(absPath, contents);
        }

        const result = await promise;
        let ret = result;
        if (this.shouldReturnObject(options?.returning)) {
            ret = this.generateFileObject(bucket, fileName);
        }
        return this.makeResponse(this.storage.makeFileUri(this, bucket, this.convertAbsolutePathToBucketPath(bucket, absPath)));
    }

    public async getFileStream(bucket: IBucket, fileName: string | IFile, options?: GetFileOptions): Promise<StorageResponse<Streams.Readable, FileSystemNativeResponse>> {
        const absPath = this.resolveBucketPath(bucket, fileName);
        const result = fs.createReadStream(absPath);
        return this.makeResponse(result);
    }

    public async getFileContents(bucket: IBucket, fileName: string | IFile, options?: GetFileOptions): Promise<StorageResponse<Buffer, FileSystemNativeResponse>> {
        const absPath = this.resolveBucketPath(bucket, fileName);
        const result = await fs.readFile(absPath);
        return this.makeResponse(result);
    }

    public async copyFile<RType extends string | IFile = any>(bucket: IBucket, src: string | IFile, dest: string | IFile, options?: CopyFileOptions): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        await this.makeReady();
        try {
            const srcPath = this.resolveBucketPath(bucket, src);
            const destPath = this.resolveBucketPath(bucket, dest);
            await fs.copy(srcPath, destPath, {
                overwrite: options?.overwrite
            });

            if (this.shouldReturnObject(options?.returning)) {
                return this.makeResponse(await this.generateFileObject(bucket, dest));
            }

            return this.makeResponse(this.storage.makeFileUri(this, bucket, this.convertAbsolutePathToBucketPath(bucket, destPath)));
        } catch (ex) {
            this.parseException(ex);
        }
    }

    public async moveFile<RType extends string | IFile = any>(bucket: IBucket, src: string | IFile, dest: string | IFile, options?: CopyFileOptions): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        await this.makeReady();
        try {
            const srcPath = this.resolveBucketPath(bucket, src);
            const destPath = this.resolveBucketPath(bucket, dest);
            await fs.move(srcPath, destPath, {
                overwrite: options?.overwrite
            });

            if (this.shouldReturnObject(options?.returning)) {
                return this.makeResponse(await this.generateFileObject(bucket, dest));
            }

            return this.makeResponse(this.storage.makeFileUri(this, bucket, this.convertAbsolutePathToBucketPath(bucket, destPath)));
        } catch (ex) {
            this.parseException(ex);
        }
    }



    protected async generateFileMeta(src: string, bucket?: IBucket): Promise<IDirectoryMeta | IFileMeta | undefined> {
        await this.makeReady();
        let stats, meta, relativePath;
        try {
            stats = await fs.stat(src);
        } catch (ex) {
            //this.log('error', ex);
            return;
        }

        if (bucket) {
            relativePath = this.convertAbsolutePathToBucketPath(bucket, src);
        } else {
            relativePath = src;
        }

        const srcParts = src.split('/');
        const relativePathParts = relativePath.split('/');
        let path = relativePathParts.slice(0, relativePathParts.length - 1).join('/');
        if (stringNullOrEmpty(path)) {
            path = '/';
        }
        if (stats.isDirectory()) {
            meta = {
                path: path,
                name: relativePathParts.slice().reverse()[0],
                nativeAbsolutePath: src,
                nativeMeta: stats,
                type: 'DIRECTORY',
                createdAt: stats.birthtime,
                updatedAt: stats.mtime,
                uri: this.getStorageUri(bucket, relativePath),
                exists: true
            } as IDirectoryMeta;
        } else {
            const mime = await this.getMime(src);
            meta = {
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
        }
        return meta;
    }

    protected async generateFileObject(bucket: IBucket, src: string | IFileEntry, meta?: FileEntryMeta): Promise<IFileEntry | undefined> {
        await this.makeReady();
        const completeSrc = this.resolveBucketPath(bucket, src);
        let ret;
        meta = meta || await this.generateFileMeta(completeSrc, bucket);
        if (!meta) {
            return;
        }
        if (meta.type === 'FILE') {
            ret = new File(bucket, meta);
        } else {
            ret = new Directory(bucket, meta);
        }
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

    protected getBucketPath(bucket: IBucket) {
        return this.extractBucketOptions(bucket).root || bucket.name;
    }

    protected resolveBucketPath(bucket: IBucket, dir?: string | IFileEntry) {
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

    protected resolvePath(source: string | IFileEntry): string {
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