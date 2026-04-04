# FujoCoded Guestbook Lexicon

This repository contains a "sample" of an ATproto lexicon that defines
everything needed to build a guestbook program.

The structure is as follows:

- `lexicons/` contains the lexicons definitions.
  - `lexicons/com/fujocoded` contains our own definitions
  - `lexicons/com/atproto` contains the ATproto base definitions which are
    necessary for the program to work
- `client/` contains sample client applications that allow you to create a
  guestbook, list submissions on one, or post your own comments
  - `client/cli` contains a sample application using a command line interface
  - `client/iframe` contains a sample application using a html page with an
    iframe
  - `client/astro` contains a sample application using an astro site
- `appview/` contains the guestbook AppView. It collects guestbook-related
  events as they happen on the network, and offers a shared interface for
  guestbook applications to use.
  - `appview/ingestor.ts` listens to the stream of ATproto events on the
    network, grabs anything guestbook-related, and adds it to the AppView's
    database
  - `appview/index.ts` implements the query portion of the guestbook lexicon,
    offering applications a way to fetch guestbook-related informations

Right now, this is mostly a sample and teaching repo. You can watch us build
this live (or recorded) by [following Ms Boba on
Twitch](https://www.twitch.tv/essentialrandomness).

## Run Everything in Dev

From the repository root, start the Astro site, the AppView server, and the
AppView ingestor together with:

```bash
npm install
npm run dev
```

These include:

- `npm run dev` or `npm run dev:all`: Astro site + AppView + ingestor + public
  tunnel
- `npm run dev:client`: Astro site + public tunnel
- `npm run dev:appview`: AppView + ingestor + public tunnel
- `npm run dev:tunnel`: public tunnel only

If you want to skip the tunnel and only run local processes:

- `npm run dev:all:local`
- `npm run dev:client:local`
- `npm run dev:appview:local`

The tunnel scripts reuse an already-running tunnel when the port/host/subdomain
settings match, which makes it easy to start the AppView side and client side in
separate terminals.

---

⊹₊ ˚‧︵‿₊୨ ᰔ ୧₊‿︵‧ ˚ ₊⊹ <br /> [Support FujoCoded on Patreon for More of
This™!](https://www.patreon.com/fujocoded) <br /> ⊹₊ ˚‧︵‿₊୨ ᰔ ୧₊‿︵‧ ˚ ₊⊹

---

## Using the CLI Client

The CLI client allows you to create, edit, delete and submit to guestbooks
through a terminal.

### 1. Generate the Lexicon API

The first step to use the client is to generate the lexicon API using the
definitions in the `lexicons/` folder. You can do this using the
[@atproto/lex-cli](https://www.npmjs.com/package/@atproto/lex-cli) package. This
creates all the code we need to safely and more easily handle guestbook
operations.

```bash
npx @atproto/lex-cli gen-api ./client/generated/api ./lexicons/com/fujocoded/**/*.json
```

### 2. Create your Guestbook (using the CLI)

> Remember: you need to `npm install` the dependencies first!

1. Open `client/cli/create-guestbook.ts` and change things around to your
   desired data.
2. <u>ENTER THE CLI DIRECTORY</u> (`cd client/cli`)
3. Run `npm run guestbook:create`

### 3. Post a Submission to your Guestbok (or Someone Else's)

1. Open `client/cli/create-submission.ts` and change things around to your
   desired data.
2. <u>ENTER THE CLI DIRECTORY</u> (`cd client/cli`)
3. Run `npm run submission:create`

### 4. View Guestbooks and Records

The CLI provides several commands to view guestbooks and their submissions:

- **List guestbook records from your PDS (unauthenticated)**: `npm run
  records:list`
- **List guestbook records from your PDS (authenticated)**: `npm run
  records:list-auth`

It also provides methods that require an AppView (the next step)

- **List all guestbooks from the AppView (unauthenticated)**: `npm run
  guestbooks:get-all`
- **List all guestbooks from the AppView (authenticated)**: `npm run
  guestbooks:get-all-auth`

You can also see all the submissions as they happen with the following code:
`websocat
wss://jetstream2.us-east.bsky.network/subscribe\?wantedCollections=com.fujocoded.guestbook.submission
| jq 'select(.kind == "commit")'`

## Get an AppView Up

The AppView listens to guestbook-related events in the network and aggregates
data for consumption by applications and other clients.

### Generate the AppView Server definitions

The first step to creating an AppView the client is to generate the endpoint
definitions for our server by using the definitions in the `lexicons/` folder.
You can do this with the
[@atproto/lex-cli](https://www.npmjs.com/package/@atproto/lex-cli) package. This
creates all the code we need to provide applications with server endpoints that
respect the ATproto specifications and match the definitions in our lexicon.

```bash
npx @atproto/lex-cli gen-server ./client/generated/server ./lexicons/com/fujocoded/**/*.json
```

### Generate a public/private key pair

The DID document for your AppView will need a public/private key pair to ensure
applications know you are who you say you are. Here's how you can generate one:

1. Enter the AppView directory with `cd appview/`
2. Generate the public/private keys with `npm run keys:generate`

### Create the database and initialize its schema

To save the guestbook events in the network and all details about existing
guestbooks we need a database with the right tables! You can create such a
database by:

1. Add a `DB_FILE_NAME` property in your `.env` file (e.g.
   `DB_FILE_NAME=appview.db`)
2. Run `npx drizzle-kit push`

### Bring the ingestor up

To aggregate events on the network our AppView needs to listen to events on the
network, which it does through `appview/ingestor.ts`.

1. Enter the AppView directory with `cd appview/`
2. Run the ingestor with `npm run dev:ingestor`

### Bring the AppView server up

Now we run the actual AppView server so applications can ask for the data they
need.

1. Enter the appview directory `cd appview/`
2. Run `npm run dev` to start serving the AppView

### Build the AppView for production

If you need a built JavaScript output instead of running the AppView directly
with `tsx`, you can now build it with `tsdown`.

1. Enter the appview directory with `cd appview/`
2. Run `npm run build`
3. Start the server with `npm run start`
4. Start the ingestor with `npm run start:ingestor`

#### Make the AppView server publicly available

IMPORTANT: To make the AppView work, it needs to be reachable from the external
internet at a specific address. If you have tailscale, you can use serve/funnel
to create this address. You can also use ngrok, or cloudflare tunnels.

Running from the top-level folder of this repo, you can use these commands:

- `npm run dev:appview` for the AppView server + ingestor + tunnel
- `npm run dev:tunnel` for the tunnel only
- `npm run dev:appview:local` for the AppView server + ingestor without a tunnel

These set `APPVIEW_DOMAIN` and `GUESTBOOK_APPVIEW_DOMAIN` from the public tunnel
hostname. If a matching tunnel is already running, they reuse it instead of
starting a second one.

1. Run `tailscale serve --bg http://localhost:3003`
2. Run `tailscale funnel --bg 3003`
3. Run `tailscale serve status` and use the address from the funnel

#### Configure the public address of your AppView server

1. Save the <u>public</u> address of your AppView server in the `.env` file
   under `appview/` (e.g. `APPVIEW_DOMAIN=worktop.tail2ad46.ts.net`)

## Putting your Guestbook on your Website

This repo includes an Astro client under `client/astro` that can create and
display guestbooks on a website.

### Run the Astro client

From the repo root:

1. `npm run dev:client` to start the Astro site with a public AppView tunnel
2. `npm run dev:client:local` to start only the Astro site

Or, if you specifically want to work inside the Astro package:

1. Enter the Astro client directory with `cd client/astro`
2. Install dependencies with `npm install --legacy-peer-deps`
3. Start the site with `npm run dev`

> [!NOTE] The current published `@fujocoded/authproto` package works in this
> repo with Astro 6, but it still declares Astro 5 peer dependencies. Until that
> package updates its peer range, `npm install --legacy-peer-deps` is required
> for a fresh install.

## ⚠️⚠️⚠️ DANGER: Deleting Everything ⚠️⚠️⚠️

Experimented too much and hate leaving a mess around? Delete everything with
`npm run dangerously-delete-everything`, which will (again) DELETE EVERYTHING.

To use it you should:

1. Take the above steps to install the `cli` commands
2. Enter the client directory with `cd client/cli/`
3. Run `npm run dangerously-delete-everything`

If you want to be more targeted with what you delete and to set the right values
for your user, you can modify `client/cli/delete-everything.ts`. Good luck!

## TODO-list!

- [x] Get someone else to write in the lexicon!
- [ ] Display other lexicons
  - [ ] Turn the submission type returns into a union
- [ ] Deploy the AppView
- [ ] Move AppView to new Lexicon CLI

### Lexicon

- [x] Allow hiding guestbook submissions
- [x] Return information on submissions visibility in queries
- [x] Return information on submissions visibility in guestbooks list
- [x] Allow blocking users

NICE TO HAVES:

- [ ] Allow restricting which URLs a guestbook is displayable on

### AppView

- [x] Return handles of users
- [x] Return avatars of users
- [x] Improve HTML generation
- [x] Allow creating guestbooks
- [x] Handle deletions of submissions
- [x] Handle deletions of guestbooks
- [x] Return information on submissions visibility in queries
- [x] Return information on submissions visibility in guestbooks list
- [x] Return hidden submissions ONLY if you're logged in
- [x] Handle edits of guestbook (e.g. title)

NICE TO HAVES:

- [ ] Handle edits of submissions
- [ ] Allow per-guestbook moderation overrides
- [ ] DO NOT SWALLOW ERRORS and log them instead
- [ ] Save user profile info to database
  - [ ] Periodically refresh user profile info in database
- [ ] Figure out if we can accept guestbook submissions from HTML iframes
  - [ ] Try out CORS, maybe?

### Ingestor

- [x] Catch up with cursor
- [x] Change timing of cursor save to consider all operations
- [x] Handle deletions of submissions
- [x] Handle deletions of guestbooks
- [x] Handle edits of guestbook
- [x] Handle blocking of users
- [x] Push new database schema for hidden submissions
- [x] Make sure hiding submissions work
- [x] Handle deletion of gates

NICE TO HAVES:

- [ ] Handle edits of submissions
- [ ] Handle identity/account events

### CLI Client

- [x] Get rid of app passwords
- [x] Test that it's still working

NICE TO HAVES:

- [ ] Allow global configuration
- [ ] Create initialization script

### Astro Client

- [x] Style the guestbook page
- [ ] Make the write submission form nicer
- [ ] Make overall styles decent
- [x] Make our login look nice
  - [x] Inform user that they are logged in
  - [x] Allow users to use their handle and not just DID
  - [x] Allow users to log out
  - [x] Redirect to right port on login
  - [x] Figure out how to configure where it goes on logout
  - [ ] Configure where it goes on logout
- [x] Allow creating guestbooks
- [x] Allow listing guestbooks of a user
- [x] Move Astro-based client to client directory
- [x] Re-add authentication to the client
- [x] Allow deletions of submissions
- [ ] Allow deletions of your submissions on other people's guestbooks
- [x] Allow deletions of guestbooks
  - [ ] Add deleting of (your) submissions and guestbook at the same time
- [x] Do Astro trick to redirect after submission
- [x] Hide hidden submissions when logged out
- [x] Show which submissions are hidden to a logged in user on guestbook
- [x] Show information on submissions visibility in guestbooks list

#### HTML iframe Client

NICE TO HAVES:

- [ ] Figure out if we can allow submission via form

#### Others

- [ ] Create Astro plugin to show guestbook
- [ ] Allow Astro plugin to set up guestbook
- [ ] Create webcomponent to display guestbook
