let WebSocket$1 = null;
const init = (socketConstructor) => WebSocket$1 = socketConstructor;

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
    const {user, channel} = options || {};

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

    const connect = () => new Promise(
        (resolve) => {
            if (socket !== null) {
                resolve(false);
                return
            }

            socket = new WebSocket$1("wss://irc-ws.chat.twitch.tv:443");

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
                    const {channel} = evt.data;

                    if (channel !== options.channel) {
                        resolve(
                            new Error("Join didn't work, I dunno what happened")
                        );
                        return
                    }

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
            socket = new WebSocket$1("wss://pubsub-edge.twitch.tv");

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

const RealTime = (options, ...sections) => {
    const dual = EventBridge();

    const chat = Chat(options);
    if (chat instanceof Error) {
        return chat
    }
    const pubsub = Pubsub(options);
    if (pubsub instanceof Error) {
        return pubsub
    }

    const connect = () => Promise.all([
        chat.connect(),
        pubsub.connect()
    ]);
    const disconnect = () => {
        chat.disconnect();
        pubsub.disconnect();
    };

    const stopChat = dual.pull(chat);
    const stopPubsub = dual.pull(pubsub);

    return {
        on: dual.on,
        say: chat.say,
        connect,
        disconnect,
        stop: () => {
            stopChat();
            stopPubsub();
        }
    }
};

init(WebSocket);

export { Chat, Pubsub, RealTime };
