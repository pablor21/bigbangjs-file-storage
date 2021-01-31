import { IBucket } from './bucket.interface';
import { IFileInfo } from './fileinfo.interface';
import * as Streams from 'stream';
import { CopyDirectoryOptions, CreateBucketOptions, CreateDirectoryOptions, CreateFileOptions, GetFileOptions, ListOptions, MoveDirectoryOptions } from './types';
import { FileStorage } from './filestorage';
import EventEmitter from 'events';

export type StorageProviderClassType<T extends IStorageProvider> = new (storage: FileStorage, config: any) => T;

export interface IStorageProvider<BucketConfigType = any> extends EventEmitter {
    readonly type: string;
    readonly name: string;
    readonly config: any;
    readonly storage: FileStorage;
    /**
     * Inits the provider instance (login?, create root dir?)
     */
    init(): Promise<void>;

    /**
     * disposes the provider
     */
    dispose(): Promise<void>;

    /**
     * Get registered bucket
     * @param name the name of the bucket
     */
    getBucket(name?: string): Promise<IBucket | undefined>;
    /**
     * Register a bucket on the provider
     * @param name the name of the bucket
     * @param config config of the bucket
     */
    addBucket(name: string, config?: BucketConfigType): Promise<IBucket>;
    /**
      * Unregister the bucket from the provider session
      * THIS METHOD DOES NOT DELETES THE DIR OR CLOUD BUCKET, JUST UNREGISTERS THE BUCKET FROM THE PROVIDER SOURCE (filesystem or cloud)
      * @param name the name of the bucket
      */
    removeBucket(name: string): Promise<void>;
    /**
     * WARNING!!!! THIS METHOD DELETES THE DIR OR CLOUD BUCKET
     * Destroy the bucket from the provider (removes the dir or delete from the cloud)
     * @param name the name of the bucket
     */
    destroyBucket(name: string): Promise<void>;
    /**
     * List the registered buckets
     */
    listBuckets(): Promise<IBucket[]>;


    /**
     * List the buckets that are not registered (for example unregistered subdirectories, or buckets in a cloud account)
     * useful when you want to register automatically, returns a list of BucketConfigType objects
     */
    listUnregisteredBuckets(creationOptions?: CreateBucketOptions): Promise<BucketConfigType[]>;


    makeDirectory(bucket: IBucket, dir: string, options?: CreateDirectoryOptions): Promise<boolean | IFileInfo>;
    deleteDirectory(bucket: IBucket, dir: string): Promise<boolean>;
    emptyDirectory(bucket: IBucket, dir: string): Promise<boolean>;
    moveDirectory(bucket: IBucket, src: string, dest: string, options?: MoveDirectoryOptions): Promise<boolean | IFileInfo>;
    copyDirectory(bucket: IBucket, src: string, dest: string, options?: CopyDirectoryOptions): Promise<boolean | IFileInfo>;
    directoryExists(bucket: IBucket, dir: string): Promise<boolean>;
    listDirectories(bucket: IBucket, dir: string, recursive?: boolean, pattern?: string): Promise<IFileInfo[]>;
    fileExists(bucket: IBucket, dir: string): Promise<boolean>;
    exists(bucket: IBucket, filenameOrDir: string): Promise<string | boolean>;
    list(bucket: IBucket, dir: string, recursive?: boolean, pattern?: string, config?: ListOptions): Promise<IFileInfo[]>;
    listFiles(bucket: IBucket, dir: string, recursive?: boolean, pattern?: string): Promise<IFileInfo[]>;
    putFile(bucket: IBucket, filename: string, contents: string | Buffer | Streams.Readable, options?: CreateFileOptions): Promise<boolean>;
    getFile(bucket: IBucket, filename: string, options?: GetFileOptions): Promise<Buffer>;
    getFileStream(bucket: IBucket, filename: string, options?: GetFileOptions): Promise<Streams.Readable>;
    copyFile(bucket: IBucket, src: string, dest: string): Promise<boolean>;
    moveFile(bucket: IBucket, src: string, dest: string): Promise<boolean>;
    deleteFile(bucket: IBucket, filename: string): Promise<boolean>;
    deleteFiles(bucket: IBucket, src: string, pattern?: string): Promise<string[]>;
    getFileInfo(bucket: IBucket, dir: string): Promise<IFileInfo>;
}
