import resolve from "@rollup/plugin-node-resolve"

export default {
    input: "src/lib.js",
    output: [
        {
            format: "iife",
            file: "dist/twitch.js",
            name: "twitch",
        },
        {
            format: "esm",
            file: "esm/index.js"
        },
        {
            format: "cjs",
            file: "index.js"
        }
    ],
    plugins: [
        resolve()
    ]
}
