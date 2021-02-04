import path from 'path';
import fs from 'fs-extra';
import { Bucket, FileStorage, StorageException } from '@bigbangjs/file-storage';
import { FilesystemProvider, FileSystemProviderConfig, FileSystemBucketConfig } from '../../src';
import { generateBuckets, generateStorage, rootPath } from '../functions';


beforeAll(async () => {
    fs.removeSync(rootPath)
});
afterAll(async () => {
    fs.removeSync(rootPath)
});



export const storage001 = () => describe('Suite 001', () => {
    const storage = new FileStorage({
        logger: false
    });

    // provider config
    const objProviderConfig01: FileSystemProviderConfig = {
        type: 'fs',
        mode: "0777",
        root: path.join(rootPath, 'test01')
    };

    const urlProviderConfig01: FileSystemProviderConfig = {
        uri: "fs://./private/test-storage/test02?mode=0777&name=provider02",
    }

    test('Instantiate an provider from config', async () => {
        const provider = (await storage.addProvider('provider01', objProviderConfig01)).result;
        expect(provider).toBeInstanceOf(FilesystemProvider);
        const fromStorage = storage.getProvider('provider01');
        expect(fromStorage).toBeInstanceOf(FilesystemProvider);
        expect(provider).toBe(fromStorage);
        expect(provider.name).toBe('provider01');
    });


    test('Instantiate an provider from uri', async () => {
        const provider = (await storage.addProvider('provider02', urlProviderConfig01)).result;
        expect(provider).toBeInstanceOf(FilesystemProvider);
        const fromStorage = storage.getProvider('provider02');
        expect(fromStorage).toBeInstanceOf(FilesystemProvider);
        expect(provider).toBe(fromStorage);
        expect(provider.name).toBe('provider02');
    });

});


describe('Manipulate buckets', () => {
    test('Add a bucket from config', async () => {
        const storage = (await generateStorage('test01')).storage;


        // bucket config
        const objBucketConfig01: FileSystemBucketConfig = {
            root: 'bucket01'
        }

        const provider = storage.getProvider('provider01');
        const provider02 = storage.getProvider('provider02');
        const bucket01 = (await provider?.addBucket('bucket01', objBucketConfig01))?.result;

        expect(bucket01).toBeInstanceOf(Bucket);
        expect(bucket01?.name).toBe('bucket01');
        expect(bucket01?.provider.name).toBe('provider01');

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
            const bucket = (await provider02?.addBucket('bucket01', objBucketConfig01))?.result;
        } catch (ex) {
            error = ex;
        }
        expect(error).toBeInstanceOf(StorageException);
        expect(error.message).toBe(`The bucket bucket01 already exists!`);

        // should allow to add a bucket if the container provider has been deleted
        await storage.disposeProvider(provider!.name);
        const bucket02 = (await provider02?.addBucket('bucket01', objBucketConfig01))?.result;
        const bucket03 = await provider02?.getBucket('bucket01');
        expect(bucket03).toBe(bucket02);
        expect(bucket02).toBeInstanceOf(Bucket);
        expect(bucket02?.name).toBe('bucket01');
        expect(bucket02?.provider.name).toBe(provider02!.name);

        const bucket04 = storage.getBucket('bucket01');
        expect(bucket04).toBe(bucket02);
    });

    test('Add a bucket from using PROVIDER:NAME strategy', async () => {
        const storage = (await generateStorage('test01')).storage as FileStorage;

        storage.config.bucketAliasStrategy = "PROVIDER:NAME";
        // bucket config
        const objBucketConfig01: FileSystemBucketConfig = {
            root: 'bucket01'
        }

        const provider = storage.getProvider('provider01');
        const provider02 = storage.getProvider('provider02');
        const bucket01 = (await provider?.addBucket('bucket01', objBucketConfig01))?.result;

        expect(bucket01).toBeInstanceOf(Bucket);
        expect(bucket01?.name).toBe('bucket01');
        expect(bucket01?.provider.name).toBe('provider01');

        // should throw an exeption when the name already exists
        let error = null;
        try {
            await provider?.addBucket('bucket01', objBucketConfig01);
        } catch (ex) {
            error = ex;
        }
        expect(error).toBeInstanceOf(StorageException);

        const bucket02 = (await provider02?.addBucket('bucket01', objBucketConfig01))?.result;
        const bucket03 = provider02?.getBucket('bucket01');
        expect(bucket03).toBe(bucket02);
        expect(bucket02).toBeInstanceOf(Bucket);
        expect(bucket02?.absoluteName).toBe('provider02:bucket01');
        expect(bucket02?.provider.name).toBe(provider02!.name);

        const bucket04 = storage.getBucket('provider02:bucket01');
        expect(bucket04).toBe(bucket02);
    });

});
