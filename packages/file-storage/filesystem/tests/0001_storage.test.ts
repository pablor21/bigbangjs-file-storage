import path from 'path';
import fs from 'fs-extra';
import { Bucket, FileStorage, StorageException } from '@bigbangjs/file-storage-core';
import { FilesystemProvider, FileSystemProviderConfig, FileSystemBucketConfig } from '../src';


FileStorage.registerProviderType('fs', FilesystemProvider);


const rootPath = path.resolve('./test-storage/');
beforeAll(async () => {
    fs.removeSync(rootPath)
});
afterAll(async () => {
    fs.removeSync(rootPath)
});

const storage = new FileStorage();


describe('Manipulate providers', () => {
    // provider config
    const objProviderConfig01: FileSystemProviderConfig = {
        root: path.join(rootPath, 'test1')
    };
    const urlProviderConfig01 = "fs://./test-storage/test2?name=storage2&mode=0777";


    test('Instantiate an provider from config', async () => {
        const provider = await storage.addProviderSession('fs', 'default', objProviderConfig01);
        expect(provider).toBeInstanceOf(FilesystemProvider);
        const fromStorage = storage.getProvider('default');
        expect(fromStorage).toBeInstanceOf(FilesystemProvider);
        expect(provider).toBe(fromStorage);
        expect(provider.name).toBe('default');
    });


    test('Instantiate an provider from uri', async () => {
        const provider = await storage.addProviderSessionFromUri(urlProviderConfig01);
        expect(provider).toBeInstanceOf(FilesystemProvider);
        const fromStorage = storage.getProvider('storage2');
        expect(fromStorage).toBeInstanceOf(FilesystemProvider);
        expect(provider).toBe(fromStorage);
        expect(provider.name).toBe('storage2');
    });

})

describe('Manipulate buckets', () => {
    test('Add a bucket from config', async () => {

        // bucket config
        const objBucketConfig01: FileSystemBucketConfig = {
            root: 'bucket01'
        }

        const provider = storage.getProvider('default');
        const provider02 = storage.getProvider('storage2');
        const bucket01 = await provider?.addBucket('bucket01', objBucketConfig01);

        expect(bucket01).toBeInstanceOf(Bucket);
        expect(bucket01?.name).toBe('bucket01');
        expect(bucket01?.provider.name).toBe('default');

        //should throw an exeption when the name already exists
        let error = null;
        try {
            await provider?.addBucket('bucket01', objBucketConfig01);
        } catch (ex) {
            error = ex;
        }
        expect(error).toBeInstanceOf(StorageException);
        expect(error.message).toBe(`The bucket bucket01 already exists!`);


        // should trhow the same error if the bucket is added to another provider with the same name
        error = null;
        try {
            const bucket = await provider02?.addBucket('bucket01', objBucketConfig01);
        } catch (ex) {
            error = ex;
        }
        expect(error).toBeInstanceOf(StorageException);
        expect(error.message).toBe(`The bucket bucket01 already exists!`);

        // should allow to add a bucket if the container provider has been deleted
        await storage.removeProviderSession(provider!.name);
        const bucket02 = await provider02?.addBucket('bucket01', objBucketConfig01);
        expect(bucket02).toBeInstanceOf(Bucket);
        expect(bucket02?.name).toBe('bucket01');
        expect(bucket02?.provider.name).toBe(provider02!.name);


    });

})
