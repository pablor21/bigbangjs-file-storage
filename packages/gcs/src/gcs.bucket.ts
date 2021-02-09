import { Bucket, castValue, IBucket, joinPath, objectNull, StorageExceptionType, stringNullOrEmpty, throwError } from "@bigbangjs/file-storage";
import { Bucket as GCSNativeBucket } from '@google-cloud/storage';
import { GCSProvider } from "./gcs.provider";
import { GCSBucketConfig, GCSNativeResponse } from "./types";

export class GCSBucket extends Bucket<GCSBucketConfig, GCSNativeResponse> implements IBucket<GCSBucketConfig, GCSNativeResponse> {
    public readonly gcsBucket: GCSNativeBucket;
    constructor(provider: GCSProvider, absoluteName: string, config: string | GCSBucketConfig) {
        super(provider, absoluteName, config);
        this.gcsBucket = provider.client.bucket(this.config.bucketName);
    }

    public get bucketName(): string {
        return this.config.bucketName;
    }

    public parseConfig(config: string | GCSBucketConfig): GCSBucketConfig {
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

    protected parseUriToOptions(uri: string): GCSBucketConfig {
        const ret: Partial<GCSBucketConfig> = {};
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
        return ret as GCSBucketConfig;
    }

    public validateConfig() {
        super.validateConfig();
        if (stringNullOrEmpty(this.config.bucketName)) {
            throwError(`The parameter "bucketName" must be provided [${this.name}]!`, StorageExceptionType.INVALID_PARAMS);
        }
    }
}