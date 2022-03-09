import initParser from "./parse.js"
import EventBridge from "@axel669/event-bridge/esm"

/*
Art by Joan Stark
                                  .-.
     (___________________________()6 `-,
     (   ______________________   /''"`
     //\\                      //\\
jgs  "" ""                     "" ""
*/

const Chat = (options) => {
    const bridge = EventBridge()
    const {user, channel} = options || {}

    if (user === undefined) {
        return new Error("Invalid config: user not provided")
    }
    if (user.name === undefined) {
        return new Error("Invalid config: user.name not provided")
    }
    if (user.token === undefined) {
        return new Error("Invalid config: user.token not provided")
    }
    if (channel === undefined) {
        return new Error("Invalid config: channel not provided")
    }

    const parseMessage = initParser(user.name, bridge)

    let socket = null

    const connect = () => new Promise(
        (resolve) => {
            if (socket !== null) {
                resolve(false)
                return
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

            const stopJoin = bridge.once(
                "join",
                evt => {
                    const {channel} = evt.data

                    if (channel !== options.channel) {
                        resolve(
                            new Error("Join didn't work, I dunno what happened")
                        )
                        return
                    }

                    stopNotice()
                    bridge.emit("connect", "chat")
                    resolve(true)
                }
            )
            const stopNotice = bridge.on(
                "system",
                (evt) => {
                    if (evt.data.command !== "NOTICE") {
                        return
                    }
                    stopJoin()
                    resolve(
                        new Error(evt.data.message)
                    )
                }
            )

            socket.addEventListener(
                "open",
                () => {
                    socket.send(`PASS oauth:${user.token}`)
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
        bridge.emit("disconnect", "chat")
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
            const nonceTag = `client-nonce=${nonce}`
            const replyTag = (replyID === undefined)
                ? ""
                : `;reply-parent-msg-id=${replyID}`
            socket.send(
                `@${nonceTag}${replyTag} PRIVMSG #${channel} :${message}`
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
        connect,
        disconnect,
        say,
    }
}

export default Chat
