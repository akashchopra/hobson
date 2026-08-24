# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# Tauri plugin system is reflection-driven and R8 cannot see through it:
#   PluginHandle enumerates declaredMethods to find @Command methods by NAME
#   Invoke deserializes @InvokeArg classes via Jackson by FIELD NAME
# Without these, the app builds cleanly and then fails at runtime on device.
-keep @app.tauri.annotation.TauriPlugin class * { *; }
-keep @app.tauri.annotation.InvokeArg class * { *; }
-keepclassmembers class * {
  @app.tauri.annotation.Command <methods>;
}
-keep class app.tauri.** { *; }
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod

# Jackson resolves properties reflectively.
-keep class com.fasterxml.jackson.** { *; }
-dontwarn com.fasterxml.jackson.**

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile