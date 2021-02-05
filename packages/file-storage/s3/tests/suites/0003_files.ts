import { Bucket, Directory, ListResult } from '@bigbangjs/file-storage';
import fs from 'fs-extra';
import { generateBuckets, rootPath } from '../functions';
import https from 'https';



export const files003 = (autoRemove = true) => describe('Siute 003', () => {

    if (autoRemove) {
        beforeAll(async () => {
            fs.removeSync(rootPath)
        });
        afterAll(async () => {
            fs.removeSync(rootPath)
        });
    }

    test('Manipulate files', async () => {
        const storage = (await generateBuckets('test03'));
        const bucket01 = storage.getBucket('bucket01');
        expect(bucket01).toBeInstanceOf(Bucket);

        //save a simple text file
        const file = (await bucket01.putFile('/pepe/test 01.txt', 'Hello World! This file has been created from text')).result;
        expect((await bucket01.fileExists(file)).result).toBe(true);

        const fileFromBuffer = (await bucket01.putFile('test 02.txt', Buffer.from('Hello World! This file has been created from buffer'))).result;
        expect((await bucket01.fileExists(fileFromBuffer)).result).toBe(true);
        const request = await makeRequest('https://kitsu.io/api/edge/anime');
        const fileFromStream = (await bucket01.putFile('test 03.json', request)).result;
        expect((await bucket01.fileExists(fileFromStream)).result).toBe(true);

        //get the file from the storage
        

        await bucket01.delete(file);
    })


});

function makeRequest(url: string): Promise<any> {
    const p = new Promise((resolve) => {
        https.get(url, response => resolve(response));
    });
    return p;
}