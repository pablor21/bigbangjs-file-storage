# 💥 BigBangJS File Storage - Google Cloud Storage Provider

Google Cloud Storage provider for [`@bigbangjs/file-storage`](../../).

---

External/Peer dependencies:

This package includes [`@google-cloud/storage`](https://www.npmjs.com/package/@google-cloud/storage) as a dependency. **You don't have to install it by yourself**

---
## 🚀 Quick start

1. **Install the package using npm or yarn**

```bash
$ npm i @bigbangjs/file-storage-gcs
# or
$ yarn add @bigbangjs/file-storage-gcs
```

1. **Register the provider globally in the storage**

```typescript
import {GCSProvider} from '@bigbangjs/file-storage-gcs;

FileStorage.registerProviderType('gcs', GCSProvider);
```


2. **Init the Storage and add a provider instance and buckets**
```typescript
import {FileStorage} from '@bigbangjs/file-storage';
import { GCSBucketConfig, GCSProvider, GCSProviderConfig } from '@bigbangjs/file-storage-gcs';

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
    uri: 'gcs://<pathToCredentilsFile>',
    name: 'myprovider'
})).result;

// add a bucket using object config
const myBucket=(await myProvider.addBucket({ bucketName: 'gcsBucketName', name:'bucket01' }));

// add a bucket using url object
const myBucket=(await myProvider.addBucket({ uri: 'myprovider://gcsBucketName?name=bucket02' }));

// add a bucket using url string
const myBucket=(await myProvider.addBucket('myprovider://gcsBucketName?name=bucket03'));

// the bucket is ready to use, for example, create a file
const fileUri= (await myBucket.putFile('directory/test.txt', 'Hello world!')).result;
//the response will be: myprovider://bucket01/directory/test.txt
```

---

## 💥 Provider configuration options

You can set the configuration of the provider as an "url" or a [`GCSProviderConfig`](./src/types.ts) object.

The url must be in the form:
```Typescript
<providerTypeName>://<pathToCredentialsFile>?name=<providerName>&projectId=<gcsProjectId>[&mode=0777][&signedUrlExpiration=3600][&tryCreateBuckets=true|false][&useNativeUrlGenerator=true|false][&autoRetry=true|false][&maxRetries=true|false][&userAgent=string][&apiEndpoint=string]
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

    /**
     * --------------------------
     * PROPERTIES INHTERITED FROM @google-cloud/storage CLIENT CONFIGURATION OPTIONS
     * --------------------------
     **/

    autoRetry?: boolean;
    maxRetries?: number;
    promise?: typeof Promise;
    userAgent?: string;
    /**
     * The API endpoint of the service used to make requests.
     * Defaults to `storage.googleapis.com`.
     */
    apiEndpoint?: string;
    /**
     * Path to a .json, .pem, or .p12 key file
     */
    keyFilename?: string;
    /**
     * Path to a .json, .pem, or .p12 key file
     */
    keyFile?: string;
    /**
     * Object containing client_email and private_key properties
     */
    credentials?: CredentialBody;
    /**
     * Options object passed to the constructor of the client
     */
    clientOptions?: JWTOptions | OAuth2ClientOptions | UserRefreshClientOptions;
    /**
     * Required scopes for the desired API request
     */
    scopes?: string | string[];
    /**
     * Your project ID.
     */
    projectId?: string;
}
```

---

## 💥 Bucket configuration options

You can set the configuration of the provider as an "url" or a [`GCSBucketConfig`](./src/types.ts) object.

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
    // try create the bucket in GCS if doesn't exist? [default: the provider value]
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