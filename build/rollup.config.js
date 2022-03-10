import resolve from "@rollup/plugin-node-resolve"
import commonjs from "@rollup/plugin-commonjs"

export default [
    {
        input: "src/entry/browser.js",
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
    },
    {
        input: "src/entry/node.js",
        output: {
            format: "cjs",
            file: "node.js"
        },
        plugins: [
            resolve(),
            commonjs()
        ]
    }
]
