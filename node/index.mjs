import WebSocket$1 from 'ws';
import fetch$2 from 'node-fetch';

let WebSocket = null;
const initWS = (socketConstructor) => WebSocket = socketConstructor;

let fetch$1 = null;
const initReq = (fetchFunc) => fetch$1 = fetchFunc;

const cleanParams = (paramSource = {}) => {
    const params = new URLSearchParams(
        Object.fromEntries(
            Object.entries(paramSource)
                .filter(p => p[1] !== undefined)
        )
    );

    return params.toString()
};

const baseURL = "https://api.twitch.tv/helix";
const request = async (options) => {
    const {
        path,
        headers,
        data,
        params,
        type,
    } = options;

    const hasData = data !== undefined;
    const method = type ?? (hasData ? "POST" : "GET");
    const body = hasData ? JSON.stringify(data) : undefined;
    const fetchOptions = { method, headers, body };

    const paramString = cleanParams(params);
    const url = `${baseURL}${path}?${paramString}`;

    const response = await fetch$1(url, fetchOptions);

    if (response.ok === false) {
        return new Error(`${response.status}: ${response.statusText}`)
    }

    return await response.json()
};

let fetch = null;
const initFetch = (fetchFunc) => fetch = fetchFunc;

const initParser = (username) => {
    const parseMessage = (line) => {
        const type = parseType(line);

        if (parser[type] === undefined) {
            return type
        }

        return parser[type](line)
    };

    const source = {
        system: ":tmi.twitch.tv",
        user: `:${username}.tmi.twitch.tv`,
    };
    const parseType = (line) => {
        if (line.startsWith(source.system) || line.startsWith(source.user)) {
            return "system"
        }
        if (line.startsWith("PING")) {
            return "ping"
        }

        return "chat"
    };
    const usernoticeMap = {
        sub: "sub.new",
        resub: "sub.resub",
        subgift: "sub.gift",
        anonsubgift: "sub.gift.anon",
        submysterygift: "sub.gift.mystery",
        giftpaidupgrade: "sub.upgrade",
        anongiftpaidupgrade: "sub.upgrade.anon",
        raid: "raid",
        unraid: "unraid",
        bitbadgetier: "bits.badge-tier",
        rewardgift: "reward",
    };
    const parseSubtype = (message) => {
        const {command, tags} = message;
        if (command === "PART") {
            return "part"
        }
        if (command === "JOIN") {
            return "join"
        }

        if (command === "PRIVMSG") {
            if (tags.bits !== undefined) {
                return "bits"
            }
            if (tags.customRewardID !== undefined) {
                return "chat.redeem"
            }
            return "chat.message"
        }

        if (command === "USERNOTICE") {
            return usernoticeMap[tags.msgID]
        }

        return command
    };
    const parser = {
        system: (line) => {
            const type = "system";
            const space = line.indexOf(" ");
            const from = line.substr(0, space);

            const ch = line.charAt(space + 1);
            if (ch >= "0" && ch <= "9") {
                return {
                    type,
                    from,
                    seq: parseInt(
                        line.substr(space + 1, 3)
                    ),
                    message: line.substr(space + 5)
                }
            }

            if (line.substr(space + 1, username.length) !== username) {
                const nextSpace = line.indexOf(" ", space + 1);
                return {
                    type,
                    from,
                    command: line.slice(space + 1, nextSpace),
                    message: line.slice(nextSpace + 1)
                }
            }

            return {
                type,
                from,
                message: line.substr(space + 1)
            }
        },
        ping: () => ({ type: "ping" }),
        chat: (line) => {
            const message = parseRegular(line);
            message.type = parseSubtype(message);

            return message
        }
    };
    const findOrEnd = (str, seq, index) => {
        const pos = str.indexOf(seq, index);

        if (pos === -1) {
            return str.length
        }

        return pos
    };
    const parseSection = (line, info, index) => {
        const space = findOrEnd(line, " ", index);
        if (line.charAt(index) === "@") {
            const tags = line.slice(index + 1, space);

            info.tags = parseTags(tags);
            return space + 1
        }

        if (line.charAt(index) === ":") {
            if (info.source === undefined) {
                info.source = line.slice(index, space);
                return space + 1
            }

            info.message = line.slice(index + 1);
            return line.length
        }

        if (line.charAt(index) === "#") {
            info.channel = line.slice(index + 1, space);
            return space + 1
        }

        info.command = line.slice(index, space);
        return space + 1
    };

    const tagTypes = {
        bits: value => parseInt(value),
        tmiSentTs: value => parseInt(value),
        badges: value => value.split(","),
        mod: value => value === "1",
        subscriber: value => value === "1",
        turbo: value => value === "1",
        firstMsg: value => value === "1",
    };
    const parseTag = (name, value) => {
        if (tagTypes[name] !== undefined) {
            return tagTypes[name](value)
        }

        return value
    };
    const parseTags = (source) => {
        const tags = source
            .split(";")
            .reduce(
                (tags, tag) => {
                    const [name, value] = tag.split("=");
                    const key = name.replace(
                        /\-(id|ts|\w)/g,
                        (_, s) => s.toUpperCase()
                    );
                    tags[key] = parseTag(key, value);
                    return tags
                },
                {}
            );
        tags.broadcaster = tags.badges && tags.badges.includes("broadcaster/1");
        tags.vip = tags.badges && tags.badges.includes("vip/1");

        return tags
    };
    const parseRegular = (line) => {
        const info = {};
        let index = 0;
        while (true) {
            index = parseSection(line, info, index);
            if (index >= line.length) {
                return info
            }
        }
    };

    return parseMessage
};

//  Hand rolled loops and splice are used for performance reasons.
//  Normally I wouldn't be concerned with the difference, but with the level
//      this lib operates at, I want to get as much performance as possible.

const each = (array, action) => {
    if (array === undefined) {
        return
    }
    for (let index = 0; index < array.length; index += 1) {
        action(array[index]);
    }
};

const tracePath = (type) => type.split(".").reduceRight(
    (list, _, index, parts) => {
        const next = [
            ...parts.slice(0, index),
            "*"
        ];
        list.push(
            next.join(".")
        );
        return list
    },
    [type]
);

const EventBridge = () => {
    const handlers = {};

    const addHandler = (type, handler, count) => {
        handlers[type] = handlers[type] || [];
        const entry = {
            handler,
            count,
        };
        handlers[type].push(entry);
        return entry
    };
    const removeHandler = (type, entry) => {
        if (handlers[type] === undefined) {
            return
        }
        const index = handlers[type].indexOf(entry);
        if (index === -1) {
            return
        }
        handlers[type].splice(index, 1);
    };
    const on = (type, handler) => {
        const entry = addHandler(type, handler, Number.POSITIVE_INFINITY);
        return () => removeHandler(type, entry)
    };
    const once = (type, handler) => {
        const entry = addHandler(type, handler, 1);
        return () => removeHandler(type, entry)
    };

    const emit = async (type, data) => {
        const evt = { type, data };

        const paths = tracePath(type);

        const remove = [];
        each(
            paths,
            (path) => each(
                handlers[path],
                (entry) => {
                    entry.count -= 1;
                    queueMicrotask(
                        () => entry.handler({
                            source: path,
                            ...evt
                        })
                    );
                    if (entry.count === 0) {
                        remove.push([path, entry]);
                    }
                }
            )
        );
        each(
            remove,
            (info) => removeHandler(...info)
        );
    };

    const removeAll = () => {
        for (const key of Object.keys(handlers)) {
            delete handlers[key];
        }
        for (const key of Object.getOwnPropertySymbols(handlers)) {
            delete handlers[key];
        }
    };

    const pull = (source, prefix = null) => {
        const forwardPrefix = prefix ? `${prefix}.` : "";
        return source.on(
            "*",
            (evt) => emit(`${forwardPrefix}${evt.type}`, evt.data)
        )
    };
    const bind = (source, types) => {
        const handlers = types.map(
            (type) => [
                type,
                (evt) => emit(type, evt)
            ]
        );
        for (const pair of handlers) {
            source.addEventListener(pair[0], pair[1]);
        }
        return () => {
            for (const pair of handlers) {
                source.removeEventListener(pair[0], pair[1]);
            }
        }
    };

    return {
        on,
        once,
        emit,
        pull,
        bind,
        removeAll,
    }
};
EventBridge.tracePath = tracePath;

/*
Art by Joan Stark
                                  .-.
     (___________________________()6 `-,
     (   ______________________   /''"`
     //\\                      //\\
jgs  "" ""                     "" ""
*/

const Chat = (options) => {
    const bridge = EventBridge();
    const {user, channel, timeout = 7777} = options || {};

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

    const parseMessage = initParser(user.name);

    let socket = null;

    let retry = null;
    const attemptConnect = (resolve) => {
        if (socket !== null) {
            resolve(null);
            return
        }

        socket = new WebSocket("wss://irc-ws.chat.twitch.tv:443");

        socket.addEventListener(
            "message",
            (evt) => {
                const { data } = evt;
                const messages =
                    data
                    .trim()
                    .split(/\r?\n/)
                    .map(parseMessage);
                for (const message of messages) {
                    bridge.emit(message.type || "unknown", message);
                }
            }
        );

        const stopJoin = bridge.once(
            "join",
            evt => {
                const { channel } = evt.data;

                if (channel !== options.channel) {
                    resolve(
                        new Error("Join didn't work, I dunno what happened")
                    );
                    return
                }

                clearInterval(retry);
                stopNotice();
                bridge.emit("connect", "chat");
                resolve(true);
            }
        );
        const stopNotice = bridge.on(
            "system",
            (evt) => {
                if (evt.data.command !== "NOTICE") {
                    return
                }
                clearInterval(retry);
                stopJoin();
                resolve(
                    new Error(evt.data.message)
                );
            }
        );

        socket.addEventListener(
            "open",
            () => {
                socket.send(`PASS oauth:${user.token}`);
                socket.send(`NICK ${user.name}`);
                socket.send("CAP REQ :twitch.tv/membership twitch.tv/tags twitch.tv/commands");
                socket.send(`JOIN #${channel.toLowerCase()}`);

                retry = setTimeout(
                    () => {
                        stopJoin();
                        stopNotice();
                        socket.close();
                        socket = null;
                        console.log("No response, retrying connection");
                        attemptConnect(resolve);
                    },
                    timeout
                );
            }
        );
    };
    const connect = () => new Promise(
        (resolve) => {
            attemptConnect(resolve);
            // if (socket !== null) {
            //     resolve(false)
            //     return
            // }

            // socket = new WebSocket("wss://irc-ws.chat.twitch.tv:443")

            // socket.addEventListener(
            //     "message",
            //     (evt) => {
            //         const { data } = evt
            //         const messages =
            //             data
            //             .trim()
            //             .split(/\r?\n/)
            //             .map(parseMessage)
            //         for (const message of messages) {
            //             bridge.emit(message.type || "unknown", message)
            //         }
            //     }
            // )

            // const stopJoin = bridge.once(
            //     "join",
            //     evt => {
            //         const {channel} = evt.data

            //         if (channel !== options.channel) {
            //             resolve(
            //                 new Error("Join didn't work, I dunno what happened")
            //             )
            //             return
            //         }

            //         stopNotice()
            //         bridge.emit("connect", "chat")
            //         resolve(true)
            //     }
            // )
            // const stopNotice = bridge.on(
            //     "system",
            //     (evt) => {
            //         if (evt.data.command !== "NOTICE") {
            //             return
            //         }
            //         stopJoin()
            //         resolve(
            //             new Error(evt.data.message)
            //         )
            //     }
            // )

            // socket.addEventListener(
            //     "open",
            //     () => {
            //         socket.send(`PASS oauth:${user.token}`)
            //         socket.send(`NICK ${user.name}`)
            //         socket.send("CAP REQ :twitch.tv/membership twitch.tv/tags twitch.tv/commands")
            //         socket.send(`JOIN #${channel.toLowerCase()}`)
            //     }
            // )
        }
    );
    const disconnect = () => {
        if (socket === null) {
            return
        }
        socket.close();
        socket = null;
        bridge.emit("disconnect", "chat");
    };
    const say = (message, replyID) => new Promise(
        (resolve) => {
            if (socket === null) {
                return
            }

            const nonce = `${Math.random().toString(16)}.${Date.now()}`;
            const stop = bridge.on(
                "USERSTATE",
                (evt) => {
                    if (evt.data.tags.clientNonce !== nonce) {
                        return
                    }
                    stop();
                    resolve({
                        type: "chat",
                        data: {
                            tags: evt.data.tags,
                            message
                        }
                    });
                }
            );
            const nonceTag = `client-nonce=${nonce}`;
            const replyTag = (replyID === undefined)
                ? ""
                : `;reply-parent-msg-id=${replyID}`;
            socket.send(
                `@${nonceTag}${replyTag} PRIVMSG #${channel} :${message}`
            );
        }
    );

    bridge.on(
        "ping",
        () => {
            socket.send("PONG");
        }
    );

    return {
        on: bridge.on,
        connect,
        disconnect,
        say,
    }
};

const Pubsub = (options) => {
    const bridge = EventBridge();
    const { user, topics } = options || {};

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

    let socket = null;
    let pingID = null;
    const pubsubTopics = topics.map(
        topic => `${topic}.${user.id}`
    );
    const connect = () => new Promise(
        resolve => {
            if (socket !== null) {
                resolve(false);
                return
            }
            socket = new WebSocket("wss://pubsub-edge.twitch.tv");

            socket.addEventListener(
                "open",
                () => {
                    const nonce = `${Date.now()}.${Math.random().toString(16)}`;

                    socket.addEventListener(
                        "message",
                        (evt) => {
                            const message = JSON.parse(evt.data);

                            if (message.type === "MESSAGE") {
                                const { data, ...parts } = JSON.parse(
                                    message.data.message
                                );
                                const [type] = message.data.topic.split(".");
                                bridge.emit(
                                    type,
                                    {
                                        topic: message.data.topic,
                                        ...parts,
                                        ...data,
                                    }
                                );
                                return
                            }

                            bridge.emit(message.type, message);
                        }
                    );
                    bridge.once(
                        "RESPONSE",
                        ({ data }) => {
                            if (data.nonce !== nonce) {
                                resolve(
                                    new Error("Connection is compromised")
                                );
                                return
                            }
                            if (data.error !== "") {
                                resolve(
                                    new Error(data.error)
                                );
                                return
                            }
                            bridge.emit("connect", "pubsub");
                            pingID = setInterval(
                                () => socket.send(
                                    JSON.stringify({ type: "PING" })
                                ),
                                2500 * 60
                            );
                            resolve(true);
                        }
                    );
                    socket.send(
                        JSON.stringify({
                            type: "LISTEN",
                            nonce,
                            data: {
                                topics: pubsubTopics,
                                auth_token: user.token
                            }
                        })
                    );
                }
            );
        }
    );
    const disconnect = () => {
        if (socket === null) {
            return
        }
        clearInterval(pingID);
        pingID = null;
        socket.close();
        socket = null;
        bridge.emit("disconnect", "pubsub");
    };

    return {
        on: bridge.on,
        connect,
        disconnect,
    }
};

const EventSub = (options) => {
    const bridge = EventBridge();
    const { user, topics, clientID } = options || {};

    let socket = null;
    let sessionID = null;

    const url = "https://api.twitch.tv/helix/eventsub/subscriptions";
    const apiVersions = {
        "channel.follow": "2",
    };
    const addsub = async (type) => {
        console.log(`adding listener: ${type}`);
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
                    version: apiVersions[type] ?? "1",
                    condition: {
                        broadcaster_user_id: user.id,
                        moderator_user_id: user.id,
                    },
                    transport: {
                        method: "websocket",
                        session_id: sessionID,
                    }
                })
            }
        );
        console.log(`${res.ok ? "success" : "failed"}: ${type}`);

        return await res.json()
    };

    const connect = () => new Promise(
        resolve => {
            if (socket !== null) {
                resolve(false);
                return
            }

            socket = new WebSocket("wss://eventsub-beta.wss.twitch.tv/ws");

            socket.addEventListener(
                "open",
                () => bridge.emit("eventsub.ws-connect", null)
            );
            socket.addEventListener(
                "message",
                async (evt) => {
                    const data = JSON.parse(evt.data);
                    const type = data.metadata.message_type;

                    if (type === "session_welcome") {
                        sessionID = data.payload.session.id;
                        await Promise.all(
                            topics.map(addsub)
                        );
                        bridge.emit("connect", "eventsub");
                        resolve(true);
                        return
                    }
                    if (type === "session_keepalive") {
                        bridge.emit("eventsub.keepalive", null);
                        return
                    }

                    bridge.emit(
                        data.metadata.subscription_type,
                        data.payload.event
                    );
                }
            );
        }
    );

    const disconnect = () => {
        if (socket === null) {
            return
        }
        socket.close();
        socket = null;
        bridge.emit("disconnect", "eventsub");
    };

    return {
        on: bridge.on,
        connect,
        disconnect,
    }
};

const one = (func) =>
    async (...args) => {
        const result = await func(...args);

        if (result instanceof Error) {
            return result
        }

        return result.data[0]
    };

const api = (options) => {
    const {user, clientID} = options;

    const headers = {
        "Client-Id": clientID,
        "Authorization": `Bearer ${user.token}`,
        "Content-Type": "application/json",
    };
    return {
        polls: {
            TERMINATED: "TERMINATED",
            ARCHIVED: "ARCHIVED",
            find: one(
                (id) => request({
                    path: "/polls",
                    headers,
                    params: {
                        id,
                        broadcaster_id: user.id,
                    }
                })
            ),
            list: (after, first) => request({
                path: "/polls",
                headers,
                params: {
                    broadcaster_id: user.id,
                    after,
                    first,
                }
            }),
            create: one(
                (pollInfo) => request({
                    path: "/polls",
                    headers,
                    data: {
                        ...pollInfo,
                        broadcaster_id: user.id
                    },
                })
            ),
            end: one(
                (id, status) => request({
                    path: "/polls",
                    type: "PATCH",
                    headers,
                    data: {
                        status,
                        id,
                        broadcaster_id: user.id,
                    },
                })
            )
        }
    }
};

const Multi = (options) => {
    const { connectors } = options;

    const multiband = EventBridge();
    const bridges = connectors.map(
        connector => connector(options)
    );
    const failed = bridges.find(bridge => bridge instanceof Error);
    if (failed !== undefined) {
        return failed
    }

    const connect = () => Promise.all(
        bridges.map(bridge => bridge.connect())
    );
    const disconnect = () => Promise.all(
        bridges.map(bridge => bridge.disconnect())
    );

    const channels = bridges.map(
        bridge => multiband.pull(bridge)
    );
    const stop = () => channels.forEach(
        stop => stop()
    );

    const interfaces = bridges.reduce(
        (itf, bridge) => {
            const { on, connect, disconnect, ...intrface } = bridge;
            for (const [name, func] of Object.entries(intrface)) {
                itf[name] = func;
            }
            return itf
        },
        {}
    );

    return {
        ...interfaces,
        on: multiband.on,
        connect,
        disconnect,
        stop,
    }
};

initWS(WebSocket$1);
initReq(fetch$2);
initFetch(fetch$2);

export { api as API, Chat, EventSub, Multi, Pubsub };
