import { Bucket, FileStorage } from '../packages/file-storage/core/src';
import { FilesystemProvider, FileSystemProviderConfig } from '../packages/file-storage/filesystem/src';
import { S3Provider, S3ProviderConfig } from '../packages/file-storage/s3/src';
import path from 'path';

FileStorage.registerProviderType('s3', S3Provider);
FileStorage.registerProviderType('fs', FilesystemProvider);

describe('Storage tests', () => {


    const credentialsFile = path.join(__dirname, '..', 'packages', 'file-storage', 's3', 'private', 'credentials.json');

    test('Multiple buckets operations', async () => {
        const storage = new FileStorage({
            logger: false,
        });
        const urlProviderConfig01: FileSystemProviderConfig = {
            uri: 'fs://./private/multiple-storage/fsProvider?mode=0777&name=fsProvider',
        };
        const urlProviderConfig02: S3ProviderConfig = {
            uri: `s3://us-east-2/?keyFile=${credentialsFile}`,
        };
        const fsProvider = (await storage.addProvider('fsprovider', urlProviderConfig01)).result;
        const s3Provider = (await storage.addProvider('s3provider', urlProviderConfig02)).result;
        expect(fsProvider).toBeInstanceOf(FilesystemProvider);
        expect(s3Provider).toBeInstanceOf(S3Provider);

        const bucket01 = (await fsProvider.addBucket('bucket01')).result;
        const bucket02 = (await s3Provider.addBucket('bucket02', {
            bucketName: 'bigbangtest03',
            tryCreate: true,
        })).result;

        expect(bucket01).toBeInstanceOf(Bucket);
        expect(bucket02).toBeInstanceOf(Bucket);

        const file01 = (await bucket01.putFile('test.txt', 'Hello world!')).result;
        const copyResult = (await storage.copyFile(file01, bucket02.getStorageUri('copy test.txt'))).result;
        expect((await bucket02.fileExists(copyResult)).result).toBe(true);

        const moveResult = (await storage.moveFile(file01, bucket02.getStorageUri('move test.txt'))).result;
        expect((await bucket02.fileExists(moveResult)).result).toBe(true);
        expect((await bucket01.fileExists(file01)).result).toBe(false);



    });
});
