import initParser from "./parse.js"
import EventBridge from "@axel669/event-bridge/esm"

const Chat = (options) => {
    const bridge = EventBridge()
    const {user, channel} = options
    const parseMessage = initParser(user.name, bridge)

    let socket = null

    const connect = () => new Promise(
        (resolve, reject) => {
            if (socket !== null) {
                resolve(false)
            }

            socket = new WebSocket("wss://irc-ws.chat.twitch.tv:443")

            socket.addEventListener(
                "message",
                (evt) => {
                    const { data } = evt
                    const messages =
                        data
                        .trim()
                        .split(/\r?\n/)
                        .map(parseMessage)
                    for (const message of messages) {
                        bridge.emit(message.type || "unknown", message)
                    }
                }
            )

            bridge.once(
                "join",
                evt => {
                    const {channel} = evt.data

                    if (channel !== options.channel) {
                        resolve(
                            new Error("Join didn't work, I dunno what happened")
                        )
                        return
                    }

                    resolve(true)
                }
            )

            socket.addEventListener(
                "open",
                () => {
                    socket.send(`PASS ${user.pass}`)
                    socket.send(`NICK ${user.name}`)
                    socket.send("CAP REQ :twitch.tv/membership twitch.tv/tags twitch.tv/commands")
                    socket.send(`JOIN #${channel.toLowerCase()}`)
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
    }
    const say = (message, replyID) => new Promise(
        (resolve) => {
            if (socket === null) {
                return
            }

            const nonce = `${Math.random().toString(16)}.${Date.now()}`
            const stop = bridge.on(
                "USERSTATE",
                (evt) => {
                    if (evt.data.tags.clientNonce !== nonce) {
                        return
                    }
                    stop()
                    resolve({
                        type: "chat",
                        data: {
                            tags: evt.data.tags,
                            message
                        }
                    })
                }
            )
            const replyTag = (replyID === undefined)
                ? ""
                : `;reply-parent-msg-id=${replyID}`
            socket.send(
                `@client-nonce=${nonce}${replyTag} PRIVMSG #${channel} :${message}`
            )
        }
    )

    bridge.on(
        "ping",
        () => {
            socket.send("PONG")
        }
    )

    return {
        on: bridge.on,
        forward: bridge.forward,
        connect,
        disconnect,
        say,
    }
}

export default Chat
