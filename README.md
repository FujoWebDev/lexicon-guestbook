# FujoCoded Guestbook Lexicon

This repository contains a "sample" of an ATproto lexicon that defines
everything needed to build a guestbook program.

The structure is as follows:

- `lexicons/` contains the lexicons definitions.
  - `lexicons/com/fujocoded` contains our own definitions
  - `lexicons/com/atproto` contains the ATproto base definitions which are
    necessary for the program to work
- `client/` contains a client application that allows you to create guestbooks
  on your account and post submissions to any guestbook

Right now, this is mostly a sample and teaching repo. You can watch us build
this live (or recorded) by [following Ms Boba on
Twitch](https://www.twitch.tv/essentialrandomness).

---

⊹₊ ˚‧︵‿₊୨ ᰔ ୧₊‿︵‧ ˚ ₊⊹ <br />
[Support FujoCoded on Patreon for More of This™!](https://www.patreon.com/fujocoded) <br />
⊹₊ ˚‧︵‿₊୨ ᰔ ୧₊‿︵‧ ˚ ₊⊹

---

## Using the Client

### 1. Generate the Lexicon API

The first step to use the client is to generate the lexicon API using the
definitions in the `lexicons/` folder. You can do this using the
[@atproto/lex-cli](https://www.npmjs.com/package/@atproto/lex-cli) package.

```bash
npx @atproto/lex-cli gen-api ./client/generated/api ./lexicons/**/*.json
```

### 2. Get an App Password

> Note: this is deprecated but Ms Boba doesn't care because she doesn't want
> to implement OAuth right now.

[Follow the instructions here](https://blueskyfeeds.com/en/faq-app-password).
You will need to add this in a `.env` file within `client/`.

```
APP_PASSWORD=your_password
```

### 2. Create your Guestbook

> Remember: you need to `npm install` the dependencies first!

1. Open `client/create-guestbook.ts` and change things around to your desired data.
2. <u>ENTER THE CLIENT DIRECTORY</u> (`cd client`)
3. Run `npm run guestbook:create`

### 3. Post a Submission to your Guestbok (or Someone Else's)

1. Open `client/create-submission.ts` and change things around to your desired data.
2. <u>ENTER THE CLIENT DIRECTORY</u> (`cd client`)
3. Run `npm run guestbook:submit`

## Putting your Guestbook on your Website

Right now, you can't (unless you want to implement the whole thing from scratch)!
Come to the streams and stay tuned for more functionality around this.
