import { Bucket } from "@bigbangjs/file-storage";
import { Bucket as GCSNativeBucket } from '@google-cloud/storage';
import { GCSProvider } from "./gcs.provider";
import { GCSBucketConfig } from "./types";

export class GCSBucket extends Bucket {
    public readonly gcsBucket: GCSNativeBucket;
    constructor(provider: GCSProvider, name: string, absoluteName: string, gcsBucket: GCSNativeBucket, config: GCSBucketConfig) {
        super(provider, name, absoluteName, config);
        this.gcsBucket = gcsBucket;
    }
}