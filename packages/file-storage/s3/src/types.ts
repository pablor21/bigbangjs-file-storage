import { BucketConfigOptions, ProviderConfigOptions } from "@bigbangjs/file-storage";
import S3Client from "aws-sdk/clients/s3";

export type S3ProviderConfig = {
    accessKeyId?: string;
    secretAccessKey?: string;
    region?: string;
    keyFile?: string;
    dualStack?: boolean;
    ssl?: boolean;
    useNativeUrlGenerator?: boolean;
} & ProviderConfigOptions & S3Client.ClientConfiguration;

export type S3BucketConfig = {
    bucketName?: string;
    tryCreate?: boolean,
    useNativeUrlGenerator?: boolean,
} & BucketConfigOptions;



export type S3NativeResponse = {

}