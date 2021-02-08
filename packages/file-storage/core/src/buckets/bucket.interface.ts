import { IStorageProvider } from '../providers';
import { BucketConfigOptions } from './types';
import { IncomingMessage } from 'http';
import { IStorageFile } from '../files';
import { Streams, ListResult, StorageResponse, CreateFileOptions, GetFileOptions, MoveFileOptions, CopyFileOptions, DeleteFileOptions, ListFilesOptions, CopyManyFilesOptions, Pattern, MoveManyFilesOptions, DeleteManyFilesOptions, SignedUrlOptions } from '../types';

export type BucketClassType<T extends IBucket> = new (provider: IStorageProvider, name: string, config?: any) => T;

export interface IBucket<ConfigType extends BucketConfigOptions = any, NativeResponseType = any> {
  /**
   * The bucket name in the provider
   */
  name: string;
  /**
   * The bucket name in the global registry
   */
  absoluteName: string;
  /**
   * Config options
   */
  config: ConfigType;
  /**
   * The provider
   */
  provider: IStorageProvider;

  /**
   * native properties
   */
  nativeProperites: any;

  canRead(): boolean;
  canWrite(): boolean;

  /**
    * Unregister the bucket from the provider session
   * THIS METHOD DOES NOT DELETES THE DIR OR CLOUD BUCKET, JUST UNREGISTERS THE BUCKET FROM THE PROVIDER SOURCE (filesystem or cloud)
   * @param name the name of the bucket
   */
  remove(): Promise<StorageResponse<boolean>>;
  /**
   * WARNING!!!! THIS METHOD DELETES THE DIR OR CLOUD BUCKET
   * Destroy the bucket from the provider (removes the dir or delete from the cloud)
   */
  destroy(): Promise<StorageResponse<boolean, NativeResponseType>>;
  /**
   * WARNING!!!! THIS METHOD DELETES ALL THE FILES IN A BUCKET
   */
  empty(): Promise<StorageResponse<boolean, NativeResponseType>>;

  /**
   * Removes a file or files
   * @param dir the directory path (glob available) or directory
   * @param options options
   */
  deleteFile(dir: string | IStorageFile, options?: DeleteFileOptions): Promise<StorageResponse<boolean, NativeResponseType>>;
  /**
   * Deletes a file or directory
   * @param path the path or the fileentry
   * @param pattern the pattern (glob or regex)
   * @param options options
   */
  deleteFiles(path: string, pattern: Pattern, options?: DeleteManyFilesOptions): Promise<StorageResponse<boolean, NativeResponseType>>;
  /**
   * List all files in path
   * @param path the directory root path
   * @param options options
   */
  listFiles<RType extends IStorageFile[] | string[] = IStorageFile[]>(path?: string, options?: ListFilesOptions): Promise<StorageResponse<ListResult<RType>, NativeResponseType>>;

  /**
   * Check if a file  exists
   * @param path the  path
   * @param returning return the info of the file or dir?
   * @returns The file object if returning is true, a boolean otherwhise
   */
  fileExists<RType extends IStorageFile | boolean = IStorageFile>(path: string | IStorageFile, returning?: boolean): Promise<StorageResponse<RType, NativeResponseType>>;

  /**
   * Obtains a file instance
   * @param bucket the target bucket
   * @param path the file path
   */
  getFile<Rtype extends IStorageFile = IStorageFile>(path: string): Promise<StorageResponse<Rtype, NativeResponseType>>;

  /**
   * Write a file
   * @param fileName the path/fileName
   * @param options the creation options
   * @returns The file object if returning is true, the file uri otherwhise
   */
  putFile<RType extends IStorageFile | string = IStorageFile>(fileName: string | IStorageFile, contents: string | Buffer | Streams.Readable | IncomingMessage, options?: CreateFileOptions): Promise<StorageResponse<RType, NativeResponseType>>;

  /**
   * Get a file stream
   * @param fileName the path/fileName
   * @param options options
   */
  getFileStream(fileName: string | IStorageFile, options?: GetFileOptions): Promise<StorageResponse<Streams.Readable, NativeResponseType>>;

  /**
   * Get a file contents as a buffer
   * @param fileName the path/fileName
   * @param options options
   */
  getFileContents(fileName: string | IStorageFile, options?: GetFileOptions): Promise<StorageResponse<Buffer, NativeResponseType>>;

  /**
   * Copy a file
   * @param src the file entry or the path
   * @param dest the destination file entry or the path
   * @param options the copy options
   * @returns The file object if returning is true, the file uri otherwhise
   */
  copyFile<RType extends IStorageFile | string = IStorageFile>(src: string | IStorageFile, dest: string | IStorageFile, options?: CopyFileOptions): Promise<StorageResponse<RType, NativeResponseType>>;

  /**
   * Move a file
   * @param src the file entry or the path
   * @param dest the destination file entry or the path
   * @param options the move options
   * @returns The file object if returning is true, the file uri otherwhise
   */
  moveFile<RType extends IStorageFile | string = IStorageFile>(src: string | IStorageFile, dest: string | IStorageFile, options?: MoveFileOptions): Promise<StorageResponse<RType, NativeResponseType>>;


  /**
   * Copy many files by pattern
   * @param src the base path
   * @param dest the destination path
   * @param pattern the pattern (glob or regex)
   * @param options the copy options
   * @returns The file object if returning is true, the file uri otherwhise
   */
  copyFiles<RType extends IStorageFile[] | string[] = IStorageFile[]>(src: string, dest: string, pattern: Pattern, options?: CopyManyFilesOptions): Promise<StorageResponse<RType, NativeResponseType>>;


  /**
   * Move many files by pattern
   * @param src the base path
   * @param dest the destination path
   * @param pattern the pattern (glob or regex)
   * @param options the copy options
   * @returns The file object if returning is true, the file uri otherwhise
   */
  moveFiles<RType extends IStorageFile[] | string[] = IStorageFile[]>(src: string, dest: string, pattern: Pattern, options?: MoveManyFilesOptions): Promise<StorageResponse<RType, NativeResponseType>>;

  /**
   * Removes all empty directories (useful to keep the directory tree organized)
   * @param basePath the base path to make a cleanup
   */
  removeEmptyDirectories(basePath?: string): Promise<StorageResponse<boolean, NativeResponseType>>;

  /**
   * Returns the uri for the file/directory
   * @param fileName the filename
   */
  getStorageUri(fileName: string | IStorageFile): string;

  /**
   * Get the file/directory url
   * @param fileName the file/directory name
   * @param options options
   */
  getPublicUrl(fileName: string | IStorageFile, options?: any): Promise<string>;

  /**
   * Get the file/directory signed url
   * @param fileName the file/directory name
   * @param options options
   */
  getSignedUrl(fileName: string | IStorageFile, options?: SignedUrlOptions): Promise<string>;

  /**
   * Gets a native path from a file uri or IFile
   * @param path  the path
   */
  getNativePath(path: string | IStorageFile): string;
}
