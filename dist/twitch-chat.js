var Chat = (function () {
    'use strict';

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
                return "chat"
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
                const tags = line.substring(index + 1, space);

                info.tags = parseTags(tags);
                return space + 1
            }

            if (line.charAt(index) === ":") {
                if (info.source === undefined) {
                    info.source = line.substr(index, space);
                    return space + 1
                }

                info.message = line.substr(index + 1);
                return line.length
            }

            if (line.charAt(index) === "#") {
                info.channel = line.substring(index + 1, space);
                return space + 1
            }

            info.command = line.substring(index, space);
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

        const forward = (dest) => on(
            "*",
            (evt) => dest.emit(evt.type, evt.data)
        );
        const pull = (source, types) => {
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
            forward,
            pull,
            removeAll,
        }
    };
    EventBridge.tracePath = tracePath;

    const Chat = (options) => {
        const bridge = EventBridge();
        const {user, channel} = options;
        const parseMessage = initParser(user.name);

        let socket = null;

        const connect = () => new Promise(
            (resolve, reject) => {
                if (socket !== null) {
                    resolve(false);
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

                bridge.once(
                    "join",
                    evt => {
                        const {channel} = evt.data;

                        if (channel !== options.channel) {
                            resolve(
                                new Error("Join didn't work, I dunno what happened")
                            );
                            return
                        }

                        resolve(true);
                    }
                );

                socket.addEventListener(
                    "open",
                    () => {
                        socket.send(`PASS ${user.pass}`);
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
                const replyTag = (replyID === undefined)
                    ? ""
                    : `;reply-parent-msg-id=${replyID}`;
                socket.send(
                    `@client-nonce=${nonce}${replyTag} PRIVMSG #${channel} :${message}`
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
            forward: bridge.forward,
            connect,
            disconnect,
            say,
        }
    };

    return Chat;

})();
