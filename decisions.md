Initially this was my architecuture:
1. Main agent (sonnet will have strong prompt instructions) where it will make the choice of calling which tool (KB or search)
2. But if the user query is twisted, it is going for web search, and continuosly going in loop to retrive response.

So, giving blind control to tools without proper eval was not the solution.

So, I changed the way, where I build the whole thing with SLMs

- Main agent will be conversational with the user
- We have a dedicated search service where we can simply return the curated result to the main agent
- WE have 2 check ai calls (one which scores it, one which reviews web results)
- Now, proper check for quality is super-important, but that should not delay the response to the user.

So, did crafted them in a way where they don't have to generate much, just take input and validate

Each llm call adds additional 1s or less delay max

Now, this method is useful as the data is coming clean, my main agent doesn't have to take much steps.

** Messages **

- Due to time constraints, didn't shown the messages listing, chats showing feature

30 min - went for architeture (2 architectures... if agentic one didn't work then the other one with guardrails)
30 min - implemented a simple POC api with sonnet and tools
it didn't worked out

gave this architecture to claude code, my instructions, and it coded it off.

Testing, prompt iterations, fixed went.

Fuckups, iterations - 
1. I was experimenting coding with opencode + claude code
2. Opencode took instructions, delivered vague code.. (static slop, wrote its own components, no structuring)
3. Then just kept opencode code, structured and cleaned it manually first(deleting, adding comments), then with claude code.
4. used neonDB. Initially thought of simple keyword search, later thought of vector search... faced some friction in the config, migrations
5. Experimenting with guardrails, checking where all the steps fail, which step failed, what to do when it failed

Had fun understanding, making it work