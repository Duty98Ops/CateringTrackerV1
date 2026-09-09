// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   output: process.env.CAPACITOR_BUILD === "true" ? "export" : undefined,
//   async rewrites() {
//     if (process.env.CAPACITOR_BUILD === "true") return [];
//     return [
//       {
//         source: "/api/:path*",
//         destination: "http://localhost:5000/api/:path*",
//       },
//     ];
//   },
// };

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.CAPACITOR_BUILD === "true" ? "export" : undefined,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://liquefy-crinkle-criteria.ngrok-free.dev/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;