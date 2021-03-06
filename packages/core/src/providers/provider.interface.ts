import EventEmitter from 'events';
import { FileStorage } from '../filestorage';
import { BucketConfigOptions, IBucket, Bucket } from '../buckets';
import { Streams, CreateFileOptions, GetFileOptions, ListResult, StorageResponse, CopyFileOptions, MoveFileOptions, DeleteFileOptions, ListFilesOptions, CopyManyFilesOptions, Pattern, MoveManyFilesOptions, DeleteManyFilesOptions, SignedUrlOptions } from '../types';
import { IStorageFile } from '../files';
import { IncomingMessage } from 'http';

export type StorageProviderClassType<T extends IStorageProvider> = new (storage: FileStorage, config?: any) => T;

export interface IStorageProvider<BucketConfigType extends BucketConfigOptions = any, NativeResponseType = any, BucketType extends IBucket<BucketConfigType, NativeResponseType> = IBucket<BucketConfigType, NativeResponseType>> extends EventEmitter {
  readonly type: string;
  readonly name: string;
  readonly config: any;
  readonly storage: FileStorage;
  /**
   * Does this provider support copy/move between buckets
   */
  readonly supportsCrossBucketOperations: boolean;
  ready(): boolean;
  /**
   * Inits the provider instance (login?, create root dir?)
   */
  init(): Promise<StorageResponse<boolean, NativeResponseType>>;
  /**
   * disposes the provider
   */
  dispose(): Promise<StorageResponse<boolean, NativeResponseType>>;
  /**
   * Get registered bucket
   * @param name the name of the bucket
   */
  getBucket(name?: string): BucketType;
  /**
   * Register a bucket on the provider
   * @param config config of the bucket
   */
  addBucket(bucket?: BucketConfigType | BucketType | string): Promise<StorageResponse<BucketType, NativeResponseType>>;
  /**
    * Unregister the bucket from the provider session
    * THIS METHOD DOES NOT DELETES THE DIR OR CLOUD BUCKET, JUST UNREGISTERS THE BUCKET FROM THE PROVIDER SOURCE (filesystem or cloud)
    * @param bucket the name of the bucket or the bucket object
    */
  removeBucket(bucket: string | BucketType): Promise<StorageResponse<boolean>>;
  /**
   * WARNING!!!! THIS METHOD DELETES THE DIR OR CLOUD BUCKET
   * Destroy the bucket from the provider (removes the dir or delete from the cloud)
   * @param bucket the name of the bucket or the object
   */
  destroyBucket(bucket: string | BucketType): Promise<StorageResponse<boolean, NativeResponseType>>;
  /**
   * Empty a bucket
   * @param bucket target bucket
   */
  emptyBucket(bucket: string | BucketType): Promise<StorageResponse<boolean, NativeResponseType>>;
  /**
   * List the registered buckets
   */
  listBuckets(): Promise<StorageResponse<BucketType[]>>;
  /**
   * List the buckets that are not registered (for example unregistered subdirectories, or buckets in a cloud account)
   * useful when you want to register automatically, returns a list of BucketConfigType objects
   * @param creationOptions: The creation options to make the response
   */
  listUnregisteredBuckets(creationOptions?: BucketConfigOptions): Promise<StorageResponse<BucketConfigType[], NativeResponseType>>;
  /**
   * Deletes a file or directory
   * @param bucket the target bucket
   * @param path the path or the fileentry
   * @param options options
   */
  deleteFile(bucket: BucketType, path: string | IStorageFile, options?: DeleteFileOptions): Promise<StorageResponse<boolean, NativeResponseType>>;
  /**
   * Deletes a file or directory
   * @param bucket the target bucket
   * @param pattern the pattern (glob or regex)
   * @param path the path or the fileentry
   * @param options options
   */
  deleteFiles(bucket: BucketType, path: string, pattern: Pattern, options?: DeleteManyFilesOptions): Promise<StorageResponse<boolean, NativeResponseType>>;

  /**
   * Checks if a file exists (is an alias of exists with filter by file)
   * @param bucket the target bucket
   * @param path the file dir
   * @param returning return the info of the file?
   * @returns The file object if returning is true, a boolean otherwhise
   */
  fileExists<RType extends IStorageFile | boolean = any>(bucket: BucketType, path: string | IStorageFile, returning?: boolean): Promise<StorageResponse<RType, NativeResponseType>>;
  /**
    * List all files in path
    * @param bucket the target bucket
    * @param path the directory root path
    * @param options options
    */
  listFiles<RType extends IStorageFile[] | string[] = IStorageFile[]>(bucket: BucketType, path: string, options?: ListFilesOptions): Promise<StorageResponse<ListResult<RType>, NativeResponseType>>;
  /**
   * Obtains a file instance
   * @param bucket the target bucket
   * @param path the file path
   */
  getFile<Rtype extends IStorageFile = IStorageFile>(bucket: BucketType, path: string): Promise<StorageResponse<Rtype, NativeResponseType>>;
  /**
   * Write a file
   * @param bucket the target bucket
   * @param fileName the path/fileName
   * @param options the creation options
   * @returns The file object if returning is true, the file uri otherwhise
   */
  putFile<RType extends IStorageFile | string = any>(bucket: BucketType, fileName: string | IStorageFile, contents: string | Buffer | Streams.Readable | IncomingMessage, options?: CreateFileOptions): Promise<StorageResponse<RType, NativeResponseType>>;

  /**
   * Get a file stream
   * @param bucket the target bucket
   * @param fileName the path/fileName
   * @param options options
   */
  getFileStream(bucket: BucketType, fileName: string | IStorageFile, options?: GetFileOptions): Promise<StorageResponse<Streams.Readable, NativeResponseType>>;

  /**
   * Get a file contents as a buffer
   * @param bucket the target bucket
   * @param fileName the path/fileName
   * @param options options
   */
  getFileContents(bucket: BucketType, fileName: string | IStorageFile, options?: GetFileOptions): Promise<StorageResponse<Buffer, NativeResponseType>>;

  /**
   * Copy a file
   * @param bucket the bucket
   * @param src the file entry or the path
   * @param dest the destination file entry or the path
   * @param options the copy options
   * @returns The file object if returning is true, the file uri otherwhise
   */
  copyFile<RType extends IStorageFile | string = IStorageFile>(bucket: BucketType, src: string | IStorageFile, dest: string | IStorageFile, options?: CopyFileOptions): Promise<StorageResponse<RType, NativeResponseType>>;

  /**
   * Copy many files by pattern
   * @param bucket the bucket
   * @param src the base path
   * @param dest the destination path
   * @param pattern the pattern (glob or regex)
   * @param options the copy options
   * @returns The file object if returning is true, the file uri otherwhise
   */
  copyFiles<RType extends IStorageFile[] | string[] = IStorageFile[]>(bucket: BucketType, src: string, dest: string, pattern: Pattern, options?: CopyManyFilesOptions): Promise<StorageResponse<RType, NativeResponseType>>;


  /**
   * Move a file
   * @param bucket the bucket
   * @param src the file entry or the path
   * @param dest the destination file entry or the path
   * @param options the move options
   * @returns The file object if returning is true, the file uri otherwhise
   */
  moveFile<RType extends IStorageFile | string = IStorageFile>(bucket: BucketType, src: string | IStorageFile, dest: string | IStorageFile, options?: MoveFileOptions): Promise<StorageResponse<RType, NativeResponseType>>;


  /**
   * Move many files by pattern
   * @param bucket the bucket
   * @param src the base path
   * @param dest the destination path
   * @param pattern the pattern (glob or regex)
   * @param options the copy options
   * @returns The file object if returning is true, the file uri otherwhise
   */
  moveFiles<RType extends IStorageFile[] | string[] = IStorageFile[]>(bucket: BucketType, src: string, dest: string, pattern: Pattern, options?: MoveManyFilesOptions): Promise<StorageResponse<RType, NativeResponseType>>;

  /**
   * Removes all empty directories (useful to keep the directory tree organized)
   * @param bucket the target bucket
   * @param basePath the base path to make a cleanup
   */
  removeEmptyDirectories(bucket: BucketType, basePath: string): Promise<StorageResponse<boolean, NativeResponseType>>;

  /**
   * Returns the uri for the file/directory
   * @param bucket the bucket
   * @param fileName the filename
   */
  getStorageUri(bucket: BucketType, fileName: string | IStorageFile): string;

  /**
   * Get the file/directory url
   * @param bucket the therget bucket
   * @param fileName the file/directory name
   * @param options options
   */
  getPublicUrl(bucket: BucketType, fileName: string | IStorageFile, options?: any): Promise<string>;

  /**
   * Get the file/directory signed url
   * @param bucket the therget bucket
   * @param fileName the file/directory name
   * @param options options
   */
  getSignedUrl(bucket: BucketType, fileName: string | IStorageFile, options?: SignedUrlOptions): Promise<string>;

  /**
   * Gets the native path of a file
   * @param bucket the target bucket
   * @param fileName the filename
   */
  getNativePath(bucket: BucketType, fileName: string | IStorageFile): string;

}
