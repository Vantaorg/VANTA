import java.net.URI

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

val releaseKeystorePath = System.getenv("ANDROID_KEYSTORE_PATH")
val releaseKeystorePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
val releaseKeyAlias = System.getenv("ANDROID_KEY_ALIAS")
val releaseKeyPassword = System.getenv("ANDROID_KEY_PASSWORD")

android {
    namespace = "com.vanta.app"
    compileSdk = 36

    buildFeatures { buildConfig = true }

    defaultConfig {
        applicationId = "com.vanta.app"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("String", "VANTA_ORIGIN", "\"https://vanta-nu.vercel.app\"")
    }

    signingConfigs {
        create("release") {
            if (!releaseKeystorePath.isNullOrBlank()) storeFile = file(releaseKeystorePath)
            storePassword = releaseKeystorePassword
            keyAlias = releaseKeyAlias
            keyPassword = releaseKeyPassword
        }
    }

    buildTypes {
        debug {
            // Debug APKs use production by default. Developers can opt into a
            // current preview explicitly with -PVANTA_DEBUG_ORIGIN=https://...
            val debugOrigin = providers.gradleProperty("VANTA_DEBUG_ORIGIN")
                .orElse("https://vanta-nu.vercel.app")
                .get()
            val parsedDebugOrigin = URI(debugOrigin)
            require(
                parsedDebugOrigin.scheme == "https" &&
                    !parsedDebugOrigin.host.isNullOrBlank() &&
                    parsedDebugOrigin.rawUserInfo == null &&
                    parsedDebugOrigin.rawQuery == null &&
                    parsedDebugOrigin.rawFragment == null &&
                    (parsedDebugOrigin.rawPath.isNullOrEmpty() || parsedDebugOrigin.rawPath == "/")
            ) {
                "VANTA_DEBUG_ORIGIN must be an HTTPS origin without credentials, path, query, or fragment"
            }
            val escapedDebugOrigin = debugOrigin.replace("\\", "\\\\").replace("\"", "\\\"")
            buildConfigField("String", "VANTA_ORIGIN", "\"$escapedDebugOrigin\"")
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation(platform("com.google.firebase:firebase-bom:34.5.0"))
    implementation("com.google.firebase:firebase-messaging")
}
