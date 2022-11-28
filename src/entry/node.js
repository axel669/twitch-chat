import WebSocket from "ws"
import fetch from "node-fetch"

import { initWS } from "../websocket.js"
import { initReq } from "../request.js"
import { initFetch } from "../fetch.mjs"
import Chat from "../chat.js"
import Pubsub from "../pubsub.js"
import EventSub from "../eventsub.mjs"
import RealTime from "../real-time.js"
import API from "../api.js"
import Multi from "../multi.mjs"

initWS(WebSocket)
initReq(fetch)
initFetch(fetch)

export {
    Chat,
    Pubsub,
    EventSub,
    // RealTime,
    API,
    Multi,
}
