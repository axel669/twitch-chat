var Chat = (function () {
    'use strict';

    const initParser = (username, emitter) => {
        const processMessage = (line) => {
            const type = parseType(line);

            if (parser[type] === undefined) {
                return type
            }

            const message = parser[type](line);
            emitter.fire(message.type, message);
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
        const iterativeParse = (line, info, index) => {
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
                index = iterativeParse(line, info, index);
                if (index >= line.length) {
                    return info
                }
            }
        };

        return processMessage
    };

    const pathList = (type) => type.split(".").reduce(
        (list, part) => {
            if (list.length === 0) {
                return [part, "*"]
            }

            const parent = list[0];
            list.unshift(
                // `${parent}.${part}`,
                `${parent}.*`
            );
            return list
        },
        []
    );

    const Bridge = () => {
        const handlers = {};

        const on = (type, handler) => {
            handlers[type] = [
                ...(handlers[type] ?? []),
                handler
            ];

            return () => {
                if (handlers[type] === undefined) {
                    return
                }
                handlers[type] = handlers[type].filter(
                    h => h !== handler
                );
            }
        };
        const once = (type, handler) => {
            let called = false;
            const wrapped = (evt) => {
                if (called) {
                    return
                }
                called = true;
                unsub();
                handler(evt);
            };
            const unsub = on(type, wrapped);
        };

        const fire = async (type, data) => {
            const evt = {type, data};

            const paths = pathList(type);

            for (const path of paths) {
                for (const handler of handlers[path] ?? []) {
                    queueMicrotask(
                        () => handler(evt)
                    );
                }
            }
        };

        const removeAll = () => {
            for (const key of Object.keys(handlers)) {
                delete handlers[key];
            }
        };

        return {
            on,
            once,
            fire,
            removeAll,
        }
    };

    const Chat = (options) => {
        const emitter = Bridge();
        const {user, channel} = options;
        const processMessage = initParser(user.name, emitter);

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
                        data.trim().split(/\r?\n/).forEach(processMessage);
                    }
                );

                emitter.once(
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
                const stop = emitter.on(
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

        emitter.on(
            "ping",
            () => {
                socket.send("PONG");
            }
        );

        return {
            on: emitter.on,
            connect,
            disconnect,
            say,
        }
    };

    return Chat;

})();
