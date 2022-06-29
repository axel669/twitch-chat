import {initWS} from "../websocket.js"
import { initReq } from "../request.js"
import Chat from "../chat.js"
import Pubsub from "../pubsub.js"
import RealTime from "../real-time.js"
import API from "../api.js"

initWS(WebSocket)
initReq(fetch)

export {
    Chat,
    Pubsub,
    RealTime,
    API,
}
