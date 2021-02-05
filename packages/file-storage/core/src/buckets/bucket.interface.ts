import { IStorageProvider } from '../providers';
import { BucketConfigOptions } from './types';
import { IDirectory, IFile, IFileEntry } from '../files';
import { Streams, CopyDirectoryOptions, CreateDirectoryOptions, DeleteFileEntryOptions, DirectoryListOptions, FileEntryListOptions, FileListOptions, ListResult, MoveDirectoryOptions, StorageResponse, CreateFileOptions, GetFileOptions, MoveFileOptions, CopyFileOptions } from '../types';

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

    canRead(): boolean;
    canWrite(): boolean;

    /**
    * Creates a new directory
    * @param dir the directory path
    * @param options the creation options
    * @returns The directory object if returning is true, the directory uri otherwhise
    */
    makeDirectory<RType extends IDirectory | string = any>(dir: string | IDirectory, options?: CreateDirectoryOptions): Promise<StorageResponse<RType, NativeResponseType>>;
    /**
     * Removes a directory (empty or not)
     * @param dir the directory path (glob available) or directory
     */
    delete(dir: string | IFileEntry, options?: DeleteFileEntryOptions): Promise<StorageResponse<boolean, NativeResponseType>>;
    /**
     *
     * @param dir the directory path
     */
    emptyDirectory(dir: string | IDirectory): Promise<StorageResponse<boolean, NativeResponseType>>;
    /**
     * Move a directory inside the same bucket
     * @param src source dir
     * @param dest dest dir
     * @param options move options
     * @returns The directory object if returning is true, the directory uri otherwhise
     */
    moveDirectory<RType extends IDirectory | string = any>(src: string | IDirectory, dest: string | IDirectory, options?: MoveDirectoryOptions): Promise<StorageResponse<RType, NativeResponseType>>;
    /**
     * Copy a directory to another location in the same bucket
     * @param src source dir
     * @param dest dest dir
     * @param options copy options
     * @returns The directory object if returning is true, the directory object
     */
    copyDirectory<RType extends IDirectory | string = any>(src: string | IDirectory, dest: string | IDirectory, options?: CopyDirectoryOptions): Promise<StorageResponse<RType, NativeResponseType>>;
    /**
     * Checks if a directory exists (is an alias of list with filter by directory)
     * @param dir the directory
     * @param returning return the info of the directory?
     */
    directoryExists<RType extends IDirectory | boolean = any>(dir: string | IDirectory, returning?: boolean): Promise<StorageResponse<RType, NativeResponseType>>;

    /**
     * List all directories path
     * @param path the directory root path
     * @param options options
     */
    listDirectories<RType extends ListResult<any>>(path?: string | IDirectory, options?: DirectoryListOptions): Promise<StorageResponse<RType, NativeResponseType>>;

    /**
     * Obtains a directory instance
     * @param bucket the target bucket
     * @param path the directory path
     */
    getDirectory<Rtype extends IDirectory = IDirectory>(path: string): Promise<StorageResponse<Rtype, NativeResponseType>>;

    /**
     * List all files in path
     * @param path the directory root path
     * @param options options
     */
    listFiles<RType extends ListResult<any>>(path?: string | IDirectory, options?: FileListOptions): Promise<StorageResponse<RType, NativeResponseType>>;

    /**
     * List all files and directories in path
     * @param path the directory root path
     * @param options options
     */
    list<RType extends ListResult<any>>(path?: string | IDirectory, options?: FileEntryListOptions): Promise<StorageResponse<RType, NativeResponseType>>;

    /**
     * Check if a file or directory exists
     * @param path the  path
     * @param returning return the info of the file or dir?
     */
    exists<RType extends IFileEntry | boolean = any>(path: string | IFileEntry, returning?: boolean): Promise<StorageResponse<RType, NativeResponseType>>;

    /**
     * Check if a file  exists
     * @param path the  path
     * @param returning return the info of the file or dir?
     * @returns The file object if returning is true, a boolean otherwhise
     */
    fileExists<RType extends IFile | boolean = any>(path: string | IFile, returning?: boolean): Promise<StorageResponse<RType, NativeResponseType>>;

    /**
     * Obtains a file instance
     * @param bucket the target bucket
     * @param path the file path
     */
    getFile<Rtype extends IFile = IFile>(path: string): Promise<StorageResponse<Rtype, NativeResponseType>>;

    /**
     * Obtains a file or directory instance
     * @param bucket the target bucket
     * @param path the file path
     */
    getEntry<Rtype extends IFileEntry = IFileEntry>(path: string): Promise<StorageResponse<Rtype, NativeResponseType>>;

    /**
     * Write a file
     * @param fileName the path/fileName
     * @param options the creation options
     * @returns The file object if returning is true, the file uri otherwhise
     */
    putFile<RType extends IFile | string = any>(fileName: string | IFile, contents: string | Buffer | Streams.Readable, options?: CreateFileOptions): Promise<StorageResponse<RType, NativeResponseType>>;

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
    copyFile<RType extends IFile | string = any>(src: string | IFile, dest: string | IFile, options?: CopyFileOptions): Promise<StorageResponse<RType, NativeResponseType>>;

    /**
     * Move a file
     * @param src the file entry or the path
     * @param dest the destination file entry or the path
     * @param options the move options
     * @returns The file object if returning is true, the file uri otherwhise
     */
    moveFile<RType extends IFile | string = any>(src: string | IFile, dest: string | IFile, options?: MoveFileOptions): Promise<StorageResponse<RType, NativeResponseType>>;


    /**
     * Returns the uri for the file/directory
     * @param fileName the filename
     */
    getStorageUri(fileName: string | IFileEntry): string;

    /**
     * Get the file/directory url
     * @param fileName the file/directory name
     * @param options options
     */
    getPublicUrl(fileName: string | IFileEntry, options?: any): Promise<string>;

    /**
     * Get the file/directory signed url
     * @param fileName the file/directory name
     * @param options options
     */
    getSignedUrl(fileName: string | IFileEntry, options?: any): Promise<string>;
}
