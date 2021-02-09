# 💥 BigBangJS File Storage - AWS S3 Provider

AWS S3 provider for [`@bigbangjs/file-storage`](https://github.com/pablor21/bigbangjs-file-storage).

---

External/Peer dependencies:

This package includes [`aws-sdk`](https://www.npmjs.com/package/aws-sdk) as a dependency. **You don't have to install it by yourself**

---
## 🚀 Quick start

1. **Install the package using npm or yarn**

```bash
$ npm i @bigbangjs/file-storage-s3
# or
$ yarn add @bigbangjs/file-storage-s3
```

1. **Register the provider globally in the storage**

```typescript
import {S3Provider} from '@bigbangjs/file-storage-s3;

FileStorage.registerProviderType('s3', S3Provider);
```


2. **Init the Storage and add a provider instance and buckets**
```typescript
import {FileStorage} from '@bigbangjs/file-storage';
import { S3BucketConfig, S3Provider, S3ProviderConfig } from '@bigbangjs/file-storage-s3';

// create a storage insance [FileStorageConfigOptions]
const storage = new FileStorage({
    defaultBucketMode: '0777',
    bucketAliasStrategy: 'NAME',
    autoInitProviders: true,
    autoCleanup: true,
    defaultBucketName: 'mybucket',
    returningByDefault: false,,
    logger: console,
});

// add a provider
const myProvider=(await storage.addProvider({
    uri: 's3://<pathToCredentilsFile>',
    name: 'myprovider'
})).result;

// add a bucket using object config
const myBucket=(await myProvider.addBucket({ bucketName: 's3BucketName', name:'bucket01' }));

// add a bucket using url object
const myBucket=(await myProvider.addBucket({ uri: 'myprovider://s3BucketName?name=bucket02' }));

// add a bucket using url string
const myBucket=(await myProvider.addBucket('myprovider://s3BucketName?name=bucket03'));

// the bucket is ready to use, for example, create a file
const fileUri= (await myBucket.putFile('directory/test.txt', 'Hello world!')).result;
//the response will be: myprovider://bucket01/directory/test.txt
```

---

## 💥 Provider configuration options

You can set the configuration of the provider as an "url" or a [`S3ProviderConfig`](https://github.com/pablor21/bigbangjs-file-storage/tree/master/packages/s3/src/types.ts) object.

The url must be in the form:
```Typescript
<providerTypeName>://<pathToCredentialsFile>?name=<providerName>&projectId=<s3ProjectId>[&mode=0777][&signedUrlExpiration=3600][&tryCreateBuckets=true|false][&useNativeUrlGenerator=true|false][&autoRetry=true|false][&maxRetries=true|false][&userAgent=string][&apiEndpoint=string]
```
The configuration object can have the following properties:
```typescript
{
    // the name of the provider (required)
    name: string;
    // the root path in the filesystem (required)
    root: string;
    // write/read mode in octal or string format [default:'0777']
    mode?: string | number;
    // delete empty directories (recommended) [default:true]
    autoCleanup?: boolean;
    // signed url expiration (in seconds) [default:3600]
    defaultSignedUrlExpiration?: number;
    // buckets (will be added when the `init` method gets called)
    buckets?: (Partial<FileSystemBucketConfig> | string)[];
    // uri (optional) you can pass an uri as config
    uri?:string;

    // path to the credentials.json
    keyFile?:string;

    /**
     * --------------------------
     * PROPERTIES INHTERITED FROM AWS-SDK CLIENT CONFIGURATION OPTIONS
     * --------------------------
     **/
    
    /**
     * The endpoint URI to send requests to. The default endpoint is built from the configured region. 
     * The endpoint should be a string like 'https://{service}.{region}.amazonaws.com' or an Endpoint object.
     */
    endpoint?: string | Endpoint;
    /**
     * An optional map of parameters to bind to every request sent by this service object. 
     * For more information on bound parameters, see "Working with Services" in the Getting Started Guide.
     */
    params?: {
        [key: string]: any;
    }
     /**
     * Enables IPv6/IPv4 dualstack endpoint. When a DNS lookup is performed on an endpoint of this type, it returns an “A” record with an IPv4 address and an “AAAA” record with an IPv6 address. 
     * In most cases the network stack in the client environment will automatically prefer the AAAA record and make a connection using the IPv6 address. 
     * Note, however, that currently on Windows, the IPv4 address will be preferred.
     */
    useDualstack?: boolean;
    /**
     * A string in YYYY-MM-DD format that represents the latest possible API version that can be used in this service. Specify 'latest' to use the latest possible version.
     */
    apiVersion?: apiVersion;
     /**
     * Whether to compute checksums for payload bodies when the service accepts it.
     * Currently supported in S3 only.
     */
    computeChecksums?: boolean
    /**
     * Whether types are converted when parsing response data.
     */
    convertResponseTypes?: boolean
    /**
     * Whether to apply a clock skew correction and retry requests that fail because of an skewed client clock.
     */
    correctClockSkew?: boolean
    /**
     * Sets a custom User-Agent string.
     * In node environments this will set the User-Agent header, but
     * browser environments this will set the X-Amz-User-Agent header.
     */
    customUserAgent?: string
    /**
     * The AWS credentials to sign requests with.
     */
    credentials?: Credentials|CredentialsOptions|null
    /**
     * The provider chain used to resolve credentials if no static credentials property is set.
     */
    credentialProvider?: CredentialProviderChain
    /**
     * AWS access key ID.
     *
     * @deprecated
     */
    accessKeyId?: string
    /**
     * AWS secret access key.
     *
     * @deprecated
     */
    secretAccessKey?: string
    /**
     * AWS session token.
     *
     * @deprecated
     */
    sessionToken?: string
    /**
     * A set of options to pass to the low-level HTTP request.
     */
    httpOptions?: HTTPOptions
    /**
     * An object that responds to .write() (like a stream) or .log() (like the console object) in order to log information about requests.
     */
    logger?: Logger
    /**
     * The maximum amount of redirects to follow for a service request.
     */
    maxRedirects?: number
    /**
     * The maximum amount of retries to perform for a service request.
     */
    maxRetries?: number
    /**
     * Returns whether input parameters should be validated against the operation description before sending the request.
     * Defaults to true.
     * Pass a map to enable any of the following specific validation features: min|max|pattern|enum
     */
    paramValidation?: ParamValidation|boolean
    /**
     * The region to send service requests to.
     */
    region?: string
    /**
     * Returns A set of options to configure the retry delay on retryable errors.
     */
    retryDelayOptions?: RetryDelayOptions
    /**
     * Whether the provided endpoint addresses an individual bucket.
     * false if it addresses the root API endpoint.
     */
    s3BucketEndpoint?: boolean
    /**
     * Whether to disable S3 body signing when using signature version v4.
     */
    s3DisableBodySigning?: boolean
    /**
     * Whether to force path style URLs for S3 objects.
     */
    s3ForcePathStyle?: boolean
    /**
     * When region is set to 'us-east-1', whether to send s3 request to global endpoints
     * or 'us-east-1' regional endpoints. This config is only applicable to S3 client;
     * Defaults to 'legacy'
     */
    s3UsEast1RegionalEndpoint?: "regional"|"legacy"
    /**
     * Whether to override the request region with the region inferred
     * from requested resource's ARN. Only available for S3 buckets
     * Defaults to `true`
     */
    s3UseArnRegion?: boolean
    /**
     * Whether the signature to sign requests with (overriding the API configuration) is cached.
     */
    signatureCache?: boolean
    /**
     * The signature version to sign requests with (overriding the API configuration).
     * Possible values: 'v2'|'v3'|'v4'
     */
    signatureVersion?: "v2"|"v3"|"v4"|string
    /**
     * Whether SSL is enabled for requests.
     */
    sslEnabled?: boolean
    /**
     * An offset value in milliseconds to apply to all signing times.
     */
    systemClockOffset?: number
    /**
     * Whether to use the Accelerate endpoint with the S3 service.
     */
    useAccelerateEndpoint?: boolean
    /**
     * Whether to validate the CRC32 checksum of HTTP response bodies returned
     * by DynamoDB.
     */
    dynamoDbCrc32?: boolean;
    /**
     * Whether to enable endpoint discovery for operations that allow optionally using an endpoint returned by 
     * the service.
     */
    endpointDiscoveryEnabled?: boolean;
    /**
     * The size of the global cache storing endpoints from endpoint
     * discovery operations. Once endpoint cache is created, updating this setting
     * cannot change existing cache size.
     */
    endpointCacheSize?: number;
    /**
     * Whether to marshal request parameters to the prefix of hostname.
     */
    hostPrefixEnabled?: boolean;
    /**
     * Whether to send sts request to global endpoints or
     * regional endpoints. 
     */
    stsRegionalEndpoints?: "legacy"|"regional";
}
```

---

## 💥 Bucket configuration options

You can set the configuration of the provider as an "url" or a [`S3BucketConfig`](https://github.com/pablor21/bigbangjs-file-storage/tree/master/packages/s3/src/types.ts) object.

The url must be in the form:
```Typescript
<providerName>://<pathToRoot>?name=<localBucketName>&bucketName=<bucketNameAsIsInGoogleCloudStorage>[&mode=0777][&signedUrlExpiration=3600][&tryCreate=true|false]
```
The configuration object can have the following properties:
```typescript
{
    // the name of the bucket (required)
    name: string;
    // bucket name as appears in Google Cloud Storage (required)
    bucketName: string;
    // try create the bucket in S3 if doesn't exist? [default: the provider value]
    tryCreate?: boolean;
    // uri (optional) you can pass an uri as config
    uri?: string;
    // the name of the provider (this is required when you add the bucket directly to the storage instance, not when you add it to the provider instance)
    providerName?: string;
    // write/read mode in octal or string format [default:'0777']
    mode?: string | number;
    // signed url expiration (in seconds) [default:3600]
    defaultSignedUrlExpiration?: number;
}
```

---
MIT License

Copyright (c) 2020 Pablo Ramírez <dev@pjramirez.com>