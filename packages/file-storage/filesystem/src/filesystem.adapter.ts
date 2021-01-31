import path from 'path';
import fs from 'fs-extra';
import Streams from "stream";
import {
    AbstractProvider,
    Bucket,
    CreateBucketOptions,
    CreateDirectoryOptions,
    CreateFileOptions,
    IStorageProvider,
    IBucket,
    IFileInfo,
    ListOptions,
    MoveDirectoryOptions,
    octalToString,
    FileStorage,
    StorageException,
    BEFORE_ADD_BUCKET,
    BUCKET_ADDED,
    BUCKET_ADD_ERROR,
    BEFORE_REMOVE_BUCKET,
    BUCKET_REMOVED,
    BUCKET_REMOVE_ERROR,
    StorageExceptionType,
    BEFORE_DESTROY_BUCKET,
    BUCKET_DESTROYED,
    BUCKET_DESTROY_ERROR
} from "@bigbangjs/file-storage-core";

export type FileSystemProviderConfig = {
    root: string;
    mode?: string;
    name?: string;
}

const defaultConfig: FileSystemProviderConfig = {
    root: path.join(process.cwd(), 'storage'),
    name: 'filesystem',
}

export type FileSystemBucketConfig = {
    name?: string,
    root?: string;
    mode?: string | number
}

export class FilesystemProvider extends AbstractProvider<FileSystemProviderConfig, FileSystemBucketConfig> implements IStorageProvider<FileSystemBucketConfig>{
    public readonly type: string = 'FILESYSTEM';
    constructor(storage: FileStorage, config: string | FileSystemProviderConfig = defaultConfig) {
        super(storage, config);
    }


    protected parseConfig(config: string | FileSystemBucketConfig): FileSystemProviderConfig {
        const ret = {};
        if (typeof (config) === 'string') {
            Object.assign(ret, defaultConfig, FilesystemProvider.parseUriToOptions(config));
        } else {
            Object.assign(ret, defaultConfig, config);
        }
        return ret as FileSystemProviderConfig;
    }

    public static parseUriToOptions(uri: string): FileSystemProviderConfig {
        const ret: FileSystemProviderConfig = defaultConfig;
        const parsedUrl = new URL(uri);

        if (parsedUrl.searchParams.has('name')) {
            ret.name = parsedUrl.searchParams.get('name') || 'default';
        }

        if (parsedUrl.searchParams.has('mode')) {
            ret.mode = parsedUrl.searchParams.get('mode') || '0777';
        }

        if (parsedUrl.hostname || parsedUrl.pathname) {
            ret.root = path.resolve(path.normalize(path.join(parsedUrl.hostname, parsedUrl.pathname)));
        }
        return ret;
    }

    public async dispose(): Promise<void> {
        // nothing to do here 😉
    }

    public async init(): Promise<void> {
        try {
            await fs.mkdir(this.config.root, {
                recursive: true
            });
        } catch (ex) {
            throw new StorageException(ex.message, ex);
        }
    }

    public async getBucket(name = 'default'): Promise<IBucket | undefined> {
        if (!this._buckets.has(name)) {
            throw new StorageException(StorageExceptionType.NOT_FOUND, `Bucket ${name} not found in this adapter!`, { name: name });
        }
        return this._buckets.get(name);
    }

    public async addBucket(name: string, options: FileSystemBucketConfig): Promise<IBucket> {
        this.emit(BEFORE_ADD_BUCKET, options);
        this.ensureBucketNotRegistered(name);
        try {
            options = Object.assign({}, {
                root: name,
                mode: '0777'
            }, options || {});
            const bucket = new Bucket(this, name, options);
            await this.makeDirectory(bucket, '');
            this._buckets.add(name, bucket);
            this.emit(BUCKET_ADDED, bucket);
            return bucket;
        } catch (ex) {
            const error = new StorageException(ex);
            this.emit(BUCKET_ADD_ERROR, error);
            throw error;
        }
    }

    public async removeBucket(name: string): Promise<void> {
        if (!this._buckets.has(name)) {
            return;
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const bucket = this._buckets.get(name)!;
        this.emit(BEFORE_REMOVE_BUCKET, bucket);
        this._buckets.remove(name);
        this.emit(BUCKET_REMOVED, bucket);
    }

    public async destroyBucket(name: string): Promise<void> {
        try {
            if (!this._buckets.has(name)) {
                throw new StorageException(StorageExceptionType.NOT_FOUND, `Bucket ${name} not found in this adapter!`, { name: name });
            }
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const bucket = this._buckets.get(name)!;
            this.emit(BEFORE_DESTROY_BUCKET, bucket);
            this._buckets.remove(name);
            await fs.rmdir(this.resolveBucketPath(bucket));
            this.emit(BUCKET_DESTROYED, bucket);
        } catch (ex) {
            const error = new StorageException(ex);
            this.emit(BUCKET_DESTROY_ERROR, error);
            throw error;
        }

    }

    public async listBuckets(): Promise<IBucket[]> {
        return this._buckets.list();
    }

    public async listUnregisteredBuckets(creationOptions?: CreateBucketOptions): Promise<FileSystemBucketConfig[]> {
        const options = Object.assign({}, {
            mode: '0777'
        }, creationOptions);
        const ret: FileSystemBucketConfig[] = [];
        const registerdBuckets = await this.listBuckets();
        const allBuckets = await fs.readdir(this.config.root);
        await Promise.all(allBuckets.map(async f => {
            const candidate = registerdBuckets.filter(b => b.config.root === f).length === 0;
            if (candidate) {
                const stats = await fs.stat(path.join(this.config.root, f));
                if (stats.isDirectory()) {
                    ret.push({
                        root: f,
                        mode: options.mode
                    })
                }
            }
        }))

        return ret;
    }



    // bucket api
    public async makeDirectory(bucket: IBucket, dir: string, options: CreateDirectoryOptions = {
        permissions: "0777",
        returning: false
    }): Promise<boolean | IFileInfo> {
        try {
            const completeDir = this.resolveBucketPath(bucket, dir);
            await fs.mkdir(completeDir, {
                mode: options?.permissions,
                recursive: true,
            });

            if (options.returning) {
                return await this.generateFileInfo(bucket, dir);
            }

            return true;
        } catch (ex) {
            throw new StorageException(ex.message, ex);
        }
    }

    public async deleteDirectory(bucket: IBucket, dir: string): Promise<boolean> {
        try {
            dir = this.resolveBucketPath(bucket, dir);
            await fs.remove(dir);
            return true;
        } catch (ex) {
            throw new StorageException(ex.message, ex);
        }
    }


    public async emptyDirectory(bucket: IBucket, dir: string): Promise<boolean> {
        try {
            const completeDir = this.resolveBucketPath(bucket, dir);
            if (await fs.stat(dir)) {
                await fs.remove(dir);
            }
            return true;
        } catch (ex) {
            throw new StorageException(ex.message, ex);
        }
    }

    public async moveDirectory(bucket: IBucket, src: string, dest: string, options?: MoveDirectoryOptions): Promise<boolean> {
        try {
            src = this.resolveBucketPath(bucket, src);
            dest = this.resolveBucketPath(bucket, dest);
            await fs.move(src, dest, options);
            return true;
        } catch (ex) {
            throw new StorageException(ex.message, ex);
        }
    }
    copyDirectory(bucket: IBucket, src: string, dest: string): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    directoryExists(bucket: IBucket, dir: string): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    listDirectories(bucket: IBucket, dir: string, recursive?: boolean, pattern?: string): Promise<IFileInfo[]> {
        throw new Error("Method not implemented.");
    }
    fileExists(bucket: IBucket, dir: string): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    exists(bucket: IBucket, filenameOrDir: string): Promise<string | boolean> {
        throw new Error("Method not implemented.");
    }
    list(bucket: IBucket, dir: string, recursive?: boolean, pattern?: string, config?: ListOptions): Promise<IFileInfo[]> {
        throw new Error("Method not implemented.");
    }
    listFiles(bucket: IBucket, dir: string, recursive?: boolean, pattern?: string): Promise<IFileInfo[]> {
        throw new Error("Method not implemented.");
    }
    putFile(bucket: IBucket, filename: string, contents: string | Buffer | Streams.Readable, options?: CreateFileOptions): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    getFile(bucket: IBucket, filename: string): Promise<Buffer> {
        throw new Error("Method not implemented.");
    }
    getFileStream(bucket: IBucket, filename: string): Promise<Streams.Readable> {
        throw new Error("Method not implemented.");
    }
    copyFile(bucket: IBucket, src: string, dest: string): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    moveFile(bucket: IBucket, src: string, dest: string): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    deleteFile(bucket: IBucket, filename: string): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    deleteFiles(bucket: IBucket, src: string, pattern?: string): Promise<string[]> {
        throw new Error("Method not implemented.");
    }
    getFileInfo(bucket: IBucket, dir: string): Promise<IFileInfo> {
        throw new Error("Method not implemented.");
    }

    protected async generateFileInfo(bucket: IBucket, src: string): Promise<IFileInfo> {
        const completeSrc = this.resolveBucketPath(bucket, src);
        const stats = await fs.stat(completeSrc);
        return {
            path: src,
            completeFilename: completeSrc,
            exists: true,
            permissions: octalToString(stats.mode),
            type: stats.isDirectory() ? 'DIRECTORY' : 'FILE',
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
            size: stats.size
        };
    }

    protected getBucketOptions(bucket: IBucket): FileSystemBucketConfig {
        return bucket.config;
    }

    protected getBucketPath(bucket: IBucket) {
        return this.getBucketOptions(bucket).root || bucket.name;
    }

    protected resolveBucketPath(bucket: IBucket, dir?: string) {
        return this.resolvePath(path.join(this.getBucketPath(bucket), dir || ''));
    }

    protected resolvePath(source: string): string {
        if (source.startsWith('/')) {
            source = source.substr(1);
        }
        if (!source) {
            return path.resolve(this.config.root);
        }
        return path.resolve(this.config.root, source);
    }


}