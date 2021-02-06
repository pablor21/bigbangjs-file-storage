import { IStorageProvider } from '../providers';
import { BucketConfigOptions } from './types';
import { IFile } from '../files';
import { Streams, ListResult, StorageResponse, CreateFileOptions, GetFileOptions, MoveFileOptions, CopyFileOptions, DeleteFileOptions, ListFilesOptions, CopyManyFilesOptions, Pattern, MoveManyFilesOptions, DeleteManyFilesOptions } from '../types';

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
    * @param name the name of the bucket
    */
   destroy(): Promise<StorageResponse<boolean, NativeResponseType>>;

    /**
     * Removes a file or files
     * @param dir the directory path (glob available) or directory
     * @param options options
     */
    deleteFile(dir: string | IFile, options?: DeleteFileOptions): Promise<StorageResponse<boolean, NativeResponseType>>;
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
    listFiles<RType extends IFile[] | string[] = IFile[]>(path?: string, options?: ListFilesOptions): Promise<StorageResponse<ListResult<RType>, NativeResponseType>>;

    /**
     * Check if a file  exists
     * @param path the  path
     * @param returning return the info of the file or dir?
     * @returns The file object if returning is true, a boolean otherwhise
     */
    fileExists<RType extends IFile | boolean = IFile>(path: string | IFile, returning?: boolean): Promise<StorageResponse<RType, NativeResponseType>>;

    /**
     * Obtains a file instance
     * @param bucket the target bucket
     * @param path the file path
     */
    getFile<Rtype extends IFile = IFile>(path: string): Promise<StorageResponse<Rtype, NativeResponseType>>;

    /**
     * Write a file
     * @param fileName the path/fileName
     * @param options the creation options
     * @returns The file object if returning is true, the file uri otherwhise
     */
    putFile<RType extends IFile | string = IFile>(fileName: string | IFile, contents: string | Buffer | Streams.Readable, options?: CreateFileOptions): Promise<StorageResponse<RType, NativeResponseType>>;

    /**
     * Get a file stream
     * @param fileName the path/fileName
     * @param options options
     */
    getFileStream(fileName: string | IFile, options?: GetFileOptions): Promise<StorageResponse<Streams.Readable, NativeResponseType>>;

    /**
     * Get a file contents as a buffer
     * @param fileName the path/fileName
     * @param options options
     */
    getFileContents(fileName: string | IFile, options?: GetFileOptions): Promise<StorageResponse<Buffer, NativeResponseType>>;

    /**
     * Copy a file
     * @param src the file entry or the path
     * @param dest the destination file entry or the path
     * @param options the copy options
     * @returns The file object if returning is true, the file uri otherwhise
     */
    copyFile<RType extends IFile | string = IFile>(src: string | IFile, dest: string | IFile, options?: CopyFileOptions): Promise<StorageResponse<RType, NativeResponseType>>;

    /**
     * Move a file
     * @param src the file entry or the path
     * @param dest the destination file entry or the path
     * @param options the move options
     * @returns The file object if returning is true, the file uri otherwhise
     */
    moveFile<RType extends IFile | string = IFile>(src: string | IFile, dest: string | IFile, options?: MoveFileOptions): Promise<StorageResponse<RType, NativeResponseType>>;


    /**
     * Copy many files by pattern
     * @param src the base path
     * @param dest the destination path
     * @param pattern the pattern (glob or regex)
     * @param options the copy options
     * @returns The file object if returning is true, the file uri otherwhise
     */
    copyFiles<RType extends IFile[] | string[] = IFile[]>(src: string, dest: string, pattern: Pattern, options?: CopyManyFilesOptions): Promise<StorageResponse<RType, NativeResponseType>>;


    /**
     * Move many files by pattern
     * @param src the base path
     * @param dest the destination path
     * @param pattern the pattern (glob or regex)
     * @param options the copy options
     * @returns The file object if returning is true, the file uri otherwhise
     */
    moveFiles<RType extends IFile[] | string[] = IFile[]>(src: string, dest: string, pattern: Pattern, options?: MoveManyFilesOptions): Promise<StorageResponse<RType, NativeResponseType>>;

    /**
     * Removes all empty directories (useful to keep the directory tree organized)
     * @param basePath the base path to make a cleanup
     */
    removeEmptyDirectories(basePath?: string): Promise<StorageResponse<boolean, NativeResponseType>>;

    /**
     * Returns the uri for the file/directory
     * @param fileName the filename
     */
    getStorageUri(fileName: string | IFile): string;

    /**
     * Get the file/directory url
     * @param fileName the file/directory name
     * @param options options
     */
    getPublicUrl(fileName: string | IFile, options?: any): Promise<string>;

    /**
     * Get the file/directory signed url
     * @param fileName the file/directory name
     * @param options options
     */
    getSignedUrl(fileName: string | IFile, options?: any): Promise<string>;
}
