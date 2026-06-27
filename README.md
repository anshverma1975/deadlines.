# Deadline Dashboard
> Because for some reason , no other app out there understands what a college student wants

I was so tired of calendar apps. Every single one shows events in this annoying hourly column format. 12-1 PM, 1-2 PM, all these time slots I don't care about. I'm a college student. I don't need to know what's happening at 3 PM. I need to know what assignments are due this week. What deadlines I'm forgetting. Which subjects I've been ignoring.

So I built this.

It's simple. Sign in with Google, it pulls your calendar events, and shows you everything for any day you click on. That's it !

I have 4-8 subjects each semester. This helps me keep track without losing my mind in Google calendar

## Features

- Google Calendar sync
- Auto detects subjects from event titles
- Color coded by subject
- Daily task view
- Manual task adding
- Past dates dimmed
- Browser notifications
- Dark mode

- ## Tech Stack

Next.js, TypeScript, Tailwind CSS, Google Calendar API

# How to use it
```bash
git clone https://github.com/anshverma1975/deadlines.git
cd deadlines
npm install
```

Create a .env.local file:

```text
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_client_id_here
```
Then:

```bash
npm run dev
```

Open localhost:3000 and sign in.

# Google Cloud setup
You'll need to enable Calendar API in Google Cloud Console and create OAuth credentials. Add localhost and your Vercel domain to authorized origins. Copy the client ID. That's it.


<div align="center">
  <img src="https://api.visitorbadge.io/api/visitors?path=anshverma1975%2Fdeadlines&label=Visitors&countColor=%23263759" />
</div>
