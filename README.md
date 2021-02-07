# 💥 BigBangJS File Storage

`@bigbangjs/file-storage` an unified API for file storage in  [Node.js](https://nodejs.org).

---

## 🚀 Quick start

1. **Install the package using npm or yarn**

```bash
$ npm i @bigbangjs/file-storage
# or
$ yarn add @bigbangjs/file-storage
```

2. **Install the client provider that you want to use**

Currently there are three providers that you can use:
- `@bigbangjs/file-storage-filesystem` Manager for the local filesystem
- `@bigbangjs/file-storage-s3` Amazon s3 storage
- `@bigbangjs/file-storage-gcs` Google cloud storage

***Please read the documentation of each provider for the documentation about the configuration options***

1. **Register the provider globally in the storage**

```typescript
import {FilesystemProvider} from '@bigbangjs/file-storage-filesystem';

FileStorage.registerProviderType('fs', FilesystemProvider);
```

4. **Init the Storage and add a provider instance and buckets**
```typescript
// example for filesystem storage
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
const myProvider=(await storage.addProvider('myprovider', {
    uri: 'fs://<pathToRoot>',
})).result;

// add a bucket
const myBucket=(await myProvider.addBucket('bucket01', { root: 'bucket01' }));

// the bucket is ready to use, for example, create a file
const fileUri= (await myBucket.putFile('directory/test.txt', 'Hello world!')).result;
//the response will be: myprovider://bucket01/directory/test.txt
```
---

> ❗ **Important**:
All async storage operations are wrapped in an object of type StorageResponse that contains the result of the operation and the provider native response, when you want to access to the result (for example save a file and get the uri back) you need to do (await operation()).result
---

> 🤟 The clients are ready-to-use, you don't need to install extra dependencies by yourself. (for example `@bigbangjs/file-storage-s3` comes with the aws-sdk package as dependency) 

---

> ❗ **Important**:
This libary uses a convention (AWS S3 like) to distingish between files and directories: **a directory name must end with "/" or be an empty string, everything that is not a directory, is a file.**

---

## ❓File URI 

You should note that the file operations returns a File object or a uri, the uri is an abstraction, so you can obtain the file back from that. You won't get the native filepath unless you call storage.getNativePath(uri)

You likely never will need the native filepath to use the library

---

## 💥 Creating files
---
## 💥 Deleting files
---
## 💥 Copy/Move a single file
---
## 💥 Copy/Move multiple files
---
## 💥 Listing files
---
## 💥 Getting the file contents
---
## 💥 Cross bucket operations
---
## 💥 Cross provider operations