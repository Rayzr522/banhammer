const path = require('path');
const fs = require('fs');
const { Client } = require('discord.js');

const config = (() => {
    if (!fs.existsSync('config.json')) {
        fs.copyFileSync(path.resolve(__dirname, 'config-example.json'), 'config.json');
        console.error('The default config.json has been copied to your current directory, please fill out all required fields.');
        process.exit(1);
    }

    let json;
    try {
        json = JSON.parse(fs.readFileSync('config.json').toString());
    } catch (error) {
        console.error(`Failed to load/parse the config.json file: ${error}`);
        process.exit(1);
    }

    if (json.token && !/^[a-zA-Z0-9_.-]{59}$/.test(json.token)) {
        console.error('The token you entered is invalid! Please carefully re-enter the token and restart the bot.');
        process.exit(1);
    }

    return json;
})();

const commands = new Map();
const bot = new Client({ disableEveryone: true });

bot.config = config;
bot.commands = commands;

fs.readdirSync(path.resolve(__dirname, 'commands'))
    .filter(f => f.endsWith('.js'))
    .forEach(f => {
        console.log(`Loading command ${f}`);

        try {
            let command = require(`./commands/${f}`);

            if (typeof command.run !== 'function') {
                throw 'Command is missing a run function!';
            } else if (!command.help || !command.help.name) {
                throw 'Command is missing a valid help object!';
            }

            commands.set(command.help.name, command);
        } catch (error) {
            console.error(`Failed to load command ${f}: ${error}`);
        }
    });

bot.on('ready', () => {
    console.log(`Logged in as ${bot.user.tag} (ID: ${bot.user.id})`);

    bot.generateInvite([
        'SEND_MESSAGES',
        'MANAGE_MESSAGES',
        'BAN_MEMBERS',
    ]).then(invite => {
        console.log(`Click here to invite the bot to your guild:\n${invite}`);
    });
});

const getContent = message => {
    const raw = message.content;

    if (raw.startsWith(config.prefix)) {
        return raw.substr(config.prefix.length);
    } else if (raw.startsWith(bot.user.toString())) {
        return raw.substr(bot.user.toString().length);
    }
};

bot.on('message', message => {
    // Ignore messages from bots and from DMs (non-guild channels)
    if (message.author.bot || !message.guild) {
        return;
    }

    let content = getContent(message);
    if (!content) {
        return;
    }

    let args = content.split(' ');
    let label = args.shift();

    if (commands.get(label)) {
        try {
            commands.get(label).run(bot, message, args);
        } catch (e) {
            if (e instanceof Error) {
                console.error(e);
                message.channel.send(':x: An unknown error has occurred!');
            } else {
                message.channel.send(`:x: ${e}`);
            }
        }
    }
});

// Only run the bot if the token was provided
config.token && bot.login(config.token);
