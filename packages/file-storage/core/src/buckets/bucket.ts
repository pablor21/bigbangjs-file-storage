import { CreateDirectoryOptions, MoveDirectoryOptions, CopyDirectoryOptions, StorageResponse, ListResult, DirectoryListOptions, FileEntryListOptions, FileListOptions, DeleteDirectoryOptions } from '../types';
import { canRead, canWrite } from '../lib';
import { IBucket } from './bucket.interface';
import { BucketConfigOptions } from './types';
import { IStorageProvider } from '../providers';
import { IDirectory, IFile, IFileEntry } from '../files';

export class Bucket<ConfigType extends BucketConfigOptions = any, NativeResponseType = any> implements IBucket<ConfigType, NativeResponseType> {

    public readonly name: string;
    public readonly absoluteName: string;
    public readonly config: ConfigType;
    public readonly provider: IStorageProvider<ConfigType, NativeResponseType>;

    constructor(provider: IStorageProvider<ConfigType, NativeResponseType>, name: string, absoltuteName: string, config: BucketConfigOptions | Record<string, any>) {
        this.config = config as ConfigType;
        this.name = name;
        this.absoluteName = absoltuteName;
        this.provider = provider;
    }


    public log(level: 'info' | 'debug' | 'warn' | 'error', ...args: any) {
        this.provider.storage.log(level, ...args);
    }

    public canRead(): boolean {
        return canRead(this.config.mode);
    }

    public canWrite(): boolean {
        return canWrite(this.config.mode);
    }

    public async makeDirectory<RType extends IDirectory | boolean = any>(dir: string | IDirectory, options?: CreateDirectoryOptions): Promise<StorageResponse<RType, NativeResponseType>> {
        return this.provider.makeDirectory(this, dir, options);
    }

    public async deleteDirectory(dir: string | IDirectory, options?: DeleteDirectoryOptions): Promise<StorageResponse<boolean, NativeResponseType>> {
        return this.provider.deleteDirectory(this, dir, options);
    }

    public async emptyDirectory(dir: string | IDirectory): Promise<StorageResponse<boolean, NativeResponseType>> {
        return this.provider.emptyDirectory(this, dir);
    }

    public async moveDirectory<RType extends IDirectory | boolean = any>(src: string | IDirectory, dest: string | IDirectory, options?: MoveDirectoryOptions): Promise<StorageResponse<RType, NativeResponseType>> {
        return this.provider.moveDirectory(this, src, dest, options);
    }

    public async copyDirectory<RType extends IDirectory | boolean = any>(src: string | IDirectory, dest: string | IDirectory, options?: CopyDirectoryOptions): Promise<StorageResponse<RType, NativeResponseType>> {
        return this.provider.copyDirectory(this, src, dest, options);
    }

    public async directoryExists<RType extends IDirectory | boolean = any>(dir: string | IDirectory, returning?: boolean): Promise<StorageResponse<RType, NativeResponseType>> {
        return this.provider.directoryExists(this, dir, returning);
    }

    public async listDirectories<RType extends ListResult<any>>(path: string | IDirectory = '/', options?: DirectoryListOptions): Promise<StorageResponse<RType, NativeResponseType>> {
        return this.provider.listDirectories(this, path, options);
    }


    public async list<RType extends ListResult<any>>(path: string | IDirectory = '/', options?: FileEntryListOptions): Promise<StorageResponse<RType, NativeResponseType>> {
        return this.provider.list(this, path, options);
    }

    public async listFiles<RType extends ListResult<any>>(path: string | IDirectory = '/', options?: FileListOptions): Promise<StorageResponse<RType, NativeResponseType>> {
        return this.provider.listFiles(this, path, options);
    }


    public async exists<RType extends boolean | IFileEntry = any>(path: string | IFileEntry, returning?: boolean): Promise<StorageResponse<RType, NativeResponseType>> {
        return this.provider.exists(this, path, returning);
    }

    public async fileExists<RType extends IFile | boolean = any>(path: string | IFile, returning?: boolean): Promise<StorageResponse<RType, NativeResponseType>> {
        return this.provider.fileExists(this, path, returning);
    }

}
