import EventBridge from "@axel669/event-bridge/esm"

import { WebSocket } from "./websocket.js"
import { fetch } from "./fetch.mjs"

const EventSub = (options) => {
    const bridge = EventBridge()
    const { user, topics, clientID } = options || {}

    let socket = null
    let sessionID = null

    const url = "https://api.twitch.tv/helix/eventsub/subscriptions"
    const addsub = async (type) => {
        console.log(`adding listener: ${type}`)
        const res = await fetch(
            url,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${user.token}`,
                    "Client-Id": clientID,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    type,
                    version: "1",
                    condition: {
                        broadcaster_user_id: user.id
                    },
                    transport: {
                        method: "websocket",
                        session_id: sessionID,
                    }
                })
            }
        )
        console.log(`${res.ok ? "success" : "failed"}: ${type}`)

        return await res.json()
    }

    const connect = () => new Promise(
        resolve => {
            if (socket !== null) {
                resolve(false)
                return
            }

            socket = new WebSocket("wss://eventsub-beta.wss.twitch.tv/ws")

            socket.addEventListener(
                "open",
                () => bridge.emit("eventsub.ws-connect", null)
            )
            socket.addEventListener(
                "message",
                async (evt) => {
                    const data = JSON.parse(evt.data)
                    const type = data.metadata.message_type

                    if (type === "session_welcome") {
                        sessionID = data.payload.session.id
                        const pls = await Promise.all(
                            topics.map(addsub)
                        )
                        bridge.emit("connect", "eventsub")
                        resolve(true)
                        return
                    }
                    if (type === "session_keepalive") {
                        bridge.emit("eventsub.keepalive", null)
                        return
                    }

                    bridge.emit(
                        data.metadata.subscription_type,
                        data.payload.event
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
        bridge.emit("disconnect", "eventsub")
    }

    return {
        on: bridge.on,
        connect,
        disconnect,
    }
}

export default EventSub
