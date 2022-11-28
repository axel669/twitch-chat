import resolve from "@rollup/plugin-node-resolve"
import commonjs from "@rollup/plugin-commonjs"

export default [
    {
        input: "src/entry/browser.js",
        output: [
            {
                format: "iife",
                file: "browser/twitch.js",
                name: "twitch",
            },
            {
                format: "esm",
                file: "browser/module.mjs"
            },
        ],
        plugins: [
            resolve()
        ]
    },
    {
        input: "src/entry/node.js",
        output: {
            format: "esm",
            file: "node/index.mjs"
        },
        external: [
            "node-fetch",
            "ws",
        ],
        plugins: [
            resolve(),
            commonjs()
        ]
    }
]
