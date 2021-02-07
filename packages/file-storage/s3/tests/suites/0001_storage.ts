import { Bucket, FileStorage, StorageException } from '@bigbangjs/file-storage';
import { S3BucketConfig, S3Provider, S3ProviderConfig } from '../../src';
import { generateStorage } from '../functions';
import path from 'path';

const credentialsFile = path.join(__dirname, '..', '..','private', 'credentials.json');

export const suite001 = (autoRemove = true) => describe('Suite 001', () => {



    const storage = new FileStorage({
        logger: false
    });


    const objProviderConfig01: S3ProviderConfig = {
        region: 'us-east-2',
        keyFile: credentialsFile,
        type: 's3'
    };
    const urlProviderConfig02: S3ProviderConfig = {
        uri: `s3://us-east-2/?keyFile=${credentialsFile}`
    };


    test('Instantiate an provider from config', async () => {
        const provider = (await storage.addProvider('provider01', objProviderConfig01)).result;
        expect(provider).toBeInstanceOf(S3Provider);
        const fromStorage = storage.getProvider('provider01');
        expect(fromStorage).toBeInstanceOf(S3Provider);
        expect(provider).toBe(fromStorage);
        expect(provider.name).toBe('provider01');
    });


    test('Instantiate an provider from uri', async () => {
        const provider = (await storage.addProvider('provider02', urlProviderConfig02)).result;
        expect(provider).toBeInstanceOf(S3Provider);
        const fromStorage = storage.getProvider('provider02');
        expect(fromStorage).toBeInstanceOf(S3Provider);
        expect(provider).toBe(fromStorage);
        expect(provider.name).toBe('provider02');
    });


    describe('Manipulate buckets', () => {
        test('Add a bucket from config', async () => {
            const storage = (await generateStorage('test01')).storage;

            //list unregisterd buckets
            await storage.getProvider('provider01').listUnregisteredBuckets();

            // bucket config
            const objBucketConfig01: S3BucketConfig = {
                bucketName: 'bigbangtest01',
                tryCreate: true
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
            const objBucketConfig01: S3BucketConfig = {
                bucketName: 'bigbangtest01',
                tryCreate: true
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



});