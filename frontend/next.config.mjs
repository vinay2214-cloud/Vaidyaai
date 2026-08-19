/** @type {import('next').NextConfig} */

// Validate Firebase configuration at startup
const requiredFirebaseVars = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_APP_ID"
];

const missingVars = requiredFirebaseVars.filter(
  (key) => !process.env[key] || process.env[key].includes("YOUR_REAL_FIREBASE_API_KEY") || process.env[key].includes("AIzaSy_MOCK")
);

// NEXT_PUBLIC_* values are inlined at BUILD time. A production image built without
// them ships a frontend whose Firebase Auth can never work (OTP send fails, no
// session is ever established), and the failure only surfaces in the browser.
// Fail the build loudly instead of shipping a broken login screen.
//
// Only enforce during the production build phase: at container runtime (`next
// start`) these variables are already baked into the bundle and are not required
// to be present in the environment again.
// `next build` invokes this config with "build" in argv; `next start` does not.
// NEXT_PHASE is not populated by Next 14 here, so argv is the reliable signal.
const isProductionBuild =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.argv.includes("build");

if (missingVars.length > 0) {
  const details = missingVars.map((v) => `   - ${v}`).join("\n");
  if (isProductionBuild) {
    throw new Error(
      `\n[VaidyaAI Build Error] Refusing to build a production image with missing or ` +
      `placeholder Firebase credentials:\n${details}\n\n` +
      `Pass them as Docker build args / Cloud Build substitutions ` +
      `(see infrastructure/frontend-cloudbuild.yaml).\n`
    );
  }
  console.warn(
    `\n⚠️  [VaidyaAI Warning] Missing or unpopulated Firebase credentials in frontend/.env.local:\n` +
    details +
    `\n   Please update frontend/.env.local with your real Web App keys from Firebase Console.\n`
  );
}

const nextConfig = {
  reactStrictMode: true,
  output: "standalone"
};

export default nextConfig;
