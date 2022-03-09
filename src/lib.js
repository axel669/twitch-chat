import EventBridge from "@axel669/event-bridge/esm"

import Chat from "./chat.js"
import Pubsub from "./pubsub.js"

const RealTime = (options, ...sections) => {
    const dual = EventBridge()

    const chat = Chat(options)
    if (chat instanceof Error) {
        return chat
    }
    const pubsub = Pubsub(options)
    if (pubsub instanceof Error) {
        return pubsub
    }

    const connect = () => Promise.all([
        chat.connect(),
        pubsub.connect()
    ])
    const disconnect = () => {
        chat.disconnect()
        pubsub.disconnect()
    }

    const stopChat = dual.pull(chat)
    const stopPubsub = dual.pull(pubsub)

    return {
        on: dual.on,
        say: chat.say,
        connect,
        disconnect,
        stop: () => {
            stopChat()
            stopPubsub()
        }
    }
}

export {
    Chat,
    Pubsub,
    RealTime
}
