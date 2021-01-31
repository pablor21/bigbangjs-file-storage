import EventEmitter from 'events';
import { IStorageProvider } from './provider.interface';
import { IBucket } from './bucket.interface';
import { StorageException, StorageExceptionType } from './exceptions';
import { IFileInfo } from './fileinfo.interface';
import { FileStorage } from './filestorage';
import { Registry } from './registry';
import { CreateBucketOptions, CreateDirectoryOptions, MoveDirectoryOptions, CopyDirectoryOptions, ListOptions, CreateFileOptions, GetFileOptions } from './types';

export abstract class AbstractProvider<ProviderConfigType = any, BucketConfigType = any> extends EventEmitter implements IStorageProvider<BucketConfigType> {

    public abstract readonly type: string;
    public readonly name: string;
    public readonly config: any;
    public readonly storage: FileStorage;
    protected _buckets: Registry<string, IBucket> = new Registry();

    constructor(storage: FileStorage, config: string | ProviderConfigType) {
        super();
        this.storage = storage;
        this.config = this.parseConfig(config);
        this.name = this.config.name;
    }

    protected abstract parseConfig(config: string | ProviderConfigType): ProviderConfigType;

    protected ensureBucketNotRegistered(name: string) {
        if (this._buckets.has(name) || this.storage.buckets.has(name)) {
            throw new StorageException(StorageExceptionType.DUPLICATED_ELEMENT, `The bucket ${name} already exists!`, { name, provider: this });
        }
    }

    public abstract init(): Promise<void>;
    public abstract dispose(): Promise<void>;
    public abstract getBucket(name?: string): Promise<IBucket | undefined>;
    public abstract addBucket(name: string, config?: BucketConfigType): Promise<IBucket>;
    public abstract removeBucket(name: string): Promise<void>;
    public abstract destroyBucket(name: string): Promise<void>;
    public abstract listBuckets(): Promise<IBucket[]>;
    public abstract listUnregisteredBuckets(creationOptions?: CreateBucketOptions): Promise<BucketConfigType[]>;
    public abstract makeDirectory(bucket: IBucket, dir: string, options?: CreateDirectoryOptions): Promise<boolean | IFileInfo>;
    public abstract deleteDirectory(bucket: IBucket, dir: string): Promise<boolean>;
    public abstract emptyDirectory(bucket: IBucket, dir: string): Promise<boolean>;
    public abstract moveDirectory(bucket: IBucket, src: string, dest: string, options?: MoveDirectoryOptions): Promise<boolean | IFileInfo>;
    public abstract copyDirectory(bucket: IBucket, src: string, dest: string, options?: CopyDirectoryOptions): Promise<boolean | IFileInfo>;
    public abstract directoryExists(bucket: IBucket, dir: string): Promise<boolean>;
    public abstract listDirectories(bucket: IBucket, dir: string, recursive?: boolean, pattern?: string): Promise<IFileInfo[]>;
    public abstract fileExists(bucket: IBucket, dir: string): Promise<boolean>;
    public abstract exists(bucket: IBucket, filenameOrDir: string): Promise<string | boolean>;
    public abstract list(bucket: IBucket, dir: string, recursive?: boolean, pattern?: string, config?: ListOptions): Promise<IFileInfo[]>;
    public abstract listFiles(bucket: IBucket, dir: string, recursive?: boolean, pattern?: string): Promise<IFileInfo[]>;
    public abstract putFile(bucket: IBucket, filename: string, contents: any, options?: CreateFileOptions): Promise<boolean>;
    public abstract getFile(bucket: IBucket, filename: string, options?: GetFileOptions): Promise<Buffer>;
    public abstract getFileStream(bucket: IBucket, filename: string, options?: GetFileOptions): Promise<any>;
    public abstract copyFile(bucket: IBucket, src: string, dest: string): Promise<boolean>;
    public abstract moveFile(bucket: IBucket, src: string, dest: string): Promise<boolean>;
    public abstract deleteFile(bucket: IBucket, filename: string): Promise<boolean>;
    public abstract deleteFiles(bucket: IBucket, src: string, pattern?: string): Promise<string[]>;
    public abstract getFileInfo(bucket: IBucket, dir: string): Promise<IFileInfo>;

}
