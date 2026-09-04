/** @type {import('jest').Config} */
module.exports = {
  rootDir: "src",
  testEnvironment: "node",
  transform: {
    "^.+\\.(t|j)s$": [
      "@swc/jest",
      {
        swcrc: false,
        jsc: {
          parser: { syntax: "typescript", decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
          target: "es2022",
        },
      },
    ],
  },
  // @nestjs/jwt (and its jsonwebtoken/jwa/jws deps) ship as ESM — needs transforming too,
  // unlike the rest of node_modules which stays untouched CJS. `.*` (not `node_modules/`
  // right before the package) because pnpm nests every package under
  // node_modules/.pnpm/<name>@<version>/node_modules/<name>, which a plain
  // "node_modules/(?!pkg)" pattern doesn't see past.
  transformIgnorePatterns: ["node_modules/(?!.*(jsonwebtoken|jwa|jws|@nestjs\\+jwt|@nestjs/jwt))"],
  testRegex: ".*\\.spec\\.ts$",
  moduleFileExtensions: ["js", "json", "ts"],
  collectCoverageFrom: ["**/*.(t|j)s"],
  coverageDirectory: "../coverage",
};
