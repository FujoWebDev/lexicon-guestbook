# Guestbook AppView

This directory contains the code for the AppView of our guestbook, which helps
us build guestbook-related applications by providing us with data about
guestbooks in the ATmosphere—that is, the ATproto network.

This AppView is made of two separate pieces of the same puzzle:

- [The AppView server](./index.ts), which client applications—like our [command
  line scripts](../client/cli), any "manage you guestbooks!" service, or any
  [sites that displays guestbooks](../client/astro)—can use to ask questions
  about any guestbooks in the network
- [An Ingestor script](./ingestor.ts), which makes it possible for the AppView
  answers those questions by looking at guestbook-related events that happen in
  the network—like a new guestbook being created, or a new comment being made or
  deleted—and storing their data

In short and more technical terms, this AppView server and the Ingestor share
the same underlying database: the AppView uses it to retrieve data about
guestbooks and provide information to app developers, while the Ingestor fills
that database with new data as it comes in.

## _Why_ are AppViews?

If you're used to a different paradigm (or are curious by nature) you may be
wondering: why are we building "AppViews" in the first place?

**AppViews help developers quickly and easily write different fun, creative and
(hopefully) useful applications that rely on the same underlying data.** They do
this by letting them skip some of the repetitive-but-alas-necessary work each
needs to make their ideas happen: storing and retrieving user data, and turning
it into useful information.

### Our Guestbook AppView

In our case, **this Guestbook AppView lets developers ask questions about any
guestbook in the ATproto network**: which one(s) does a user own? What have
people written on them? Which of their entries should be displayed, and which
ones should be hidden—either because they come from a blocked user, or the owner
has manually hidden them?

While every guestbook application could write its own code to answer these
questions, that is (for most people) not quite as fun or interesting as using
this data to build apps for others to use. By lowering the barriers of entry to
writing application code, **AppViews make it possible for more applications
(made by a more diverse set of developers) to exist.**

> [!TIP]
> You can find the questions this AppView can answer in the
> [`lexicons/com/fujocoded/guestbook`
> directory](../lexicons/com/fujocoded/guestbook). They're the ones that start
> with `get` and have `"type": "query"` in their definition.

### Other AppViews: Bluesky (and beyond)

Not all AppViews answer questions about _Guestbooks_. Bluesky's AppView, for
example, lets developers instead ask questions about posts, likes, and other
users in the network that have signed up to Bluesky. **Bluesky's AppView lets
developers quickly build new applications that use data created on Bluesky, and
data that's shaped the same way, regardless of origin.** They can find out who a
user's friends (and enemies) are, show them feeds they're subscribed to, or even
just retrieve their Bluesky's handle and avatar to use in their own applications
instead, without having to store and retrieve all data in the network.

> [!TIP]
> You can find the Bluesky AppView at
> [https://public.api.bsky.app/](https://public.api.bsky.app/), and see all the
> questions it can answer [in the Bluesky
> documentation](https://docs.bsky.app/docs/api/app-bsky-actor-get-profile).

> [!NOTE]
>
> #### A practical example
>
> If you need to see it to believe it (or understand it), you can find the result
> of asking for [fujocoded.bsky.social](https://fujocoded.bsky.social)'s profile
> information to this AppView by going to the following address with any regular
> browser:
>
> [https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=fujocoded.bsky.social](https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=fujocoded.bsky.social)

## What do AppViews enable?

While it's certainly useful on its own, there is more to AppViews than taking
repetitive work away from application developers by answering questions for
them: **they also give developers (and their users) a choice in _who_ is going
to answer these questions.** And similarly, they let anyone step in to answer
questions—any question!—for others.

> [!NOTE]
>
> #### A Practical Example, pt. 2
>
> To see how this looks in practice you can look again at how we ask Bluesky's
> AppView for [fujocoded.bsky.social](https://fujocoded.bsky.social)'s profile
> information:
>
> [https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=fujocoded.bsky.social](https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=fujocoded.bsky.social)
>
> This time, notice its shape:
>
> - `[AppView URL]`/xrpc/
> - `[question it's answering]`?
> - `[details of the request]`.
>
> Any AppView can implement `app.bsky.actor.getProfile` to signal it knows
> how to get the profile of a Bluesky user. A developer could then change
> `[AppView URL]` to that AppView's address and get the same answer!

### Same Questions, Multiple AnswerERs

Since the data in the ATproto network is freely available, anyone can use it to
create an AppView that answers questions developers may care about. As we've
seen, this means that there can be different AppViews that answer the same set
of questions: for example, **a developer could choose to ask Blacksky's AppView
instead of Bluesky's to list all the posts a user has made.** They can even
leave the choice of who to ask to to the users themselves!

The ability to switch AppView helps make applications more resilient and
equitable:

- Since anyone can create an AppView to answer any set of questions, **anyone
  who can write or access the code for an AppView can spin up their own
  "answerer".** This means that if a particular company or developer should stop
  providing one, others could step in to fill the void, and applications could
  quickly get up and running again simply by changing who they ask questions to.
- Since each one is free to make its own choices on how to answer questions,
  **AppView have the power to return different data to users and developers.**
  They could, for example help them avoid bad actors by restricting which
  accounts they return answers from—essentially, "banning" a user without fully
  removing their data from the network. While this means one AppView can make
  arbitrary decisions, in practice since developers (and more and more end users
  with time) can easily switch to a different AppView, no one has final say on
  who gets to be counted in these answers.

To facilitate this ability to switch, AppViews can coordinate to be asked
questions (and return answers) in the same language by declaring and
implementing different Lexicons.

> [!TIP]
> Once again, you can find the questions this AppView can answer in the
> [`lexicons/com/fujocoded/guestbook`
> directory](../lexicons/com/fujocoded/guestbook). They're the ones that start
> with `get` and have `"type": "query"` in their definition.

### Same AnswerERs, Multiple Questions

With so much data in the network, there are many questions that can be asked
(and answered)! **AppViews are not restricted to answering any specific set of
questions:** they can choose as many as their implementer and/or provider's
heart desire, picking and choosing which ones they want to work with.

In practice, this means that:

- **AppViews can answer questions about data created by different
  applications:** for example, Bluesky could decide to support our guestbook
  questions in their AppView. Similarly, this AppView could choose to also
  provide, for example, informations about a user's Bluesky profile.
- **Not all AppViews need to answer all questions about certain data:** For
  example, this guestbook AppView only answers guestbook-related questions. And
  while we could extend it to also answer questions about, for example,
  "Bluesky-shaped data", that would require more time and resources than we have
  time and energy (and desire) to provide.

When writing applications for end users, **developers don't have to use just one
AppView**: they can mix and match different ones to create the unique experience
they seek. For example, a developer could easily create an application that
pairs our Guestbook's AppView with Bluesky's to show you all the guestbooks in
your circle of friends.

And even further, should that generous developer believe multiple applications
could benefit from their work, they could redistribute the data they gathered
through another AppView. This would then let other developers quickly and easily
create their own novel applications on top of their hard work.

## What's _Different_ About AppViews?

### Traditional "closed" Software

In traditional web software—from social networks like Twitter or Tumblr, to
anything from Discord to Google Docs to Figma—applications are in control of
users' data, which is kept in the private storage of the application itself.
Since this data is not public, nor in the users' possessions, those who own
these applications can unilaterally decide which questions external developers
get to ask about that data, how often they can ask them, and even how much they
must pay to get the answers they seek.

This tight control on users' data gives these applications a disproportionate,
hard-to-disrupt ability to control which other applications can exist, and
whether they can continue existing. Without the ability for app developers (or
users!) to let _others_ answer these questions, those who control this software
can choose to suddenly [remove the ability to ask
them](https://en.wikipedia.org/wiki/Reddit_API_controversy), or to [make asking
them prohibility
expensive](https://en.wikipedia.org/w/index.php?title=Twitter_under_Elon_Musk&oldformat=true#Aggressive_monetization_of_access)—if
they ever let people ask them at all.

### Decentralized (Federated) Software

In other decentralized network applications, like the current implementation of
Mastodon (based on ActivityPub), no single individual or company controls all
the data. Instead, data is distributed across many independent versions of each
application (or other compatible ones), which then use the same language to
exchange information with each other. However, while this data can be
communicated freely, each _instance_ of this software retains full control over
the information of its users: account identity, storage, and functionality are
all bound together in a single, unbreakable package.

Because of this, even though these applications exchange data freely with each
other, and social graphs can be ported across them, users cannot wholesale move
their identity and data from one application to another. A Mastodon account, for
example, cannot also be used as a Pixelfed or PeerTube account, even though
these applications are all part of the same interconnected network. Without the
ability to separate identity and data from the application where they were
created, users' remain tightly bound to the type of application they chose when
they first joined the network. And while they can change the specific version or
hosting provider of their software of first choice, the inability to move their
data to another still limits their freedom to explore different tools that suit
their needs, and developers' ability to create new experiences on top of users'
content.

While this is a software limitation [rather than a protocol
one](https://swicg.github.io/activitypub-data-portability/lola), it remains the
status quo in the fediverse of today. In contrast, AppViews are already built
to let any application ask questions about users' data, regardless of where the
data was created or stored. They also let developers choose how to aggregate and
make sense of this data, both within a single or across multiple application,
and let them create their own unique "view" of this data to be shared with
others. Once those views are in place, other developers can then mix and match
them to quickly build client applications for anyone in the ATmosphere to enjoy.

In addition to these limitations, each new application that joins the Fediverse
of today needs to rebuild its own account creation, data storage, and
information exchange systems. This means developers must invest significant
resources in building this infrastructure before they can focus on new features
and experiences, making it more cumbersome and expensive to create
applications—including alternatives to existing ones.

Not only this makes experimentation and innovation more difficult to boot, but
since each application requires users to create a new account and find a new
server to call home, switching to a new application involves significant
friction for users. If they choose to adopt a new platform, users must still
migrate their followers, (most often) abandon their post history, and change
their identity. This makes it harder for new software to build its own community
of users, even if those users can still reach out to their friends.

In contrast, AppViews (and the other building blocks of ATproto) let users
maintain a single identity they can use to access any application in the
network, and a single data store that works across applications. Thanks to these
properties, users can move seamlessly across the ATmosphere, which helps
developers focus on building unique features rather than rebuilding
infrastructure and bootstrapping their communities from scratch.

## Final Credits

- Written by [Ms Boba](https://www.essentialrandomness.com/)
- A huge thank you to Emelia
  [@thisismissem@hachyderm.io](https://hachyderm.io/@thisismissem) /
  [@thisismissem.social](https://bsky.app/profile/thisismissem.social) who
  helped me (finally!) understand the difference between Fediverse and
  ATmosphere applications well enough that I could explain it to others.

Want to help create more accessible knowledge for a more decentralized future?
[Support FujoCoded on Patreon!](https://www.patreon.com/c/fujocoded)
