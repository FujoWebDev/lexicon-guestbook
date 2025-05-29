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

You can see all the submissions as they happen with the following code:
`websocat wss://jetstream2.us-east.bsky.network/subscribe\?wantedCollections=com.fujocoded.guestbook.submission | jq 'select(.kind == "commit")'`

## Get an AppView Up

### Generate the AppView Server definitions

```bash
npx @atproto/lex-cli gen-server ./client/generated/server ./lexicons/**/*.json
```

### Generate a public/private key pair

1. Enter the AppView directory with `cd appview/`
2. Generate the private key: `openssl ecparam -name secp256k1 -genkey -noout -out private_key.pem`
3. Generate the public key: `openssl ec -in private_key.pem -pubout -out public_key.pem`

### Bring the ingester up

TODO

### Bring the AppView server up

1. Enter the appview directory `cd appview/`
2. Run `npm run dev` to start serving the AppView

### Make the AppView server publicly available

To make the AppView work, it needs to be reachable from the external internet at a specific address.
If you have tailscale, you can use serve/funnel to create this address.

1. Run `tailscale serve https / http://localhost:3003/`
2. Run `tailscale funnel 443 on`
3. Run `tailscale serve status` and use the address from the funnel

TODO: explain how to configure this addresss

## Putting your Guestbook on your Website

Right now, you can't (unless you want to implement the whole thing from scratch)!
Come to the streams and stay tuned for more functionality around this.

## ⚠️⚠️⚠️ DANGER: Deleting Everything ⚠️⚠️⚠️

Experimented too much and hate leaving a mess around? Delete everything with
`npm run guestbook:dangerously-delete-everything`, which will (again) DELETE EVERYTHING.

If you want to be more targeted, you can modify `client/delete-everything.ts`.
Good luck!

## TODO-list!

- [x] Get someone else to write in the lexicon!
- [ ] Display other lexicons

### Lexicon

- [ ] Allow guestbooks moderation (e.g. delete entry)
- [ ] Allow blocking users
- [ ] Allow restricting which URLs a guestbook is displayable on

### AppView

- [ ] Return handles of users
- [ ] Accept guestbook submissions from HTML
- [ ] Improve HTML generation
- [ ] Check out CORS
- [ ] Allow creating guestbooks

### Client

- [ ] Get rid of app passwords

#### HTML iframe

- [ ] Allow submission via form

#### Others

- [ ] Create Astro plugin
- [ ] Create guestbook webcomponent(?)

### Ingestor

- [ ] Catch up with cursor
