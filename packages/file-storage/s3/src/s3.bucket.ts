import { Bucket, IBucket } from "@bigbangjs/file-storage";
import { S3Provider } from "./s3.provider";
import { S3BucketConfig, S3NativeResponse } from "./types";

export class S3Bucket extends Bucket implements IBucket<S3BucketConfig, S3NativeResponse> {
    public readonly bucketName: string;
    constructor(provider: S3Provider, name: string, absoluteName: string, bucketName: string, config: S3BucketConfig) {
        super(provider, name, absoluteName, config);
        this.bucketName = bucketName;
    }
}