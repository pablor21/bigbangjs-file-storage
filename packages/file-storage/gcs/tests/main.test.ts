import path from 'path';
import { Bucket, StorageFile, FileStorage } from '@bigbangjs/file-storage';
import https from 'https';
import fs from 'fs';
import { GCSProvider, GCSProviderConfig } from '../src';

describe('S3 tests', () => {
    const credentialsFile = path.join(__dirname, 'credentials.json');
    const rootConfig = JSON.parse(fs.readFileSync(credentialsFile).toString());
    const clearBuckets = true;
    test('Storage operations', async () => {
        FileStorage.registerProviderType('gcs', GCSProvider);
        expect(rootConfig).toBeTruthy();
        const storage = new FileStorage({
            logger: false,
        });


        const urlProviderConfig02: GCSProviderConfig = {
            uri: `gcs://${credentialsFile}`,
            projectId: rootConfig.project_id,
        };


        const provider01 = (await storage.addProvider('provider01', urlProviderConfig02)).result;
        expect(provider01).toBeInstanceOf(GCSProvider);
        expect(storage.getProvider('provider01')).toBe(provider01);

        // add the buckets
        await Promise.all(rootConfig.buckets.map(async (b: any) => {
            expect((await provider01.addBucket(b.name, b)).result).toBeInstanceOf(Bucket);
        }));


    })

});