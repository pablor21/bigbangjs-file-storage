import { FileStorage } from "@bigbangjs/file-storage";
import { S3Provider, S3ProviderConfig } from "../src";
import path from 'path';

FileStorage.registerProviderType('s3', S3Provider);
const credentialsFile = path.join(__dirname, '..', 'private', 'credentials.json');
export async function generateStorage(testName: string) {
    const context: any = {};
    context.storage = new FileStorage({
        logger: false
    });
    const storage = context.storage;
    // provider config
    const objProviderConfig01: S3ProviderConfig = {
        uri: `s3://us-east-2/?keyFile=${credentialsFile}`
    };

    await storage.addProvider('provider01', objProviderConfig01);
    await storage.addProvider('provider02', objProviderConfig01);
    return context;
}

export async function generateBuckets(testName: string) {
    const storage = (await generateStorage(testName)).storage as FileStorage;
    (await storage.getProvider('provider01').addBucket('bucket01', { bucketName: 'bigbangtest01', tyCreate: true }));
    (await storage.getProvider('provider01').addBucket('bucket02', { bucketName: 'bigbangtest02', tyCreate: true }));
    return storage;
}