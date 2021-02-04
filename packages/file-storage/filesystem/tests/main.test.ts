import { storage001 } from "./suites/0001_storage";
import { directories002 } from "./suites/0002_directories";

// describe('to delete', async () => {

//     const allDirs = await fs.readdir('./', { withFileTypes: true });
//     console.log(allDirs);
// })


describe('Runing tests', () => {


    storage001();
    directories002();
})