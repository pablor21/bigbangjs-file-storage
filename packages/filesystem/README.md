# 💥 BigBangJS File Storage - Filesystem Provider

Filesystem provider for [`@bigbangjs/file-storage`](https://github.com/pablor21/bigbangjs-file-storage/).

---

External/Peer dependencies:

[none]

---
## 🚀 Quick start

1. **Install the package using npm or yarn**

```bash
$ npm i @bigbangjs/file-storage-filesystem
# or
$ yarn add @bigbangjs/file-storage-filesystem
```

1. **Register the provider globally in the storage**

```typescript
import {FilesystemProvider} from '@bigbangjs/file-storage-filesystem';

FileStorage.registerProviderType('fs', FilesystemProvider);
```

2. **Init the Storage and add a provider instance and buckets**
```typescript
import {FileStorage} from '@bigbangjs/file-storage';
import { FileSystemBucketConfig, FilesystemProvider, FileSystemProviderConfig } from '@bigbangjs/file-storage-filesystem';

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
    uri: 'fs://<pathToRoot>',
    name:'myprovider'
})).result;

// add a bucket using object config
const myBucket=(await myProvider.addBucket({ root: 'bucket01', name:'bucket01' }));

// add a bucket using url object
const myBucket=(await myProvider.addBucket({ uri: 'myprovider://bucket02RootPath?name=bucket02' }));

// add a bucket using url string
const myBucket=(await myProvider.addBucket('myprovider://bucket03RootPath?name=bucket03'));

// the bucket is ready to use, for example, create a file
const fileUri= (await myBucket.putFile('directory/test.txt', 'Hello world!')).result;
//the response will be: myprovider://bucket01/directory/test.txt
```

---

## 💥 Provider configuration options

You can set the configuration of the provider as an "url" or a [`FileSystemProviderConfig`](https://github.com/pablor21/bigbangjs-file-storage/tree/master/packages/filesystem/src/types.ts) object.

The url must be in the form:
```Typescript
<providerTypeName>://<pathToRoot>?name=<providerName>[&mode=0777][&signedUrlExpiration=3600][&autoCleanup=true|false]
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
}
```

---

## 💥 Bucket configuration options

You can set the configuration of the provider as an "url" or a [`FileSystemBucketConfig`](https://github.com/pablor21/bigbangjs-file-storage/tree/master/packages/filesystem/src/types.ts) object.

The url must be in the form:
```Typescript
<providerName>://<pathToRoot>?name=<bucketName>[&mode=0777][&signedUrlExpiration=3600][&autoCleanup=true|false]
```
The configuration object can have the following properties:
```typescript
{
    // the name of the bucket (required)
    name: string;
    // uri (optional) you can pass an uri as config
    uri?: string;
    // the name of the provider (this is required when you add the bucket directly to the storage instance, not when you add it to the provider instance)
    providerName?: string;
   // write/read mode in octal or string format [default:'0777']
    mode?: string | number;
    // delete empty directories (recommended) [default:true]
    autoCleanup?: boolean;
    // signed url expiration (in seconds) [default:3600]
    defaultSignedUrlExpiration?: number;
}
```

---
MIT License

Copyright (c) 2020 Pablo Ramírez <dev@pjramirez.com>