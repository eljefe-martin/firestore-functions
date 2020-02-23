1 - Start emulators
2 - export FIRESTORE_EMULATOR_HOST=<localhost:port>
3 - use @firebase/testing to create an app using initTestApp
    pass an object with {projectId, auth}
4 - check firestore.rules
5 - create a db to write to