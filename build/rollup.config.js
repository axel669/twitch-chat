import resolve from "@rollup/plugin-node-resolve"

export default {
    input: "index.js",
    output: {
        format: "iife",
        file: "dist/twitch-chat.js",
        name: "Chat",
    },
    plugins: [
        resolve()
    ]
}
