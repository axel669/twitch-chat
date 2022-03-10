import EventBridge from "@axel669/event-bridge/esm"

import { WebSocket } from "./websocket.js"

const Pubsub = (options) => {
    const bridge = EventBridge()
    const { user, topics } = options || {}

    if (user === undefined) {
        return new Error("Invalid config: user not provided")
    }
    if (user.id === undefined) {
        return new Error("Invalid config: user.id not provided")
    }
    if (user.token === undefined) {
        return new Error("Invalid config: user.token not provided")
    }
    if (topics === undefined || topics.length === 0) {
        return new Error("Invalid config: topics not provided")
    }

    let socket = null
    const pubsubTopics = topics.map(
        topic => `${topic}.${user.id}`
    )
    const connect = () => new Promise(
        resolve => {
            if (socket !== null) {
                resolve(false)
                return
            }
            socket = new WebSocket("wss://pubsub-edge.twitch.tv")

            socket.addEventListener(
                "open",
                () => {
                    const nonce = `${Date.now()}.${Math.random().toString(16)}`

                    socket.addEventListener(
                        "message",
                        (evt) => {
                            const message = JSON.parse(evt.data)

                            if (message.type === "MESSAGE") {
                                const { data, ...parts } = JSON.parse(
                                    message.data.message
                                )
                                const [type] = message.data.topic.split(".")
                                bridge.emit(
                                    type,
                                    {
                                        topic: message.data.topic,
                                        ...parts,
                                        ...data,
                                    }
                                )
                                return
                            }

                            bridge.emit(message.type, message)
                        }
                    )
                    bridge.once(
                        "RESPONSE",
                        ({ data }) => {
                            if (data.nonce !== nonce) {
                                resolve(
                                    new Error("Connection is compromised")
                                )
                                return
                            }
                            if (data.error !== "") {
                                resolve(
                                    new Error(data.error)
                                )
                                return
                            }
                            bridge.emit("connect", "pubsub")
                            resolve(true)
                        }
                    )
                    socket.send(
                        JSON.stringify({
                            type: "LISTEN",
                            nonce,
                            data: {
                                topics: pubsubTopics,
                                auth_token: user.token
                            }
                        })
                    )
                }
            )
        }
    )
    const disconnect = () => {
        if (socket === null) {
            return
        }
        socket.close()
        socket = null
        bridge.emit("disconnect", "pusub")
    }

    return {
        on: bridge.on,
        connect,
        disconnect,
    }
}

export default Pubsub
