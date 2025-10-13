### Rough idea

Lessons learned from building a usable one shot full stack app generator.

1. Plan first, generate later
2. Keep the higher level plan in the context
3. Give it guardrails - a template to start saves a bunch of tokens
4. Feed it with compiler checks and error messages (linting is interesting as well)
5. Give it higher level lego blocks for your specific use case

Some of our results:

1. Generating functional full-stack apps with auth, database, React client
2. Quite a bit cheaper than the naive agent approaches at the time
3. Robust system that could give people a start with Wasp

### **What I want to do for this presentation**

1. State the problem of generating a usable full-stack app with just a starting prompt
2. Before we start we have to have a harness:
    1. Calling an OpenAI model to generate code
        1. Tool calling to avoid redundant text
    2. Ability to write files in the file system
3. Go through the phases of getting there:
    1. Naive approach → DEMO
    2. Higher level plan first → DEMO
    3. Starting template → DEMO
    4. Self correcting with compiler checks → DEMO
    5. Higher level building blocks (enables focus on business logic) → DEMO

### Demo tool

A harness where I can input an initial prompt, view the I/O with the LLM, a preview the results. 

Thoughts:

- Maybe it should be a Node.js server with [Socket.io](http://Socket.io) and some React client
    - Express + websockets
    - React + Vite + some UI framework that can be customised a bit not to look too stock
    - Do we want to over-engineer this with coordinating multiple worker processes and stuff like that? Probably not - but it might be a nice abstraction?
- The Node.js server could run the generated app (let’s say we use Vite for that part) and then also we load the preview in an iframe? Is that possible to do locally? Do we need to do some DNS or HTTPS shenanigans
    - There is the API and the client apps that need to be started
- The demo harness should be written in a way to allow to toggle different optimisations e.g. start with a high level plan, use template, check with compiler and fix any errors, use higher level building blocks
