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
- [`@bigbangjs/file-storage-filesystem`](packages/filesystem) Manager for the local filesystem
- [`@bigbangjs/file-storage-s3`](packages/s3) Amazon s3 storage
- [`@bigbangjs/file-storage-gcs`](packages/gcs) Google cloud storage

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
const myProvider=(await storage.addProvider({
    uri: 'fs://<pathToRoot>',
    name: 'myprovider'
})).result;

// add a buckets (you can add the buckets to the provider instance or the storage root instance)
const myBucket=(await myProvider.addBucket({name: 'bucket01', root: 'bucket01' }));
const myBucket2=(await myProvider.addBucket('myprovider://bucket02?name=bucket02'));
const myBucket3=(await storage.addBucket('myprovider://bucket02?name=bucket02'));

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
This libary uses a convention to distingish between files and directories: **a directory name must end with "/" or be an empty string, everything that is not a directory, is a file.** 
This behavior has an important impact when you copy/move files, if you copy/move a file called file01.txt to a location endend in "/", ex: destination/, then the file will be copied/moved to destination/file01.txt, if the destination doesn't end with "/" then the file will be copied/moved to "destination" (a file without extension)
---

## ❓File URI 

You should note that the file operations returns a File object or a uri, the uri is an abstraction, so you can obtain the file back from that. You won't get the native filepath unless you call storage.getNativePath(uri)

You likely never will need the native filepath to use the library

---
## 💥 Getting a bucket instance

After you've added your providers instances to the storage manager, you can access to the buckets without getting the provider instance first, you simply can do:

```typescript
const bucket=storage.getBucket('bucket01');

// do something with the bucket
```

---
## 💥 Creating files

```typescript
const bucket=storage.getBucket('bucket01');
// obtains the file uri
const fileUri=(await bucket.putFile('file01.txt', 'My content')).result;
// obtains the file object
const fileObject=(await bucket.putFile('file01.txt', 'My content', {returning:true})).result;
```

Method signature:

```typescript
putFile<RType extends IStorageFile | string = IStorageFile>(fileName: string | IStorageFile, contents: string | Buffer | Streams.Readable | IncomingMessage, options?: CreateFileOptions): Promise<StorageResponse<RType, NativeResponseType>>;
```

In the options parameter you can indicate if you want the StorageFile object instance or just the storage uri.

---
## 💥 Deleting files

```typescript
const bucket=storage.getBucket('bucket01');
// obtains the file uri
const result=(await bucket.deleteFile('file01.txt')).result;
```

Method signature:

```typescript
deleteFile(dir: string | IStorageFile, options?: DeleteFileOptions): Promise<StorageResponse<boolean, NativeResponseType>>;

```

>❗ The `dir` parameter must be a file, and can be a file uri or the path of the file inside the bucket.

This method doesn't check if the file exists or not, if the file doesn't exists, the response will be true.

---
## 💥 Copy/Move a single file

The copy and move methods are similar (I'm sure you knew that 😀)

```typescript
const bucket=storage.getBucket('bucket01');
// Copy using relative paths
const result=(await bucket.copyFile('file01.txt', 'file02.txt')).result;
// Copy using file uri
const result=(await bucket.copyFile('file01.txt', 'provider01://bucket01/file02.txt')).result;
// Copy using file uri (different buckets)
const result=(await bucket.copyFile('file01.txt', 'provider01://bucket02/file02.txt')).result;
```

Method signature:

```typescript
copyFile<RType extends IStorageFile | string = IStorageFile>(src: string | IStorageFile, dest: string | IStorageFile, options?: CopyFileOptions): Promise<StorageResponse<RType, NativeResponseType>>;

moveFile<RType extends IStorageFile | string = IStorageFile>(src: string | IStorageFile, dest: string | IStorageFile, options?: MoveFileOptions): Promise<StorageResponse<RType, NativeResponseType>>;

```

>❗ The `src` parameter must be a file. The `dest` parameter can be a file or a path, if a file is passed, the file will be copied/moved to the dest, if it's a directory, the destination will be `dest/src`.

---
## 💥 Listing files

```typescript
const bucket=storage.getBucket('bucket01');
// obtains the file uri
const entries=(await bucket.listFiles('/', {recursive:true, returning:true, pattern: '**'})).result.entries;
```
Method signature:

```typescript
listFiles<RType extends IStorageFile[] | string[] = IStorageFile[]>(path?: string, options?: ListFilesOptions): Promise<StorageResponse<ListResult<RType>, NativeResponseType>>;
```

>❗ The `path` parameter must be a directory. You can pass a pattern (glob or regex) to filter the results.

---
## 💥 Copy/Move multiple files

You can copy/move multiple files, the method is a list + copy/move over each item result

```typescript
const bucket=storage.getBucket('bucket01');
// obtains the file uri
const result=(await bucket.copyFiles('/', 'moved/', '*.txt').result;
```

Method signature:

```typescript
copyFiles<RType extends IStorageFile[] | string[] = IStorageFile[]>(src: string, dest: string, pattern: Pattern, options?: CopyManyFilesOptions): Promise<StorageResponse<RType, NativeResponseType>>;

moveFiles<RType extends IStorageFile[] | string[] = IStorageFile[]>(src: string, dest: string, pattern: Pattern, options?: MoveManyFilesOptions): Promise<StorageResponse<RType, NativeResponseType>>;
```

---
## 💥 Getting the file contents

You can get the file contents as a ReadableStream or a Buffer, if you want a "part" of the contents you can pass start/end options to the method


```typescript
const bucket=storage.getBucket('bucket01');
// Obtains the contents as a Buffer
const result=(await bucket.getFileContents('test01.txt').result;
// Obtains the contents as a ReadableStream (1024 bytes)
const result=(await bucket.getFileStream('test01.txt', {start:0, end:1024}).result;
```

---
## 💥 Cross bucket operations

Copy and move operations can be performed between buckets inside the same provider instance. If you want to use this feature you must pass a complete uri to the `dest` parameter of the methods `copyFile`, `moveFile`, `copyFiles` and `moveFiles`.

The feature works ONLY if the INSTANCES `(provider01 === provider02)` of the providers are the same, it won't work if you have two providers with the same configuration but different names/instances.

---
## 💥 Cross provider operations

Copy and move operations can be performed between providers. To use this feature you must call  `copyFile`, `moveFile`, `copyFiles` and `moveFiles` of the `FileStorage` instance, and pass a full uri as `src` and `dest` parameters.

Example:

```typescript
// storage is a FileStorage instance

// copy 1 file
const copy = await storage.copyFile(bucket01.getStorageUri('file01.txt'), bucket03.getStorageUri('cross-copy.txt'));

// copy multiple files
const copy2 = await storage.copyFiles(bucket01.getStorageUri('/'), bucket02.getStorageUri('multiple copy/'), '**');

// move 1 file
const moved = await storage.moveFile(bucket01.getStorageUri('file01.txt'), bucket02.getStorageUri('cross-move.txt'));

// move multiple files
const moved2 = await storage.moveFiles(bucket01.getStorageUri('/'), bucket02.getStorageUri('cross-move/'), '**');
```

>❗ These methods could be very expensive in terms of memory and time, because the copy/move operations are made calling a `getFileStream` of the `src` and writing into `dest` calling `putFile`.

---
## 💥 Slug / Glob / Mimes

The package comes with a basic slug function, you can provide your own function setting the `slugFn` configuration parameter in the `FileStorage` constructor.

A valid slug function must have the following signature:
```typescript
(input: string, replacement?: string) => string
```

*If you don't want the filenames to be slugged (?), then you can set `slugFn` to `false`*

---

If you want to get the mimetype of the files, you will need to provide a function or install the mime package,

```bash
npm install mime
```

You can set your own mime function setting the `mimeFn` configuration parameter.
A valid mime function must have the following signature:
```typescript
(fileName: string) => string | Promise<string>
```
---
The `Pattern` parameter on `listFiles`, `moveFiles`, `copyFiles`, `deleteFiles` can be a `RegExp` or a `glob` string, to use the patterns as a glob you need to install the `minimatch` package:

```bash
npm install minimatch
```

You can set your own matcher class setting the `matcherType` configuration parameter, the matcher must be a class that implements the [`IMatcher`](./packages/core/src/lib/matcher.ts). The storage will instantiate the matcher class as needed.

---
## 💥 Configuration options for the FileStorage

You can pass a [`FileStorageConfigOptions`]()

The configuration has the following properties:
```typescript
{
     /**
     * The default permissions mode for the buckets
     */
    defaultBucketMode: string;
    /**
     * Naming strategy for the buckets in the global registry
     */
    bucketAliasStrategy: 'NAME' | 'PROVIDER:NAME' | ((name: string, provider: IStorageProvider) => string);
    /**
     * Auto init providers? This will make to call init() on the provider when it's added to the storage
     */
    autoInitProviders: boolean;
    /**
     * Default bucket name
     */
    defaultBucketName?: string;
    /**
     * Return instances of file/directory by default? (can be overriden by the get/list/create methods config)
     */
    returningByDefault?: boolean;

    /**
     * Function to obtain a mime type based on the fileName
     */
    mimeFn?: (fileName: string) => string | Promise<string>;

    /**
     * Slug function
     */
    slugFn?: (input: string, replacement?: string) => string;

    /**
     * File url generator
     */
    urlGenerator?: (uri: string, options?: any) => Promise<string>;

    /**
     * Signed url generator
     */
    signedUrlGenerator?: (uri: string, options?: SignedUrlOptions) => Promise<string>;

    /**
     * signed url default expiration time (in seconds)
     */
    defaultSignedUrlExpiration: number;

    /**
     * Function to obtain a regex based on glob pattern
     */
    matcherType?: new () => IMatcher;

    /**
     * Logger class
     */
    logger?: LoggerType | boolean;
    /**
     * Auto remove empty directories
     */
    autoCleanup?: boolean;
}
```

---
## 💥 Cloning / Testing

To perform the tests you will need to provide the credentials for each provider, a `credentials.example.json` is provided for each client.

Running the tests (on the root path or inside a provider folder)

```
yarn test
```
---
## 💥 ToDo
- [ ] Better docs!
- [ ] Drink coffe after finish!

---
MIT License

Copyright (c) 2020 Pablo Ramírez <dev@pjramirez.com>