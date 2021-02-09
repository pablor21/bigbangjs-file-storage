import { Bucket, castValue, IBucket, objectNull, StorageExceptionType, stringNullOrEmpty, throwError } from "@bigbangjs/file-storage";
import { S3Provider } from "./s3.provider";
import { S3BucketConfig, S3NativeResponse } from "./types";

export class S3Bucket extends Bucket implements IBucket<S3BucketConfig, S3NativeResponse> {
    constructor(provider: S3Provider, absoluteName: string, config: string | S3BucketConfig) {
        super(provider, absoluteName, config);
    }

    public get bucketName(): string {
        return this.config.bucketName;
    }

    public parseConfig(config: string | S3BucketConfig): S3BucketConfig {
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
        return ret;
    }

    protected parseUriToOptions(uri: string): S3BucketConfig {
        const ret: Partial<S3BucketConfig> = {};
        const parsedUrl = new URL(uri);

        ret.bucketName = parsedUrl.hostname || parsedUrl.pathname;

        if (parsedUrl.searchParams.has('name')) {
            ret.name = parsedUrl.searchParams.get('name');
        }

        if (parsedUrl.searchParams.has('mode')) {
            ret.mode = parsedUrl.searchParams.get('mode') || '0777';
        }

        if (parsedUrl.searchParams.has('autoCleanup')) {
            ret.autoCleanup = castValue<boolean>(parsedUrl.searchParams.get('autoCleanup'), "boolean", undefined);
        }

        if (parsedUrl.searchParams.has('tryCreate')) {
            ret.tryCreate = castValue<boolean>(parsedUrl.searchParams.get('tryCreate'), "boolean", this.provider.config);
        }

        if (parsedUrl.searchParams.has('signedUrlExpiration') && (!stringNullOrEmpty(parsedUrl.searchParams.get('signedUrlExpiration')))) {
            const defaultSignedUrlExpiration = parsedUrl.searchParams.get('signedUrlExpiration');
            ret.defaultSignedUrlExpiration = castValue<number>(defaultSignedUrlExpiration, 'number', undefined);
        }
        return ret as S3BucketConfig;
    }

    public validateConfig() {
        super.validateConfig();
        if (stringNullOrEmpty(this.config.bucketName)) {
            throwError(`The parameter "bucketName" must be provided [${this.name}]!`, StorageExceptionType.INVALID_PARAMS);
        }
    }
}