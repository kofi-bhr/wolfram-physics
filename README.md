# hypergraph rewriting visualizer

so i read stephen wolfram's [technical introduction to his physics project](https://www.wolframphysics.org/technical-introduction/basic-form-of-models/) and had a bit of a moment.

the idea is simple (sort of): start with a graph, apply a rewriting rule over and over, and then watch cool patterns come about. wolfram thinks this might literally be how spacetime works. i have no idea if he's right, but watching the patterns grow in real time is very cool, so i built this.

---

## what it does

you type a rule like:

```
{{x,y},{x,z}} -> {{x,z},{x,w},{y,w},{z,w}}
```

hit run (or just wait a for it to compute), and watch the hypergraph grow step by step. nodes and edges appear according to the rule. the layout is force-directed, so it ~~will~~ should settle into a shape that reflects the topology.

---

## how to use it

1. **rule**: type your rule in the top field. variables are lowercase letters. anything that appears on the right but not the left is a "new node" (gets a fresh id each time the rule fires).

2. **initial**: the starting graph. `{{1,2}}` is a single edge. `{{1,1}}` is a self-loop. you can also type `loop`, `edge`, or `triangle`.

3. **steps**: how many times to apply the rule. be careful because some rules grow exponentially fast (that's the fun part and also the "oh no" part). worst-case it can take up to a minute to render.

4. **animate steps**: turns on step-by-step playback. each step holds for 800ms. hit replay to restart.

5. **pan + zoom**: drag to pan, scroll to zoom. no buttons for this — it's a vibe, not a dashboard.

---

## some starter patterns (try these)

| rule | initial | what happens |
|------|---------|-------------|
| `{{x,y}} -> {{x,y},{y,z}}` | `{{1,2}}` | binary tree; doubles every step |
| `{{x,y}} -> {{y,z},{z,x}}` | `{{1,1}}` | directed cycle that doubles; ring of nodes |
| `{{x,y},{x,z}} -> {{x,z},{x,w},{y,w},{z,w}}` | `{{1,2},{1,3}}` | complex web; ~7k nodes at step 15 (give it a sec) |
| `{{x,y,z}} -> {{x,y,w},{y,z,w},{z,x,w}}` | `{{1,2,3}}` | ternary hypergraph; kind of like a growing tetrahedron |

---

## tech stuff

- rule parsing, pattern matching, and rewriting all run in a **web worker** — the main thread handles only rendering, so the ui never freezes
- layout is **d3-force** with adaptive spring constants that scale with graph size
- rendering is **pixi.js v8** — handles 15k+ nodes at 60fps
- built in **next.js 16** with no css frameworks (css variables + vanilla css only, the way god intended)

---

## notes

i'm 17. this is a side project. the math is correct to the best of my knowledge. i implemented the matching and simultaneous rewriting as described in the wolfram technical introduction. if you find a bug please open an issue and be nice about it.

the default rule is set to something small so your browser doesn't immediately demand a sacrifice. if you want the full messiness, try `{{x,y},{x,z}} -> {{x,z},{x,w},{y,w},{z,w}}` at step 15.

:)

— kofi
