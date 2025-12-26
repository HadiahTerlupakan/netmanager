#!/bin/bash

# Set Android Home explicitly for the build
export ANDROID_HOME=$HOME/Library/Android/sdk

echo "Using Android SDK at: $ANDROID_HOME"

# Ensure gradlew is executable
chmod +x android/gradlew

echo "Starting Gradle build (Skipping linting to avoid OutOfMemory)..."

# Run the build command directly with gradle to avoid EAS lint issues
cd android && ./gradlew assembleRelease -x lint -x lintVitalRelease && cd ..

# Move the APK
if [ -f "android/app/build/outputs/apk/release/app-release.apk" ]; then
    cp android/app/build/outputs/apk/release/app-release.apk netman.apk
    echo "✅ Build Success! APK created at: ./netman.apk"
else
    echo "❌ Build Failed! APK not found."
    exit 1
fi
