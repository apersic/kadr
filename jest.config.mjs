export default {
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module: "ESNext",
          moduleResolution: "bundler",
          target: "ES2022",
          strict: true,
          esModuleInterop: true,
          isolatedModules: true,
          jsx: "react-jsx",
          types: ["jest", "node"],
        },
      },
    ],
  },
  testMatch: ["<rootDir>/test/**/*.test.ts", "<rootDir>/test/**/*.test.mjs"],
};
