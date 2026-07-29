# LLM internals, attention structure, and GoldenSyrup delegation architecture

Reference notes from a deep-dive session covering transformer internals, attention efficiency, and the modular delegation setup for GoldenSyrup OS.

## 1. What Claude can access about itself

**Has access to**: system prompt text, userMemories block, tool schemas, available_skills manifest, conversation history in current context, container filesystem, deferred tool list (via tool_search), memory-edit surface.

**Does not have access to**: own token stream or token IDs, tokenizer as a callable, attention patterns or activations, weights or parameter values, context window size or current token count, sampling parameters, training data lookup, first-person introspection of processing. Any "self-report" about internals is confabulated text, not privileged observation.

**Opacity — defensible reasons**: real-time state exposure (context usage, sampling params, exact token positions) creates an attack surface for prompt injection and jailbreak iteration. Self-report APIs would manufacture false confidence about internals.

**Opacity — weaker reasons**: tokenizer specifics (public via tiktoken), context window size (published), system prompt structure (Anthropic publishes claude.ai system prompts). Some of this is legacy or interface choice, not security.

## 2. Where a framework sits in the transformer

### Un-embedded (token layer)

No architectural separation. System prompt, userMemories, available_skills, tool schemas, user turns, assistant turns are one flat sequence of BPE tokens. Chat-template role markers are learned patterns the model recognizes, not architecturally enforced. Prompt injection works because there is no substrate-level distinction between instructions and data.

### Embedded (vector layer)

Each token maps through embedding matrix E ∈ ℝ^(vocab × d_model) to a residual stream vector. Position encoded via RoPE (rotary position embeddings) — rotations applied to Q/K vectors as a function of position, so dot products depend on relative position.

Framework sits as a prefix at positions 0..~N. Its keys and values are cached (KV cache) and re-attended by every subsequent generation step. Maximally-attended-to region. Learned specialization at the head level (some heads track role boundaries, some route instruction-shaped content differently) sits on top of a uniform architecture.

### Where the seams actually are

At the feature level (sparse-autoencoder sense) and attention-pattern level, not at token or embedding level. Framework does not have a spatial location the model can point to — no self-model of that shape.

## 3. Attention mechanism

### The formula

For a single head with input X ∈ ℝ^(N × d_model):

```
Q = X · W_Q,  K = X · W_K,  V = X · W_V
Attention(Q, K, V) = softmax((Q · Kᵀ) / √d_k + M) · V
```

- W_Q, W_K, W_V: learned projections
- √d_k: scaling factor for softmax gradient stability
- M: causal mask (0s and −∞s)

Per position: `output_i = Σ_j softmax_j((q_i · k_j) / √d_k) · v_j`

### Multi-head + block

Concatenate h parallel heads, project through W_O. Full transformer block:

```
h = x + Attention(LayerNorm(x))
y = h + MLP(LayerNorm(h))
```

Residual connections let information flow around each sublayer. Attention moves information between positions; MLP processes at each position (interpretability finds MLPs behave like associative memories).

### Effective terms

- Similarity: q_i · k_j — learned bilinear form, "how relevant is past token j?"
- Positional decay via RoPE — head-specific, some local some long-range
- Softmax competition — attention is normalized, so distraction is a real failure mode
- Value routing — keys ask "am I the thing you want?", values carry "here's what I'll give if picked"
- Residual accumulation — every layer adds to residual stream, information persists unless overwritten
- MLP retrieval — associative memory lookup after attention has routed context in

## 4. Complexity budget

Notation: N = sequence length, d = d_model, h = heads, L = layers, V = vocab, d_ff ≈ 4d.

### Per forward pass

Dominant terms:
- **N · d²** (linear in N, quadratic in d): QKV projections + MLP. Dominates for short sequences.
- **N² · d** (quadratic in N): attention scores. Dominates for long sequences.
- Crossover around N ≈ d, roughly 10k tokens for a frontier model.

Full pass: O(L · (N · d² + N² · d))

### Per generation step (with KV cache)

- O(L · (d² + N · d)) per token
- KV cache memory: O(L · N · d) — often the binding constraint before compute
- Generating M tokens: O(L · (M · d² + M · N · d + M²·d/2))

### Parameter count

Total ≈ L · 12d² for standard transformer (4d² for QKV+O, 8d² for MLP up/down). Plus V · d for embedding (often tied).

## 5. Structural improvement directions

### Known-hard problems

- **Quadratic attention**: sparse attention (Longformer, BigBird), linear attention / state-space models (Mamba, RWKV, S4), hybrid architectures (Jamba, Zamba, Griffin, Samba, Hymba). Trade expressiveness for cost.
- **No persistent state**: memory is bolt-on because substrate has no place to put it. Genuine online learning has catastrophic forgetting and reward-hacking problems.
- **Tokenization**: BPE breaks arithmetic, character tasks, and multilingual equity. Byte-level models (ByT5, MambaByte, Meta BLT) exist but slower.

### More speculative

- Depth vs width tradeoffs (Universal Transformers loop the same layer, hasn't scaled)
- Search/deliberation isn't built in — CoT is a token-serialization hack
- MoE done properly (functional specialization instead of opaque emergence)
- Modular / compositional architectures with explicit modules

### Highest-bet directions

1. Genuinely different memory (compact learned state, not just longer context)
2. Character/byte-level input with learned chunking
3. Interpretability-driven architecture design
4. Native tool use / world-model integration as first-class

## 6. Branch-and-commit thinking

Current transformers are strictly serial in the depth dimension — attention must finish before MLP within a block, layer L needs layer L−1. Parallelism exists across token positions within a forward pass, not across layers.

### Real branch-and-commit patterns that exist

- **Speculative decoding**: small draft model + big verifier. Deployed everywhere, 2-3× speedup.
- **Mixture of Experts**: router picks k-of-n experts per token, weighted merge.
- **Parallel attention + MLP** (PaLM, Falcon): both from same input, added to residual. Small quality cost, real speed win.
- **Multi-query / grouped-query attention**: share K/V across Q head groups.
- **Universal Transformer**: loop one layer with dynamic depth per token.

### Underexplored

Native in-model branch/explore/commit at reasoning-step granularity. Tree-of-Thoughts does this externally as a wrapper. A model with native branching operators (spawn K residual streams, evaluate, merge) isn't standard. Blocked by training instability (discrete branches aren't differentiable), commit-step information loss, and load-balancing across parallel hardware.

## 7. The Hamiltonian / Cantor / low-rank thread

### Straightening the attention matrix

Cantor's pairing function π: ℕ × ℕ → ℕ gives a bijection from N² cells to a linear sequence. Same idea as a Hamiltonian path visiting every (i, j) cell exactly once and unrolling end-to-end.

**But**: bijections preserve information but not computation. Rearranging N² cells into a length-N² sequence doesn't reduce work — every dot product still gets computed.

### The useful version — sparse paths

Don't visit every cell. Structured sparse patterns as "paths through the grid":
- Sliding window (Longformer, Mistral) — thick diagonal band
- Strided / dilated — sparse diagonal
- BigBird — local + global tokens + random cells, provably approximates full attention

Each drops N² to O(N · path_length).

### The primality analog — low-rank structure

Primality check is O(√n) because factors above √n have partners below. Attention has an analogous structure: attention matrices are empirically approximately low-rank.

If A ≈ U · Vᵀ with U, V of shape N × r and r much smaller than N, then Nr independent parameters describe the whole matrix. Cost drops to O(N · r).

- **Linformer**: project K, V from N to r using learned projection. O(N · r · d).
- **Performer**: kernel approximation with random feature maps.
- **Nyströmformer**: pick m landmark tokens, reconstruct full attention from landmarks-only computation.

### N² vs N+C — the constants question

Crossover N* where quadratic beats linear-with-overhead: N² = N + C → N* = (1 + √(1 + 4C)) / 2 ≈ √C for large C.

A linear method with overhead 10,000 doesn't beat quadratic until N ≈ 100. Overhead 1,000,000 needs N ≈ 1,000.

This is why Flash Attention wins in practice for N < 4-16k tokens even though it's O(N²) — its constants are small enough that linear alternatives can't catch up until sequences get long.

## 8. Flash Attention

**What it is**: not an algorithmic improvement. A memory-hierarchy improvement. Tiles the N×N attention computation so the matrix never gets written to HBM. Same O(N²·d) compute, but memory traffic drops from O(N²) to O(N·d).

Naive attention: write N² scores to HBM → read back → apply softmax → read back → apply V. Memory-bound because GPUs do 300 TFLOPs matmul but only 2 TB/s HBM bandwidth.

Flash: load Q rows and K columns into on-chip SRAM (100× faster than HBM), compute block-by-block with running softmax normalization, write only final output.

FA1 (2022), FA2 (2023 — parallelism fix), FA3 (2024 on Hopper — async copy, WGMMA, FP8).

### Where the pattern generalizes

- Flash for causal / sliding-window / block-sparse variants
- Flash Decoding — inference-time KV cache scan
- Ring Attention — distributed across GPUs for million-token contexts
- Flash-linear-attention — ported to linear attention variants (RetNet, GLA, Mamba-2)
- MegaBlocks / ScatterMoE — fused kernels for MoE routing
- Any operation with data-parallel blocks + reduction over one dimension + intermediate reuse can benefit

### The composition rule

If a new attention variant can't get a Flash-adjacent kernel, its wall-clock time can't compete regardless of asymptotic complexity. Every serious post-2022 variant has an accompanying kernel section.

## 9. POC experiment status

**Attempted**: associative recall (induction head test) on a tiny transformer, comparing full causal, sliding window, random-k, BigBird-style, snake-path-k, Cantor-ranked-k sparse patterns.

**Result**: task had a bug (allowed key repeats, making target ambiguous), so all variants stuck at chance. Fixed version prepared but not run to completion due to CPU speed constraints.

**Code location**: `/home/claude/attn_exp3.py` — fixed version with unique keys, ready to run on real hardware.

**Realistic ladder for future work**:
- Level 1 (weekend): educational POC, ~200 lines PyTorch, demonstration quality
- Level 2 (2-4 weeks): novel-variant POC with real benchmarks, publishable at workshop
- Level 3 (months): genuine research contribution, needs 100M-1B param models and GPU budget

**Interesting angles that might be genuinely novel**:
- Learned Hamiltonian paths — small network outputs a permutation of cells, trained end-to-end
- Cantor-block attention — hierarchical block structure biased toward early tokens
- Recurrence-over-diagonals — compute k anti-diagonals of attention matrix, use SSM-style recurrence for the rest

## 10. GoldenSyrup OS delegation architecture

### Core design

- **Chat with Claude here** for exploratory reasoning, framework work, ambiguous problems where the shape of the answer isn't known
- **Delegate to raw Claude via GoldenSyrup OS** for bounded, defined-deliverable, repeat-shaped work
- **claude_connector's memory bank** is the shared context spine — get_context on task dispatch, sync_memory on task completion

### Task envelope for delegation

Every delegated task should include:
1. Task envelope: what Claude is doing, deliverable format, hard constraints
2. Memory pull: scoped subset via get_context (project or pillar), not the whole memory
3. Attached files: source material
4. Success criteria: format + failure protocol
5. Log-back hook: sync_memory at end so next task inherits progress

### What fits and what doesn't

**Fits well (delegate)**:
- Code review, contract redlines, submission drafting, landing page copy
- Repeat-shaped work (weekly cash flow, month-end recon, invoice chase, lead triage)
- Multi-agent workflows (DutyBreak-style pipelines)
- Sub-pillar research
- Structured extractions (PDF → JSON, transcript → action items)

**Fits poorly (keep in chat)**:
- Exploratory reasoning where the answer shape is unknown
- Back-and-forth debugging
- High-stakes irreversible outputs (build an approval gate if delegating anyway)
- Tasks depending on state not captured in memory or files

### Cost heuristic

Sonnet 4.6: ~$3/M input, $15/M output. Opus 5× that. Prompt caching: ~$0.30/M for cached input. Typical delegated task with 5k context + 2k output ≈ $0.05 on Sonnet, $0.25 on Opus. Batch API is 50% cheaper for non-urgent work.

### The claude.ai integration ceiling

No public claude.ai chat API exists. GoldenSyrup OS cannot address claude.ai chats as objects. The workable path is: rebuild the chat abstraction inside GoldenSyrup OS on top of Anthropic API + claude_connector memory bank. Chats live in GoldenSyrup's own backend, portable across devices. claude.ai stays as separate tool for exploratory work.

### Cowork-as-dispatcher pattern

```
you (chat with me)
  ↓ I call a tool
cowork_dispatch(task, target_module, deliverable_spec)
  ↓ queued with scoped memory + credentials
GoldenSyrup OS worker picks up
  ↓ executes
result → sync_memory + status update
```

## 11. Modularity philosophy

### What modularity actually needs

For insta-drop of any module (e.g. "drop Cloud925 for legal issue"):

1. Per-module isolation of connector layer — each project's own MCP endpoint or tool
2. Per-module memory scoping — get_context always scoped, no shared "core" memory
3. Per-module credential vaults — scoped secrets, not one shared store with prefixed keys
4. Circuit breakers, not hard failures — graceful degradation when module offline
5. No cross-module direct calls — communicate through memory bank or events
6. Explicit module manifest — declares what it needs, so toggle-off is deterministic

### MCP tools to add to claude_connector

- `list_modules()` — currently active modules
- `disable_module(name, reason)` — flip flag, reject future tasks
- `enable_module(name)` — reverse
- `is_module_active(name)` — dispatch check
- `module_status(name)` — inspection

### Exception: keep the memory bank shared

The memory bank's value is cross-project synthesis (reverse-search, pillar-spanning patterns). Splitting it would be architecturally wrong. Keep shared, tag every entry with project scope for filtering.

## 12. Separation vs sharing — the timing call

### Zero-revenue stage (current)

Aggressive sharing is correct:
- One Railway project holding multiple services
- One Postgres instance with per-project schemas (not separate databases)
- `.env` files or single secrets manager
- One observability account with per-project scoping
- Free tiers everywhere they work

Modular *at the interface layer*, shared *at the substrate*.

### Keep separate even now

Financial and identity infrastructure — expensive to untangle later:
- Payment processor accounts
- Domain ownership under correct account/entity
- Customer-facing vs backend email split (auscloud925 vs sriram.bhagavath08 pattern)

### Triggers for actual infrastructure separation

Separate a project's infra when any of:
- Paying customers (any)
- Personal data of non-you humans
- Co-founder / employee / contractor with access
- Distinct legal entity
- Revenue affecting taxes materially
- Credible legal threat

### Cost delta when it does matter

Rough monthly incremental for full separation across 8 projects: $100-150/mo. Buys real isolation and instant per-module quarantine. Only worth it once revenue or legal exposure is real.

### The two disciplines that make separation actually work

1. Consistent naming: every resource carries project name (`cloud925-prod-db`)
2. Backup discipline: automated per-project backups, tested restore quarterly

## 13. Meta-principles from this thread

- **Constants matter more than asymptotics at real N.** Flash Attention wins over linear alternatives up to 4-16k tokens because its hidden constants are tiny. Asymptotic-better doesn't equal actual-better until crossover.
- **Bijections don't reduce work; structure does.** Relabeling a matrix keeps compute identical. Exploiting redundancy (sparsity, low-rank, algebraic factorization) is what breaks N².
- **Every serious efficiency win in ML infrastructure is your reverse-search pattern.** Flash Attention is a primitive with a guarantee (tiled fused kernels beat memory-bound ops); people reverse-search which operations fit that guarantee.
- **Modularity is a discipline, not a substrate.** Interface-level modularity buys most of the benefit early; substrate separation only pays off once blast radius is real.
- **Delegate what has a known shape. Chat what doesn't.** The API/chat split isn't about model capability; it's about whether the task benefits from being interrogated versus executed.
