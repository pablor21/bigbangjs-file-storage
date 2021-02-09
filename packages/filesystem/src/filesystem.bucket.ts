import { Bucket, castValue, constructError, IBucket, joinPath, objectNull, StorageExceptionType, stringNullOrEmpty, throwError } from "@bigbangjs/file-storage";
import { FilesystemProvider } from "./filesystem.provider";
import { FileSystemBucketConfig, FileSystemNativeResponse } from "./types";


export class FilesystemBucket extends Bucket<FileSystemBucketConfig, FileSystemNativeResponse> implements IBucket<FileSystemBucketConfig, FileSystemNativeResponse> {
    protected _root: string;
    constructor(provider: FilesystemProvider, absoluteName: string, config: string | FileSystemBucketConfig) {
        super(provider, absoluteName, config);
    }

    public get root(): string {
        return this._root;
    }

    public parseConfig(config: string | FileSystemBucketConfig): FileSystemBucketConfig {
        const ret: any = {
            mode: '0777',
            autoCleanup: this.provider.config.autoCleanup,
            defaultSignedUrlExpiration: this.provider.config.defaultSignedUrlExpiration,
        };
        if (objectNull(config)) {
            throwError(`Invalid bucket config options!`, StorageExceptionType.INVALID_PARAMS);
        }

        if (typeof (config) === 'string') {
            Object.assign(ret, this.parseUriToOptions(config));
        } else {
            if (config.uri) {
                Object.assign(ret, this.parseUriToOptions(config.uri));
            }
            Object.assign(ret, config);
        }
        this._root = ret.root;
        return ret;
    }

    public parseUriToOptions(uri: string): FileSystemBucketConfig {
        const ret: any = {};
        const parsedUrl = new URL(uri);

        if (parsedUrl.searchParams.has('name')) {
            ret.name = parsedUrl.searchParams.get('name');
        }

        if (parsedUrl.searchParams.has('mode')) {
            ret.mode = parsedUrl.searchParams.get('mode') || '0777';
        }

        if (parsedUrl.searchParams.has('autoCleanup')) {
            ret.autoCleanup = castValue<boolean>(parsedUrl.searchParams.get('autoCleanup'), "boolean", undefined);
        }

        if (parsedUrl.searchParams.has('signedUrlExpiration') && (!stringNullOrEmpty(parsedUrl.searchParams.get('signedUrlExpiration')))) {
            const defaultSignedUrlExpiration = parsedUrl.searchParams.get('signedUrlExpiration');
            ret.defaultSignedUrlExpiration = castValue<number>(defaultSignedUrlExpiration, 'number', undefined);
        }

        if (parsedUrl.hostname || parsedUrl.pathname) {
            ret.root = joinPath(parsedUrl.hostname, parsedUrl.pathname);
        }
        return ret;
    }

    public validateConfig() {
        super.validateConfig();
        if (stringNullOrEmpty(this.config.root)) {
            throw constructError(`The bucket root path must be provided [${this.name}]!`, StorageExceptionType.INVALID_PARAMS);
        }
    }
}