import { Bucket, BucketConfigOptions, IStorageProvider } from "@bigbangjs/file-storage";
import { Bucket as GCSNativeBucket } from '@google-cloud/storage';
import { GCSProvider } from "./gcs.provider";

export type GCSBucketConfig = {
    bucketName: string;
    tryCreate?: boolean;
} & BucketConfigOptions;

export class GCSBucket extends Bucket {
    public readonly gcsBucket: GCSNativeBucket;
    constructor(provider: GCSProvider, name: string, absoluteName: string, gcsBucket: GCSNativeBucket, config: GCSBucketConfig) {
        super(provider, name, absoluteName, config);
        this.gcsBucket = gcsBucket;
    }
}