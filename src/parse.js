const initParser = (username) => {
    const parseMessage = (line) => {
        const type = parseType(line)

        if (parser[type] === undefined) {
            return type
        }

        return parser[type](line)
    }

    const source = {
        system: ":tmi.twitch.tv",
        user: `:${username}.tmi.twitch.tv`,
    }
    const parseType = (line) => {
        if (line.startsWith(source.system) || line.startsWith(source.user)) {
            return "system"
        }
        if (line.startsWith("PING")) {
            return "ping"
        }

        return "chat"
    }
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
    }
    const parseSubtype = (message) => {
        const {command, tags} = message
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
    }
    const parser = {
        system: (line) => {
            const type = "system"
            const space = line.indexOf(" ")
            const from = line.substr(0, space)

            const ch = line.charAt(space + 1)
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
                const nextSpace = line.indexOf(" ", space + 1)
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
            const message = parseRegular(line)
            message.type = parseSubtype(message)

            return message
        }
    }
    const findOrEnd = (str, seq, index) => {
        const pos = str.indexOf(seq, index)

        if (pos === -1) {
            return str.length
        }

        return pos
    }
    const parseSection = (line, info, index) => {
        const space = findOrEnd(line, " ", index)
        if (line.charAt(index) === "@") {
            const tags = line.slice(index + 1, space)

            info.tags = parseTags(tags)
            return space + 1
        }

        if (line.charAt(index) === ":") {
            if (info.source === undefined) {
                info.source = line.slice(index, space)
                return space + 1
            }

            info.message = line.slice(index + 1)
            return line.length
        }

        if (line.charAt(index) === "#") {
            info.channel = line.slice(index + 1, space)
            return space + 1
        }

        info.command = line.slice(index, space)
        return space + 1
    }

    const tagTypes = {
        bits: value => parseInt(value),
        tmiSentTs: value => parseInt(value),
        badges: value => value.split(","),
        mod: value => value === "1",
        subscriber: value => value === "1",
        turbo: value => value === "1",
        firstMsg: value => value === "1",
    }
    const parseTag = (name, value) => {
        if (tagTypes[name] !== undefined) {
            return tagTypes[name](value)
        }

        return value
    }
    const parseTags = (source) => {
        const tags = source
            .split(";")
            .reduce(
                (tags, tag) => {
                    const [name, value] = tag.split("=")
                    const key = name.replace(
                        /\-(id|ts|\w)/g,
                        (_, s) => s.toUpperCase()
                    )
                    tags[key] = parseTag(key, value)
                    return tags
                },
                {}
            )
        tags.broadcaster = tags.badges && tags.badges.includes("broadcaster/1")
        tags.vip = tags.badges && tags.badges.includes("vip/1")

        return tags
    }
    const parseRegular = (line) => {
        const info = {}
        let index = 0
        while (true) {
            index = parseSection(line, info, index)
            if (index >= line.length) {
                return info
            }
        }
    }

    return parseMessage
}

export default initParser
