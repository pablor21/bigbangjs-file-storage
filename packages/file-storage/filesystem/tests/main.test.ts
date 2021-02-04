import { storage001 } from "./suites/0001_storage";
import { storageMethods002 } from "./suites/0002_storagemethods";
import fs from 'fs-extra';

// describe('to delete', async () => {

//     const allDirs = await fs.readdir('./', { withFileTypes: true });
//     console.log(allDirs);
// })


describe('Runing tests', () => {


    storage001();
    storageMethods002();
})