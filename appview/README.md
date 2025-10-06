# Guestbook AppView

This directory contains the code for the AppView of our guestbook. It's made of
two separate pieces of the same puzzle:

- [The AppView server](./index.ts), which client applications—like our [command
  line scripts](../client/cli), any "manage you guestbooks!" service, or any
  [sites that displays guestbooks](../client/astro)—can use to ask questions
  about any guestbooks in the network
- [An Ingestor script](./ingestor.ts), which makes it possible for the AppView
  answers those questions by looking at guestbook-related events that happen in
  the network—like a new guestbook being created, or a new comment being made or
  deleted—and storing their data

In short and technical terms, the AppView server and the Ingestor share the same
underlying database: the AppView one uses it to retrieve data about the guestbook
and provide information to app developers, while the Ingestor fills it with new
data as it comes in.

## _Why_ are AppViews?

If you're used to a different paradigm (or are curious by nature) you may be
wondering: why create AppViews at all?

**AppViews help developers quickly and easily write different fun, creative and
(hopefully) useful applications that rely on the same underlying data.** They do
this by letting them skip some of the repetitive-but-alas-necessary work each
needs to make their ideas happen: storing and retrieving user data.

### Our Guestbook AppView

In our case, **this Guestbook AppView lets developers ask questions about any
guestbook in the ATproto network**: which one(s) does a user own? What
have people written on them? Which of their entries should be displayed, and
which ones should be hidden—either because they come from a blocked user, or
the owner has manually hidden them?

While every guestbook application could write its own code to answer these
questions, that is (for most people) not quite as fun or interesting as using
this data to build apps for others to use. By lowering the barriers of entry
to writing application code, **AppViews make it possible for more applications
(made by a more diverse set of developers) to exist.**

You can find the questions this AppView can answer in the
[`lexicons/com/fujocoded/guestbook`
directory](../lexicons/com/fujocoded/guestbook). They're the ones that start
with `get` and have `"type": "query"` in their definition.

### Other AppViews: Bluesky (and beyond)

Not all AppViews answer questions about _Guestbooks_. Bluesky's AppView, for
example, lets developers instead ask questions about posts, likes, and other
users in the network that have signed up to Bluesky. **Bluesky's AppView lets
developers quickly build new applications that use data created on Bluesky, and
data that's shaped the same way, regardless of origin.** They can find out who a
user's friends (and enemies) are, show them feeds they're subscribed to, or even
just retrieve their Bluesky's handle and avatar to use in their own applications
instead, without having to store and retrieve all data in the network.

You can find the Bluesky AppView at
[https://public.api.bsky.app/](https://public.api.bsky.app/), and see all the
questions it can answer [in the Bluesky
documentation](https://docs.bsky.app/docs/api/app-bsky-actor-get-profile).

#### A practical example

If you need to see it to believe it (or understand it), you can find the result
of asking for [fujocoded.bsky.social](https://fujocoded.bsky.social)'s profile
information to this AppView by going to the following address with any regular
browser:

[https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=fujocoded.bsky.social](https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=fujocoded.bsky.social)

## What do AppViews enable?

While it's certainly useful on its own, there is more to AppViews than taking
repetitive work away from application developers by answering questions for
them: **they also give developers (and their users) a choice in _who_ is going
to answer these questions.** And similarly, they let anyone step in to answer
questions—any question!—for others.

#### A Practical Example, pt. 2

To see how this looks in practice you can look again at how we ask Bluesky's
AppView for [fujocoded.bsky.social](https://fujocoded.bsky.social)'s profile
information:

[https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=fujocoded.bsky.social](https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=fujocoded.bsky.social)

Notice its shape: `[AppView URL]`/xrpc/`[question it's answering]`?`[details of the request]`.
**You could change `[AppView URL]` to the URL of any AppView that knows how to get the profile
of a Bluesky user, and get the same answer!**

### Same Questions, Multiple AnswerERs

Since the data in the ATproto network is freely available, anyone can use it
to create an AppView that answers questions developers may care about. As
we've seen, this means that there can be different AppViews that answer the same
set of questions: for example, **a developer could choose to ask Blacksky's
AppView instead of Bluesky's to list all the posts a user has made.** They can
even leave the choice of who to ask to to the users themselves!

The ability to switch AppView helps make applications more resilient and equitable:

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
implementing different Lexicons. Once again, You can find the questions this
AppView can answer in the [`lexicons/com/fujocoded/guestbook`
directory](../lexicons/com/fujocoded/guestbook). Once again, they're the
ones that start with `get` and have `"type": "query"` in their definition.

### Same AnswerERs, Multiple Questions

With so much data in the network, there are many questions that can be asked
(and answered)! **AppViews are not restricted to answering any specific set of
questions:** they can choose as many as their implementer and/or provider's heart
desire, picking and choosing which ones they want to work with.

In practice, this means that:

- **AppViews can answer questions about data created by different applications:**
  for example, Bluesky could decide to support our guestbook questions in their
  AppView. Similarly, this AppView could choose to also provide, for example,
  informations about a user's Bluesky profile.
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

And should a generous developer believe multiple applications could benefit from
their work, they could gather that data and redistribute it through another
AppView, letting other developers quickly and easily create their own novel
applications on top of their hard work.

## What's _Different_ About AppViews?

TBD
