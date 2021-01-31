import { IFileInfo } from './fileinfo.interface';
import { CopyDirectoryOptions, CreateDirectoryOptions, ListOptions, MoveDirectoryOptions, CreateFileOptions } from './types';


export interface IStorageMethods {
    /**
     * Creates a new directory
     * @param dir the directory path
     * @param options the creation options
     */
    makeDirectory(dir: string, options?: CreateDirectoryOptions): Promise<boolean | IFileInfo>;
    /**
     * Removes a directory (empty or not)
     * @param dir the directory path
     */
    deleteDirectory(dir: string): Promise<boolean | IFileInfo>;
    /**
     *
     * @param dir the directory path
     */
    emptyDirectory(dir: string): Promise<boolean>;
    /**
     * Move a directory inside the same bucket
     * @param src source dir
     * @param dest dest dir
     * @param options move options
     */
    moveDirectory(src: string, dest: string, options?: MoveDirectoryOptions): Promise<boolean | IFileInfo>;
    /**
     * Copy a directory to another location in the same bucket
     * @param src source dir
     * @param dest dest dir
     * @param options copy options
     */
    copyDirectory(src: string, dest: string, options?: CopyDirectoryOptions): Promise<boolean | IFileInfo>;
    // directoryExists(dir: string): Promise<boolean>;
    // listDirectories(dir: string, recursive?: boolean, pattern?: string): Promise<IFileInfo[]>;
    // fileExists(dir: string): Promise<boolean>;
    // exists(filenameOrDir: string): Promise<string | boolean>;
    // list(dir: string, recursive?: boolean, pattern?: string, config?: ListOptions): Promise<IFileInfo[]>;
    // listFiles(dir: string, recursive?: boolean, pattern?: string): Promise<IFileInfo[]>;
    // putFile(filename: string, contents: string | Buffer | Readable, options?: CreateFileOptions): Promise<boolean>;
    // getFile(filename: string): Promise<Buffer>;
    // getFileStream(filename: string): Promise<Readable>;
    // copyFile(src: string, dest: string): Promise<boolean>;
    // moveFile(src: string, dest: string): Promise<boolean>;
    // deleteFile(filename: string): Promise<boolean>;
    // deleteFiles(src: string, pattern?: string): Promise<string[]>;
    // getFileInfo(dir: string): Promise<IFileInfo>;
}
