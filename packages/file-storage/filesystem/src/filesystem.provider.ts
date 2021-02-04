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
    DeleteDirectoryOptions
} from "@bigbangjs/file-storage";

export type FileSystemProviderConfig = {
    root?: string;
} & ProviderConfigOptions;

const defaultConfig: FileSystemProviderConfig = {
    //root: path.join(process.cwd(), 'storage')
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


    protected parseException(ex: Error, type: StorageExceptionType = StorageExceptionType.NATIVE_ERROR) {
        if (ex instanceof StorageException) {
            throw ex;
        }
        throw new StorageException(type, ex.message, ex);
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

    public async addBucket(name: string, config?: FileSystemBucketConfig): Promise<StorageResponse<IBucket, FileSystemNativeResponse>> {
        await this.makeReady();
        this.emit(StorageEventType.BEFORE_ADD_BUCKET, config);
        const alias = await this.storage.resolveBucketAlias(name, this);
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
    public async listUnregisteredBuckets(creationOptions?: BucketConfigOptions): Promise<StorageResponse<FileSystemBucketConfig[], FileSystemNativeResponse>> {
        await this.makeReady();
        try {
            const options = Object.assign({}, {
                mode: '0777'
            }, creationOptions);
            const ret: FileSystemBucketConfig[] = [];
            const registerdBuckets = (await this.listBuckets()).result;
            const allBuckets = (await fs.readdir(this.config.root, { withFileTypes: true })).filter((v) => {
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

    public async makeDirectory<RType extends IDirectory | boolean = any>(bucket: IBucket, path: string | IDirectory, options?: CreateDirectoryOptions): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        await this.makeReady();
        try {
            const completeDir = this.resolveBucketPath(bucket, path);
            await fs.mkdir(completeDir, {
                mode: options?.permissions,
                recursive: true,
            });

            if (options?.returning) {
                return this.makeResponse(await this.generateFileObject(bucket, path));
            }
            return this.makeResponse(true);
        } catch (ex) {
            this.parseException(ex);
        }
    }

    public async deleteDirectory(bucket: IBucket<FileSystemNativeResponse>, dir: string | IDirectory, options?: DeleteDirectoryOptions): Promise<StorageResponse<boolean, FileSystemNativeResponse>> {
        await this.makeReady();
        try {
            const completeDir = this.resolveBucketPath(bucket, dir);
            const dirStr = typeof (dir) === 'string' ? dir : dir.getAbsolutePath();
            if (options?.pattern || options?.filter) {
                const pattern = (typeof (options.pattern) === 'string') ? path.join(dirStr, options.pattern) : options.pattern;
                const toDelete = (await this.listDirectories(bucket, dir, {
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

    public async moveDirectory<RType extends IDirectory | boolean = any>(bucket: IBucket<FileSystemNativeResponse>, src: string, dest: string, options?: MoveDirectoryOptions): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        await this.makeReady();
        try {
            const srcPath = this.resolveBucketPath(bucket, src);
            const destPath = this.resolveBucketPath(bucket, dest);
            options = options || { overwrite: false }
            await fs.move(srcPath, destPath, options);

            if (options?.returning) {
                //if the src is an object, keep the reference
                const fileInfo = await this.generateFileObject(bucket, dest);
                let ret = fileInfo;
                if (typeof (src) === 'object') {
                    Object.assign(src, fileInfo);
                    ret = src;
                }

                return this.makeResponse(ret)
            }

            return this.makeResponse(true);
        } catch (ex) {
            this.parseException(ex);
        }
    }

    public async copyDirectory<RType extends IDirectory | boolean = any>(bucket: IBucket<FileSystemNativeResponse>, src: string, dest: string, options?: CopyDirectoryOptions): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        await this.makeReady();
        try {
            const srcPath = this.resolveBucketPath(bucket, src);
            const destPath = this.resolveBucketPath(bucket, dest);
            await fs.copy(srcPath, destPath, {
                overwrite: options?.overwrite,
                filter: options?.filter,
            });

            if (options?.returning) {
                return this.makeResponse(await this.generateFileObject(bucket, dest));
            }

            return this.makeResponse(true);
        } catch (ex) {
            this.parseException(ex);
        }
    }

    public async listDirectories<RType extends ListResult<any>>(bucket: IBucket<any, any>, path: string | IDirectory, options?: DirectoryListOptions): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        options = options || {};
        (options as FileEntryListOptions).type = 'DIRECTORY';
        return this.list(bucket, path, options as FileEntryListOptions);
    }

    public async exists<RType extends IFileEntry | boolean = any>(bucket: IBucket, path: string, returning?: boolean): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        await this.makeReady();
        try {
            const info = await this.generateFileObject(bucket, path);
            if (returning) {
                return this.makeResponse(info);
            }
            return this.makeResponse(!objectNull(info));
        } catch (ex) {
            this.parseException(ex);
        }
    }

    public async listFiles<RType extends ListResult<any>>(bucket: IBucket<any, any>, path: string | IDirectory, options?: FileListOptions): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        options = options || {};
        (options as FileEntryListOptions).type = 'FILE';
        return this.list(bucket, path, options as FileEntryListOptions);
    }

    public async list<RType extends ListResult<any>>(bucket: IBucket, path: string | IDirectory, options?: FileEntryListOptions): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        await this.makeReady();
        try {
            const completePath = this.resolveBucketPath(bucket);
            const fileObjectGenerator = async (path: string) => {
                path = this.convertAbsolutePathToBucketPath(bucket, path);
                const result = await this.generateFileObject(bucket, path);
                if (!result) {
                    this.storage.log('warn', path);
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
                this.storage.log('warn', `Invalid glob pattern ${pattern}`);
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

    public async putFile<RType extends boolean | IFile = any>(bucket: IBucket<any, any>, filename: string | IFile, contents: string | Buffer | Streams.Readable, options?: CreateFileOptions): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    public async getFileStream(bucket: IBucket<any, any>, filename: string | IFile, options?: GetFileOptions): Promise<StorageResponse<Streams.Readable, FileSystemNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    public async getFileContents(bucket: IBucket<any, any>, filename: string | IFile, options?: GetFileOptions): Promise<StorageResponse<Buffer, FileSystemNativeResponse>> {
        throw new Error('Method not implemented.');
    }


    protected makeUri(path: string, bucket?: IBucket) {
        return `${this.name}://${bucket.name}/${path}`;
    }


    protected async generateFileMeta(src: string, bucket?: IBucket): Promise<IDirectoryMeta | IFileMeta | undefined> {
        await this.makeReady();
        let stats, meta, relativePath;
        try {
            stats = await fs.stat(src);
        } catch (ex) {
            //this.storage.log('error', ex);
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
                name: srcParts.slice().reverse()[0],
                absolutePath: src,
                nativeMeta: stats,
                type: 'DIRECTORY',
                createdAt: stats.birthtime,
                updatedAt: stats.mtime,
                uri: this.makeUri(relativePath, bucket),
                exists: true
            } as IDirectoryMeta;
        } else {
            const mime = typeof (this.storage.config.mimeFn) === 'function' ? await this.storage.config.mimeFn(src) : 'unknown';
            meta = {
                path: path,
                name: relativePathParts.slice().reverse()[0],
                absolutePath: src,
                nativeMeta: stats,
                type: 'FILE',
                createdAt: stats.birthtime,
                updatedAt: stats.mtime,
                size: stats.size,
                uri: this.makeUri(relativePath, bucket),
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

        if (typeof (src) === 'string') {
            return ret;
        } else {
            ret = src;
            src.bucket = bucket;
            src.meta = meta;
            return ret;
        }
    }

    protected normalizePath(dir?: string): string {
        if (!dir) {
            return '/';
        }
        return path.normalize(dir).replace(/\\/g, '');
    }

    protected getBucketPath(bucket: IBucket) {
        return this.extractBucketOptions(bucket).root || bucket.name;
    }

    protected resolveBucketPath(bucket: IBucket, dir?: string | IFileEntry) {
        dir = dir || '/';
        dir = typeof (dir) === 'string' ? dir : dir.getAbsolutePath();
        return this.resolvePath(path.join(this.getBucketPath(bucket), dir || ''));
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