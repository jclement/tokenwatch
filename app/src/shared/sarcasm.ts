// The app's true purpose: judging you, gently, in greyscale italics.
// Ported from Sarcasm.swift. Each pool is picked deterministically from a seed
// so the UI doesn't flicker on every redraw; distinct offsets keep slots from
// moving in lockstep.

import { fmtMoney, shortDay } from "./format";

const pick = (arr: string[], seed: number): string =>
  arr.length === 0 ? "" : arr[Math.abs(seed) % arr.length];

export const taglines = [
  "Watching you set money on fire, one token at a time.",
  "A loving monument to your API spending.",
  "Because ignorance was cheaper, wasn't it?",
  "Your tokens called. They're not coming back.",
  "Turning compute into regret since just now.",
  "The receipts you didn't ask for, beautifully rendered.",
  "Proof, at last, of where it all went.",
  "Spreadsheets are scary. This is worse, but prettier.",
];

const headerTitles = [
  "The Damage Report", "The Reckoning", "Where It All Went",
  "Exhibit A", "The Confession", "The Tab",
];

const refreshButtons = [
  "Refresh (brace yourself)", "Recount the damage", "Update my disappointment",
  "Scan the wreckage", "Tally it again", "Show me the carnage", "Re-open the wound",
];

const emptyState = [
  "No tokens found. Either you're frugal or these logs are lying.",
  "Nothing here. Suspiciously responsible of you.",
  "Zero usage detected. Did you actually do any work?",
  "Empty. The model misses you already.",
  "No data. A blank canvas of fiscal restraint.",
];

export const sarcasm = {
  pick,
  tagline: (seed: number) => pick(taglines, seed),
  headerTitle: (seed: number) => pick(headerTitles, seed + 167),
  refreshButton: (seed: number) => pick(refreshButtons, seed),
  emptyState: (seed: number) => pick(emptyState, seed),

  verdict(dollars: number, seed: number): string {
    let pool: string[];
    if (dollars < 1)
      pool = ["Under a buck. Adorable. Are you even trying?", "Less than a coffee. The model is unimpressed.", "Pocket change. Live a little.", "Practically free. Where's the ambition?"];
    else if (dollars < 10)
      pool = ["Single digits. A rounding error with delusions of grandeur.", "Lunch money. The model ate well.", "A modest start to a beautiful problem.", "Cheap. For now. Give it a week."];
    else if (dollars < 50)
      pool = ["A respectable little habit forming here.", "Enough to notice, not enough to panic. Yet.", "The gateway-drug phase of token spending.", "Tasteful. Restrained. Almost responsible."];
    else if (dollars < 200)
      pool = ["That's a nice dinner you fed to a language model.", "Two hundred dollars of vibes and autocomplete.", "You could've bought a thing. Instead: tokens.", "A weekend's worth of 'just one more prompt.'"];
    else if (dollars < 1000)
      pool = ["We've entered 'maybe don't tell finance' territory.", "Three figures climbing toward four. Bold.", "This is a hobby now. An expensive, glowing hobby.", "Somewhere an accountant just felt a chill."];
    else if (dollars < 5000)
      pool = ["This is a car payment. For tokens. Bold.", "Rent money, converted directly into autocomplete.", "You've funded a small GPU's gap year.", "We don't say the number out loud anymore."];
    else
      pool = ["At this point just frame the invoice as modern art.", "This isn't spending, it's patronage of the arts.", "Five figures. The model should send you a holiday card.", "You have personally kept a datacenter warm. Thank you."];
    return pick(pool, seed);
  },

  tokenQuip(total: number, seed: number): string {
    let pool: string[];
    if (total < 100_000)
      pool = ["A handful of tokens. Practically artisanal.", "Boutique quantities. Hand-picked, surely.", "Barely a snack for the model."];
    else if (total < 10_000_000)
      pool = ["Millions of tokens. Light reading, apparently.", "A few million. The model skimmed it, honestly.", "Millions served. McDonald's would be proud."];
    else if (total < 1_000_000_000)
      pool = ["Hundreds of millions. You've out-read several libraries.", "Enough text to wallpaper a small country.", "Nine zeroes incoming. Brace."];
    else
      pool = ["Billions. With a B. The model knows you better than your family.", "Billions of tokens. You and the model are basically married now.", "With a B. The Library of Alexandria is jealous.", "Billions. At this scale it's not usage, it's a relationship."];
    return pick(pool, seed + 11);
  },

  outputQuip: (seed: number) =>
    pick(["The part you actually read. Maybe.", "What the model wrote back. Priced like champagne.", "Words out. The expensive direction.", "Everything it said, billed by the syllable.", "Output: the premium tier of regret."], seed + 23),

  activeDaysQuip: (seed: number) =>
    pick(["Days you chose violence against your budget.", "Days the model earned its keep, and then some.", "Days of honest work and dishonest invoices.", "Days you said 'just one more thing.'", "Days on the record. No alibi."], seed + 37),

  cacheQuip(readShare: number, seed: number): string {
    let pool: string[];
    if (readShare > 0.5)
      pool = ["Over half your input was cached. Look at you, fiscally responsible.", "Mostly cache reads. Somewhere a CFO sheds a single proud tear.", "The cache is carrying this whole operation. Tip it.", "Heavy cache reuse. Almost suspiciously sensible."];
    else if (readShare > 0.2)
      pool = ["Decent cache reuse. The frugality is showing.", "Some cache hits. You're learning. Slowly.", "Halfway to thrifty. Keep going.", "Respectable caching. The wallet thanks you."];
    else
      pool = ["Barely any cache hits. Paying full price like a tourist.", "Almost no caching. Bold strategy, financially.", "Full freight on nearly everything. Brave.", "Cache? Never heard of her, apparently."];
    return pick(pool, seed + 53);
  },

  dayQuip(day: { day: number; cost: number } | null, seed: number): string {
    if (!day)
      return pick(["No standout days yet. Consistency, or apathy?", "No clear winner yet. The spending is suspiciously even.", "Nothing dramatic so far. Give it time."], seed + 67);
    const templates = [
      "Your most expensive day was {day} — {cost} gone. Good times.",
      "{day} was the big one: {cost} vaporized in a single day.",
      "Peak chaos landed on {day} — {cost}. We don't talk about {day}.",
      "{day} cost you {cost}. Hope it was worth it. It probably was.",
      "Record holder: {day}, at {cost}. A day for the history books.",
    ];
    return pick(templates, seed + 67)
      .replaceAll("{day}", shortDay(day.day))
      .replaceAll("{cost}", fmtMoney(day.cost));
  },

  engineStandings: (seed: number) =>
    pick(["Pick a favorite. They're both expensive.", "Two engines enter. Your wallet does not leave.", "A rivalry funded entirely by you.", "Whoever wins, the bill loses."], seed + 83),
  overTime: (seed: number) =>
    pick(["A timeline of decisions you'd make again, probably.", "Watch the line go up. Feel things.", "Every spike is a story you'd rather not tell.", "History, rendered in shades of expensive."], seed + 101),
  byModel: (seed: number) =>
    pick(["A leaderboard nobody wanted to win.", "Ranking your models by sheer audacity.", "The podium of poor financial decisions.", "Who cost the most? Spoiler: the smart one."], seed + 113),
  byEngine: (seed: number) =>
    pick(["Claude vs Codex: a rivalry funded entirely by you.", "Two AIs walk into your bank account.", "The eternal question: which one robbed you faster?", "A tale of two engines and one very tired card."], seed + 131),
  perspective: (seed: number) =>
    pick(["Your tokens, translated into units you'll regret understanding.", "Big numbers are abstract. Third-graders are visceral.", "Putting the 'how much?!' into perspective.", "Context for a context window."], seed + 233),
  confessional: (seed: number) =>
    pick(["What the transcripts reveal. We read so you don't have to.", "A judgment-free zone, except for all the judgment.", "Your manners and the model's, side by side.", "Everything you said in anger, lovingly tallied."], seed + 251),

  swearVerdict(n: number, seed: number): string {
    let pool: string[];
    if (n === 0) pool = ["Not a single curse. Either a saint or a liar.", "Spotless language. Suspicious. Who hurt you so gently?"];
    else if (n < 10) pool = ["A few choice words. We've all been there.", "Mild. The model barely flinched."];
    else if (n < 50) pool = ["A healthy working relationship with profanity.", "Enough swearing to mean it, not enough to worry."];
    else if (n < 200) pool = ["Your keyboard has heard things. Dark things.", "The model has developed thick skin, thanks to you."];
    else pool = ["A sailor would tell you to calm down.", "At this volume it's not anger, it's a dialect."];
    return pick(pool, seed + 271);
  },

  sycophancy(n: number, seed: number): string {
    let pool: string[];
    if (n < 10) pool = ["The model rarely caved. You were right less than you think.", "Few concessions. A tough crowd, this model."];
    else if (n < 100) pool = ["A reasonable number of 'you're absolutely right's. Earned, surely.", "The model agreed with you a respectable amount. Suspiciously polite."];
    else pool = ["The model says 'you're absolutely right' like it's a nervous tic.", "At this point the agreement is reflexive, not sincere. Sorry."];
    return pick(pool, seed + 311);
  },

  nightOwl: (seed: number) =>
    pick(["When the spending happens. Spoiler: not at a reasonable hour.", "Your circadian rhythm, billed by the token.", "The hours your wallet wishes you slept through.", "A clock face, but every number is a regret."], seed + 331),
  nightOwlVerdict(share: number, seed: number): string {
    let pool: string[];
    if (share < 0.1) pool = ["A daylight creature. The model respects your bedtime.", "Barely any after-dark spending. Suspiciously well-adjusted."];
    else if (share < 0.3) pool = ["A bit of midnight oil. The good kind of bad decision.", "Some late nights. We've all chased one more fix."];
    else if (share < 0.5) pool = ["A solid chunk happens after midnight. Sleep is for the unambitious.", "The witching hour is a productive hour, apparently. Expensive, too."];
    else pool = ["Most of this happened when you should've been asleep. Iconic.", "You are nocturnal and your bank account knows it."];
    return pick(pool, seed + 347);
  },

  streaks: (seed: number) =>
    pick(["Consecutive days of choosing the keyboard over a life.", "How many days in a row you couldn't stay away.", "Dedication, or a cry for help? You decide.", "The model's longest-running relationship: you."], seed + 353),
  streakVerdict(longest: number, seed: number): string {
    let pool: string[];
    if (longest < 3) pool = ["A modest run. Touch some grass while you can.", "Short streaks. Commendable restraint, honestly."];
    else if (longest < 7) pool = ["Nearly a full week. The weekend never stood a chance.", "A respectable bender. Hydrate."];
    else if (longest < 21) pool = ["Weeks on end. Does the sun still exist? Asking for you.", "An impressive streak. Concerning, but impressive."];
    else pool = ["This isn't a streak, it's a lifestyle. Or a hostage situation.", "At this point the IDE pays rent. Legendary."];
    return pick(pool, seed + 359);
  },

  hallOfFame: (seed: number) =>
    pick(["Your deepest rabbit holes, immortalized.", "The sessions that ate an afternoon and asked for seconds.", "Greatest hits, measured in dollars and despair.", "Where 'quick fix' went to die."], seed + 367),
  environmental: (seed: number) =>
    pick(["Your autocomplete, measured in planetary regret.", "Every token a tiny coal fire. You've lit so many.", "The Earth's invoice. It does not accept apologies.", "Carbon, water, and rainforest — all so you didn't have to think."], seed + 373),

  quote: (seed: number) => pick(quotes, seed),
};

// The main event: a large pile of original, faintly judgmental one-liners.
export const quotes = [
  "You miss 100% of the tokens you don't spend. You also keep 100% of the money. Tradeoffs.",
  "Behind every great developer is a credit card statement they're afraid to open.",
  "The first rule of token club is you do not look at how many tokens are in token club.",
  "Compute is cheap, they said. They were not looking at this screen.",
  "Your prompt was three words. The context window was a Russian novel.",
  "An AI a day keeps the savings away.",
  "We are gathered here today to mourn the budget, taken from us too soon.",
  "Move fast and bill things.",
  "It's not a bug, it's a feature. The bug is in your bank account.",
  "Ask not what your tokens can do for you, but what you've spent on your tokens.",
  "Somewhere, a GPU is warm because you couldn't remember a regex.",
  "The cloud is just someone else's computer, charging you by the syllable.",
  "I came, I saw, I autocompleted a fortune away.",
  "Every token you cache is a token that doesn't betray you at full price.",
  "Two roads diverged in a wood, and I took the one with more API calls.",
  "Frugality is a virtue. This dashboard is a confession.",
  "They say money can't buy happiness. It can, however, buy 50 million output tokens.",
  "The model doesn't judge you. This app does that for free.",
  "A penny saved is a penny not spent on extended thinking.",
  "You can't take it with you, so you might as well stream it to an LLM.",
  "Hindsight is 20/20. Your token usage is 20 billion.",
  "In this house we respect the cache. The cache is the only thing keeping us solvent.",
  "If at first you don't succeed, retry — at 25 dollars per million output tokens.",
  "Rome wasn't built in a day, but it was probably cheaper than your last refactor.",
  "The road to production is paved with rate limit errors.",
  "Knowledge is power. Power is metered. The meter is running.",
  "I think, therefore I am. The model thinks, therefore you owe.",
  "Time is money. Tokens are also money. Money is, unsettlingly, also money.",
  "You had one job. The model had forty thousand, and invoiced for each.",
  "Curiosity didn't kill the cat. The cat just left adaptive thinking on overnight.",
  "There's no such thing as a free lunch, but there is a 1,550-hour code-execution allowance.",
  "Great prompts are written, not prompted. Yours was prompted. Several times. Expensively.",
  "The early bird gets the worm. The late-night coder gets the surcharge.",
  "Output tokens are like potato chips — you never write just one paragraph.",
  "Discretion is the better part of valor. Caching is the better part of the bill.",
  "When one door closes, another opens, and it also makes an API call.",
  "Slow and steady wins the race. Fast mode wins the race and empties the wallet.",
  "Brevity is the soul of wit. It is also, conveniently, the soul of a smaller invoice.",
  "Some spend tokens to find answers. Others find answers and spend tokens anyway.",
  "The model is a tool. The tool costs money. You are the one being used.",
  "Patience is a virtue, but streaming is a line item.",
  "You can lead a model to context, but you'll pay for every token it drinks.",
  "All that glitters is not gold. Some of it is just cache-read tokens, which is close enough.",
  "Genius is 1% inspiration and 99% billable input tokens.",
  "Don't count your tokens before they're cached.",
  "An ounce of prevention is worth a pound of 'why is this invoice so large.'",
  "The pen is mightier than the sword, and roughly the same price per word.",
  "Fool me once, shame on you. Fool me twice, that's just normal agent retry behavior.",
  "Better late than never. Better cached than billed.",
  "Actions speak louder than words, but words are what you're being charged for.",
  "The grass is always greener on the side with prompt caching enabled.",
  "If it ain't broke, don't prompt it again.",
  "Necessity is the mother of invention. Boredom is the mother of your token bill.",
  "A journey of a thousand miles begins with a single, surprisingly expensive, hello world.",
  "Out of sight, out of mind, still on the invoice.",
  "Hope for the best, but budget for the model leaving thinking on.",
  "You only live once, but the context window gets re-read every single turn.",
  "Honesty is the best policy. The second best is blaming the agent loop.",
  "Practice makes perfect. Perfect makes a noticeable dent in your monthly spend.",
  "Look before you leap. Read before you prompt. Cache before you cry.",
  "Where there's a will, there's a way. Where there's an LLM, there's a way to spend.",
  "The squeaky wheel gets the grease. The chatty agent gets the bill.",
  "Don't put all your tokens in one prompt.",
  "Every cloud has a silver lining. This one bills it back to you per gigabyte.",
  "A watched pot never boils. A watched token meter never goes down.",
  "Good things come to those who wait. Expensive things come to those who stream.",
  "He who hesitates is lost. He who doesn't cache is broke.",
  "The best things in life are free. None of them are on this dashboard.",
];
