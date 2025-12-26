# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Development Build (Native)

Since this app uses native modules (sqlite, netinfo, camera), you must use a **Development Build**, not Expo Go.

### Prerequisities

1.  **Android Studio** installed & SDK set up.
2.  **Java JDK 17** (or 11) installed.
3.  `local.properties` file exists in `android/` with `sdk.dir`.

### Rebuild Command

To compile and install the native android app (Debug mode):

```bash
npx expo run:android
```

This command will:
1.  Run `prebuild` to generate native android folders.
2.  Compile the Gradle project.
3.  Install the `.apk` onto your connected emulator or device.
4.  Launch the metro bundler.

## How to Share APK (Build for Friend)

To generate a standalone APK file that you can send to a friend (does not require development server):

```bash
ANDROID_HOME=/Users/rohadimraja/Library/Android/sdk npx eas-cli build -p android --profile preview --local --output=./netman.apk
```

> **Note:** We need to specify `ANDROID_HOME` because the local build process might ignore your `local.properties` file.

This command will:
1.  Bundle the Javascript code inside the app.
2.  Generate a `netman.apk` file in the current folder.
3.  You can send this file via WhatsApp/Telegram to your friend.
