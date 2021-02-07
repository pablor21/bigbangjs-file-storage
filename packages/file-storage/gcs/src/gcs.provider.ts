import path from 'path';
import {
    AbstractProvider,
    IStorageProvider,
    FileStorage,
    StorageException,
    ProviderConfigOptions,
    BucketConfigOptions,
    StorageExceptionType,
    Streams,
    stringNullOrEmpty,
    CopyFileOptions,
    CreateFileOptions,
    DeleteFileOptions,
    GetFileOptions,
    IBucket,
    IFile,
    ListFilesOptions,
    ListResult,
    StorageResponse,
    CopyManyFilesOptions,
    MoveManyFilesOptions,
    Pattern,
    DeleteManyFilesOptions
} from "@bigbangjs/file-storage";

export type GCSProviderConfig = {
    root?: string;
} & ProviderConfigOptions;

const defaultConfig: GCSProviderConfig = {
    //root: path.join(process.cwd(), 'storage')
};

export type FileSystemBucketConfig = {
    root: string;
} & BucketConfigOptions;

export type FileSystemNativeResponse = {

}

export class GCSProvider extends AbstractProvider<GCSProviderConfig, FileSystemBucketConfig, FileSystemNativeResponse> implements IStorageProvider<FileSystemBucketConfig, FileSystemNativeResponse>{
    public supportsCrossBucketOperations: boolean;

    public readonly type: string = 'GCS';
    constructor(storage: FileStorage, name: string, config: string | GCSProviderConfig = defaultConfig) {
        super(storage, name, config);
        this.supportsCrossBucketOperations = true;
        this.validateOptions();
    }

    protected validateOptions() {
        if (stringNullOrEmpty(this.config.root)) {
            throw new StorageException(StorageExceptionType.INVALID_PARAMS, `The root path must be provided [${this.name}]!`);
        }
    }

    protected parseConfig(config: string | GCSProviderConfig): GCSProviderConfig {
        const ret = {};
        if (typeof (config) === 'string') {
            Object.assign(ret, defaultConfig, GCSProvider.parseUriToOptions(config));
        } else {
            Object.assign(ret, defaultConfig, config);
            if (typeof (config.uri) === 'string') {
                Object.assign(ret, GCSProvider.parseUriToOptions(config.uri));
            }
        }
        return ret as GCSProviderConfig;
    }


    public static parseUriToOptions(uri: string): GCSProviderConfig {
        const ret: GCSProviderConfig = defaultConfig;
        const parsedUrl = new URL(uri);

        if (parsedUrl.searchParams.has('mode')) {
            ret.mode = parsedUrl.searchParams.get('mode') || '0777';
        }

        if (parsedUrl.hostname || parsedUrl.pathname) {
            ret.root = path.resolve(path.normalize(path.join(parsedUrl.hostname, parsedUrl.pathname)));
        }
        return ret;
    }


    public init(): Promise<StorageResponse<boolean, FileSystemNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    public dispose(): Promise<StorageResponse<boolean, FileSystemNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    public addBucket(name: string, config?: FileSystemBucketConfig): Promise<StorageResponse<IBucket<any, any>, FileSystemNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    public destroyBucket(name: string): Promise<StorageResponse<boolean, FileSystemNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    public listUnregisteredBuckets(creationOptions?: BucketConfigOptions): Promise<StorageResponse<FileSystemBucketConfig[], FileSystemNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    public deleteFile(bucket: IBucket<any, any>, path: string | IFile, options?: DeleteFileOptions): Promise<StorageResponse<boolean, FileSystemNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    public deleteFiles(bucket: IBucket<any, any>, path: string, pattern: Pattern, options?: DeleteManyFilesOptions): Promise<StorageResponse<boolean, FileSystemNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    public fileExists<RType extends boolean | IFile = any>(bucket: IBucket<any, any>, path: string | IFile, returning?: boolean): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    public listFiles<RType extends IFile[] | string[] = IFile[]>(bucket: IBucket<any, any>, path: string, options?: ListFilesOptions): Promise<StorageResponse<ListResult<RType>, FileSystemNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    public putFile<RType extends string | IFile = any>(bucket: IBucket<any, any>, fileName: string | IFile, contents: string | Buffer | Streams.Readable, options?: CreateFileOptions): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    public getFileStream(bucket: IBucket<any, any>, fileName: string | IFile, options?: GetFileOptions): Promise<StorageResponse<Streams.Readable, FileSystemNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    public getFileContents(bucket: IBucket<any, any>, fileName: string | IFile, options?: GetFileOptions): Promise<StorageResponse<Buffer, FileSystemNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    public copyFile<RType extends string | IFile = IFile>(bucket: IBucket<any, any>, src: string | IFile, dest: string | IFile, options?: CopyFileOptions): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    public moveFile<RType extends string | IFile = IFile>(bucket: IBucket<any, any>, src: string | IFile, dest: string | IFile, options?: CopyFileOptions): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    protected generateFileObject(bucket: IBucket<any, any>, path: string, options?: any): Promise<IFile> {
        throw new Error('Method not implemented.');
    }
    public copyFiles<RType extends string[] | IFile[] = IFile[]>(bucket: IBucket<any, any>, src: string, dest: string, pattern: Pattern, options?: CopyManyFilesOptions): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    public moveFiles<RType extends string[] | IFile[] = IFile[]>(bucket: IBucket<any, any>, src: string, dest: string, pattern: Pattern, options?: MoveManyFilesOptions): Promise<StorageResponse<RType, FileSystemNativeResponse>> {
        throw new Error('Method not implemented.');
    }
    public removeEmptyDirectories(bucket: IBucket<any, any>, path: string): Promise<StorageResponse<boolean, FileSystemNativeResponse>> {
        throw new Error('Method not implemented.');
    }

}