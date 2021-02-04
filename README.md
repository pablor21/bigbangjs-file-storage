# 💥 BigBangJS File Storage

`@bigbangjs/file-storage` is a framework that provides an unified API for file storage in  [Node.js](https://nodejs.org) different file storage providers.

---

## 🚀 Quick start

Install the package using npm or yarn

```bash
$ npm i @bigbangjs/file-storage
# or
$ yarn add @bigbangjs/file-storage
```

Install the client adapter that you want to use

- `@bigbangjs/file-storage-filesystem` Manager for the local filesystem
- `@bigbangjs/file-storage-s3` Amazon s3 storage
- `@bigbangjs/file-storage-gcs` Google cloud storage

🤟 The clients are ready-to-use, you don't need to install extra dependencies by yourself. (for example `@bigbangjs/file-storage-s3` comes with the aws-sdk package as dependency)