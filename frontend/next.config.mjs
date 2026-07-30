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

if (missingVars.length > 0 && process.env.NODE_ENV !== "production") {
  console.warn(
    `\n⚠️  [VaidyaAI Warning] Missing or unpopulated Firebase credentials in frontend/.env.local:\n` +
    missingVars.map((v) => `   - ${v}`).join("\n") +
    `\n   Please update frontend/.env.local with your real Web App keys from Firebase Console.\n`
  );
}

const nextConfig = {
  output: "standalone",
  reactStrictMode: true
};

export default nextConfig;
