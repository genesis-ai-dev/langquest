plugins {
  id("com.android.library")
  id("org.jetbrains.kotlin.android")
}

android {
  namespace = "expo.modules.microphoneenergy"
  compileSdk = 35

  defaultConfig {
    minSdk = 24
  }
}

dependencies {
  implementation(project(":expo-modules-core"))
  implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
}
