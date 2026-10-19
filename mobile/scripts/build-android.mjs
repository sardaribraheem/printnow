import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = {
  ...process.env,
  CI: "1",
  EXPO_NO_TELEMETRY: "1",
  GRADLE_USER_HOME:
    process.env.GRADLE_USER_HOME || resolve(root, ".gradle-home"),
};
if (!env.ANDROID_HOME && !env.ANDROID_SDK_ROOT)
  throw new Error(
    "Install Android Studio/SDK and set ANDROID_HOME before building.",
  );
const run = (command, args, cwd = root) =>
  execFileSync(command, args, { cwd, env, stdio: "inherit" });
run(process.execPath, [
  "node_modules/expo/bin/cli",
  "prebuild",
  "--platform",
  "android",
  "--no-install",
]);
const wrapperPath = resolve(
  root,
  "android/gradle/wrapper/gradle-wrapper.properties",
);
let wrapper = await readFile(wrapperPath, "utf8");
const distribution = wrapper
  .match(/^distributionUrl=(.+)$/m)?.[1]
  .replaceAll("\\:", ":");
if (
  !distribution ||
  !/^https:\/\/services\.gradle\.org\/distributions\/gradle-[\d.]+-bin\.zip$/.test(
    distribution,
  )
)
  throw new Error("Unexpected Gradle distribution URL.");
const response = await fetch(distribution + ".sha256");
if (!response.ok)
  throw new Error(
    "Unable to obtain the official Gradle distribution checksum.",
  );
const checksum = (await response.text()).trim();
if (!/^[a-f0-9]{64}$/.test(checksum))
  throw new Error("Invalid official Gradle checksum.");
const existing = wrapper.match(/^distributionSha256Sum=(.+)$/m)?.[1];
if (existing && existing !== checksum)
  throw new Error("Gradle checksum changed; investigate before building.");
if (!existing) {
  wrapper += "\ndistributionSha256Sum=" + checksum + "\n";
  await writeFile(wrapperPath, wrapper);
}
const proxyValue = env.HTTPS_PROXY || env.https_proxy;
const args = [
  ":app:assembleRelease",
  "--no-daemon",
  "--max-workers=2",
  "-PreactNativeArchitectures=arm64-v8a,x86_64",
  "-Dorg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8",
];
if (proxyValue) {
  const proxy = new URL(proxyValue);
  // Use the configured network route without copying credentials or disabling TLS.
  const proxyArgs = [
    "-Dhttps.proxyHost=" + proxy.hostname,
    "-Dhttps.proxyPort=" + (proxy.port || "80"),
    "-Dhttp.proxyHost=" + proxy.hostname,
    "-Dhttp.proxyPort=" + (proxy.port || "80"),
  ];
  env.GRADLE_OPTS = (env.GRADLE_OPTS || "") + " " + proxyArgs.join(" ");
  args.push(...proxyArgs, "-Dhttp.nonProxyHosts=localhost|127.*");
}
run(
  process.platform === "win32" ? "gradlew.bat" : "./gradlew",
  args,
  resolve(root, "android"),
);
await mkdir(resolve(root, "builds"), { recursive: true });
await copyFile(
  resolve(root, "android/app/build/outputs/apk/release/app-release.apk"),
  resolve(root, "builds/printnow-preview.apk"),
);
console.log(
  "Internal testing APK: mobile/builds/printnow-preview.apk (development signing; not a store release).",
);
