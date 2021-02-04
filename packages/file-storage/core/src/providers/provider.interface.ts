import EventEmitter from 'events';
import { FileStorage } from '../filestorage';
import { BucketConfigOptions, IBucket } from '../buckets';
import { Streams, CopyDirectoryOptions, CreateDirectoryOptions, CreateFileOptions, DirectoryListOptions, FileEntryListOptions, FileListOptions, GetFileOptions, ListResult, MoveDirectoryOptions, StorageResponse, DeleteDirectoryOptions } from '../types';
import { IFileEntry, IDirectory, IFile } from '../files';

export type StorageProviderClassType<T extends IStorageProvider> = new (storage: FileStorage, name: string, config: any) => T;

export interface IStorageProvider<BucketConfigType extends BucketConfigOptions = any, NativeResponseType = any> extends EventEmitter {
  readonly type: string;
  readonly name: string;
  readonly config: any;
  readonly storage: FileStorage;
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
  getBucket(name?: string): IBucket;
  /**
   * Register a bucket on the provider
   * @param name the name of the bucket
   * @param config config of the bucket
   */
  addBucket(name: string, config?: BucketConfigType): Promise<StorageResponse<IBucket, NativeResponseType>>;
  /**
    * Unregister the bucket from the provider session
    * THIS METHOD DOES NOT DELETES THE DIR OR CLOUD BUCKET, JUST UNREGISTERS THE BUCKET FROM THE PROVIDER SOURCE (filesystem or cloud)
    * @param name the name of the bucket
    */
  removeBucket(name: string): Promise<StorageResponse<boolean>>;
  /**
   * WARNING!!!! THIS METHOD DELETES THE DIR OR CLOUD BUCKET
   * Destroy the bucket from the provider (removes the dir or delete from the cloud)
   * @param name the name of the bucket
   */
  destroyBucket(name: string): Promise<StorageResponse<boolean, NativeResponseType>>;
  /**
   * List the registered buckets
   */
  listBuckets(): Promise<StorageResponse<IBucket[]>>;
  /**
   * List the buckets that are not registered (for example unregistered subdirectories, or buckets in a cloud account)
   * useful when you want to register automatically, returns a list of BucketConfigType objects
   * @param creationOptions: The creation options to make the response
   */
  listUnregisteredBuckets(creationOptions?: BucketConfigOptions): Promise<StorageResponse<BucketConfigType[], NativeResponseType>>;
  /**
   * Makes a directory
   * @param bucket the target bucket
   * @param path the path
   * @param options the creation options
   */
  makeDirectory<RType extends IDirectory | boolean = any>(bucket: IBucket, path: string | IDirectory, options?: CreateDirectoryOptions): Promise<StorageResponse<RType, NativeResponseType>>;
  /**
   * Deletes a directory
   * @param bucket the target bucket
   * @param path the path or the directory
   */
  deleteDirectory(bucket: IBucket, path: string | IDirectory, options?: DeleteDirectoryOptions): Promise<StorageResponse<boolean, NativeResponseType>>;
  /**
   * Deletes all files and subdirectories of a directory (keeping the directory itself)
   * @param bucket the target bucket
   * @param path the path
   */
  emptyDirectory(bucket: IBucket, path: string | IDirectory): Promise<StorageResponse<boolean, NativeResponseType>>;
  /**
   * Moves a directory inside a bucket
   * @param bucket the target bucket
   * @param src the source path
   * @param dest the destination path
   * @param options move options
   */
  moveDirectory<RType extends IDirectory | boolean = any>(bucket: IBucket, src: string | IDirectory, dest: string | IDirectory, options?: MoveDirectoryOptions): Promise<StorageResponse<RType, NativeResponseType>>;
  /**
   * Copy a directory inside a bucket
   * @param bucket the target bucket
   * @param src the source path
   * @param dest the destination path
   * @param options copy options
   */
  copyDirectory<RType extends IDirectory | boolean = any>(bucket: IBucket, src: string | IDirectory, dest: string | IDirectory, options?: CopyDirectoryOptions): Promise<StorageResponse<RType, NativeResponseType>>;
  /**
   * Checks if a directory exists (is an alias of exists with filter by directory)
   * @param bucket the target bucket
   * @param path the directory path
   * @param returning return the info of the directory?
   */
  directoryExists<RType extends IDirectory | boolean = any>(bucket: IBucket, path: string | IDirectory, returning?: boolean): Promise<StorageResponse<RType, NativeResponseType>>;
  /**
   * List all directories in path
   * @param bucket the target bucket
   * @param path the directory root path
   * @param options options
   */
  listDirectories<RType extends ListResult<any>>(bucket: IBucket, path: string | IDirectory, options?: DirectoryListOptions): Promise<StorageResponse<RType, NativeResponseType>>;
  /**
   * Checks if a file exists (is an alias of exists with filter by file)
   * @param bucket the target bucket
   * @param path the file dir
   * @param returning return the info of the file?
   */
  fileExists<RType extends IFile | boolean = any>(bucket: IBucket, path: string | IFile, returning?: boolean): Promise<StorageResponse<RType, NativeResponseType>>;
  /**
   * Check if a file or directory exists
   * @param bucket the bucket
   * @param path the  path
   * @param returning return the info of the file or dir?
   */
  exists<RType extends IFileEntry | boolean = any>(bucket: IBucket, path: string | IFileEntry, returning?: boolean): Promise<StorageResponse<RType, NativeResponseType>>;
  /**
   * Lists files and directories
   * @param bucket the target bucket
   * @param path the path to list
   * @param options the list options
   */
  list<RType extends ListResult<any>>(bucket: IBucket, path: string | IDirectory, options?: FileEntryListOptions): Promise<StorageResponse<RType, NativeResponseType>>;
  /**
   * List all files in path
   * @param bucket the target bucket
   * @param path the directory root path
   * @param options options
   */
  listFiles<RType extends ListResult<any>>(bucket: IBucket, path: string | IDirectory, options?: FileListOptions): Promise<StorageResponse<RType, NativeResponseType>>;


  /**
   * Write a file
   * @param bucket the target bucket
   * @param filename the path/filename
   * @param options the creation options
   */
  putFile<RType extends IFile | boolean = any>(bucket: IBucket, filename: string | IFile, contents: string | Buffer | Streams.Readable, options?: CreateFileOptions): Promise<StorageResponse<RType, NativeResponseType>>;

  /**
   * Get a file stream
   * @param bucket the target bucket
   * @param filename the path/filename
   * @param options options
   */
  getFileStream(bucket: IBucket, filename: string | IFile, options?: GetFileOptions): Promise<StorageResponse<Streams.Readable, NativeResponseType>>;

  /**
   * Get a file contents as a buffer
   * @param bucket the target bucket
   * @param filename the path/filename
   * @param options options
   */
  getFileContents(bucket: IBucket, filename: string | IFile, options?: GetFileOptions): Promise<StorageResponse<Buffer, NativeResponseType>>;

  // putFile(bucket: IBucket, filename: string, contents: string | Buffer | Streams.Readable, options?: CreateFileOptions): Promise<boolean>;
  // getFile(bucket: IBucket, filename: string, options?: GetFileOptions): Promise<Buffer>;
  // getFileStream(bucket: IBucket, filename: string, options?: GetFileOptions): Promise<Streams.Readable>;
  // copyFile(bucket: IBucket, src: string, dest: string): Promise<boolean>;
  // moveFile(bucket: IBucket, src: string, dest: string): Promise<boolean>;
  // deleteFile(bucket: IBucket, filename: string): Promise<boolean>;
  // deleteFiles(bucket: IBucket, src: string, pattern?: string): Promise<string[]>;
  // getFileInfo(bucket: IBucket, path: string): Promise<Directory>;
}
