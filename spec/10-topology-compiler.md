# Topology compiler — DSL

Status: syntax spec. The Topo Builder module edits topology files and draws their virtual part; compiling onto a
layout (wire / check) is not implemented yet.

A topology file describes a network once and maps it onto the physical devices. From it a compiler generates every
link (device + port on both ends) — to wire a layout, or to diff against the wiring that exists.

A file has three parts, written in this order:

| Part | Sections | Holds |
|---|---|---|
| 1. Virtual | `device_set_groups`, `topo` | which device sets exist (role, size, partitions, port pools) and how they connect. No physical location. |
| 2. Physical | `device_labels` | facts about each device, derived only from its own data |
| 3. Mapping | `mapping` | which physical devices fill each group, their partition key values, the group's member order |

Design the virtual topology first, then describe the physical facts, then map one onto the other.

```yaml
topology: <name>
version: 1
scope: { ... }                 # optional
device_set_groups: { ... }
topo: [ ... ]
device_labels: [ ... ]
mapping: [ ... ]
```

## Notation

### Port pools

A port pool is a string or a list. Each `{..}` expands left to right (left-most outermost); a list is its entries
one after another; lists may nest (one sub-list per peer slot).

| Form | Expands to |
|---|---|
| `etp{1-2}{a-c}` | etp1a etp1b etp1c etp2a etp2b etp2c |
| `Ethernet5/{1,7}/1` | Ethernet5/1/1 Ethernet5/7/1 |
| `p{01-03}` | p01 p02 p03 (zero padding kept) |
| `[etp{1-4}{a,c}, etp5a]` | etp1a etp1c … etp4c etp5a |

A pool that cannot be written as one entry is split into several list entries — no regex.

### Match patterns

Used in label `match` values, mapping `select`, `scope`.

| Form | Matches |
|---|---|
| `*` / `?` | any text / one character |
| `{3-12}`, `{001-092}` | one of those numbers (padding kept) |
| `{x:3}` | 3 digits, captured as `x` |
| `{x:AA}` | 2 capital letters, captured as `x` |
| `{x:#}` | a number, captured as `x` without leading zeros |
| `{x:A\|B}` | one of the alternatives, captured as `x` |
| `{x}` | letters/digits, captured as `x` |
| `[p1, p2]` | any of the patterns |

### Variables

Variables are written `"${name}"`; a bare word is a literal string. Where they may appear:

| Where | Variable | Means |
|---|---|---|
| label `value` | `${x}` | a part captured by the matching pattern, a device field, or an earlier label |
| mapping `set_keys` | `${label.X}` | this device's physical label X |
| mapping `set_keys` | `${set.K.index}` | this device's position (1..size) in its K set, in member order |
| mapping `order` `dir` | `${label.X}` | per-device direction taken from label X |
| topo `key` | `${K}` | the device's value of partition key K |

All keys and map values are strings (`"5"`, not `5`).

## 1. Virtual

### `device_set_groups`

One entry per tier, keyed by group name.

| Field | Meaning |
|---|---|
| `role` | device role of every member |
| `count` | number of devices |
| `partitions` | list of `{ key, count, size }` — the group is cut into `count` sets of `size` devices by the value of `key`; or `{ key, sizes: { "<value>": n, … } }` for uneven sets |
| `ports` | named port pools, each in the order its ports are used |

Each partition key is a logical property of the member. Its value comes from the mapping, never from the physical
location. Built in per partition: `<key>.index` = a member's position inside its set (1..size, in member order).

```yaml
device_set_groups:
  t0:
    role: tor
    count: 32
    partitions:
      - { key: su,    count: 4, size: 8 }
      - { key: plane, count: 8, size: 4 }
    ports:
      down: etp{1-8}{a,b}
      up:   etp{9-10}{a-d}
```

A port pool may be split per peer slot when the ports a device gives a peer depend on where the peer sits
(e.g. one sub-list per server rack of the unit; comment `# slot N`). The slot order is the peer group's member
order.

### `topo`

A list of link specs. One spec describes one link pattern between two groups; a pattern that does not fit one
spec is written as several specs.

| Field | Meaning |
|---|---|
| `name` | link spec name |
| `from` / `to` | `{ group, key?, ports, filters? }` |
| `key` | one string template (`"${su}"`, `"${su}.${plane}"`): members with the same key value form one instance. No key = the whole group is one instance. |
| `filters` | only the members whose key values match: `{ plane: "2" }`, ranges allowed (`{ plane.index: 1-15 }`) |
| `ports` | the pool both ends take their ports from |
| `map` | optional: `[ { from: ["1", "5"], to: "1" } ]` — which `from` key values link to which `to` key value. Without it, instances with equal key values link. |
| `pattern` | `{ type, per_pair }` |

Pattern types:

- `mesh` — every `from` device with every `to` device of the paired instances, `per_pair` links each.
- `round-robin` — each `from` device with ONE `to` device: from #1 → to #1, #2 → #2, …, wrapping after the last.

Port fill (fixed): each device takes its peers in the peer group's member order and gives each peer the next
`per_pair` free ports of its pool.

```yaml
topo:
  - name: server-t0                # in each su, every server to every T0
    from: { group: server, key: "${su}", ports: nic }
    to:   { group: t0,     key: "${su}", ports: down }
    pattern: { type: mesh, per_pair: 1 }
```

## 2. Physical

### `device_labels`

A list of labels, evaluated for every device in order, so a later label may use earlier ones.

| Field | Meaning |
|---|---|
| `name` | label name |
| `values` | list of `{ value, match }`; the first value whose `match` holds is the device's label value. No match = the device has no such label. |
| `match` | `{ field or label: pattern }`, all must hold; `match` may itself be a list = any of them |

Matchable fields are facts known before a device is named: `role`, `location` (its rack), `u` (rack unit),
`dc_code`, and earlier labels. Never the device name — names are assigned last.

Sorting by a label (mapping `order`) sorts in the order its values are listed, then by which entry of the value's
`match` list matched. So a unit spanning several racks is ONE value line whose `match` lists its racks in slot
order.

```yaml
device_labels:
  - name: su                        # scale unit: its server racks in slot order, then its T0 rack
    values:
      - { value: "su1", match: { location: ["R01-01", "R01-02", "R01-03"] } }
      - { value: "su2", match: { location: ["R02-01", "R02-02", "R02-03"] } }

  - name: row_dir                   # direction racks are walked along a row
    values:
      - { value: asc,  match: { location: "R{r:01|03}-*" } }
      - { value: desc, match: { location: "R{r:02|04}-*" } }
```

A cut inside a rack is a `u` range: `match: { location: "R10-05", u: "{22-44}" }`. Keep only labels the mapping
uses.

## 3. Mapping

### `mapping`

A list with ONE item per group.

| Field | Meaning |
|---|---|
| `group` | the device set group |
| `members` | list of `{ select, set_keys }` batches |
| `select` | `{ label: pattern }` — devices of the group's role whose labels match all; `"*"` = has the label. Only labels (no `role`: it comes from the group). |
| `set_keys` | `{ partition key: value }` per device — fills the group's partition keys. Values: `"${label.X}"`, `"${set.K.index}"`, or a literal. A group without partitions takes no `set_keys`. |
| `order` | member order, a list of `{ by, dir? }` compared in turn. Default: location, then u descending. |

`order` `by` = a label, `X.entry` (which entry of label X's value `match` list matched), `u` or `location`.
`dir` = `asc` (default) / `desc` / `"${label.X}"`. Member order decides `${set.K.index}` and port fill.

```yaml
mapping:
  - group: t0
    members:
      - { select: { su: "*" }, set_keys: { su: "${label.su}", plane: "${set.su.index}" } }
    order: [ { by: su }, { by: location, dir: "${label.row_dir}" }, { by: u, dir: desc } ]
```

## `scope`

Optional; devices excluded here are ignored, with their links.

| Field | Meaning |
|---|---|
| `exclude_roles` | roles to ignore |
| `exclude_locations` | location patterns to ignore |
| `exclude_racks` | `{ with_roles: [A, B], reason }` — racks holding all those roles |

## Validation

A compiler / checker on a file asserts:

- every in-scope device lands in exactly one group; `select` uses only defined labels; `set_keys` given iff the
  group has partitions, each key given once per device;
- every group meets its `count` and each partition's `count`/`size` (or `sizes`);
- every topo instance finds its peer instance; no device needs more ports than its pool holds;
- against existing wiring: per link spec, expected vs actual vs matched / missing / extra links (both ends'
  ports); every existing link is generated by exactly one spec; no group is unused.

Realize (wire) and check are actions in the app, not part of the file.

## Topo Builder module

Topology files are kept in the project (`topologies[]`: `{ id, name, source }`, schema `dc-lab/topology@1`; the
source is the YAML text, saved as typed).

- **Sidebar**: the project's topologies (+ New starts from the full example below, ⧉ duplicate, ✕ delete), and the
  selected one's name.
- **Left pane — code**: the YAML source, monospace, line numbers, Tab inserts two spaces. Under it the problems found
  in the file (YAML syntax with its line; undefined groups, pools or partition keys; partition sizes that do not
  add up to `count`; map values that are not strings; a pool too small for a link spec). The divider to the
  diagram is draggable (double-click resets).
- **Right pane — virtual topology**: a canvas (zoom, Export SVG, maximize) drawing the VIRTUAL part only as a
  slice, updated as the source changes:
  - one box per device set group (name, count, role; the split; with **Port pools** on, its pools with port
    counts and slots), tiers bottom-up by link direction (a group sits one tier above the highest group linking
    into it);
  - the box is split by at most two partition keys (outer › inner): by default the key a mapped link uses on the
    group, then the key it is reached by from below, then the key it reaches up with. Inner sets hold outer size /
    inner count devices (`per` keeps the declared size);
  - every level shows at most three values, first, second and last, with `…` between; each set shows at most
    three devices the same way, labelled by their number in the set (a level whose sets hold one device draws the
    devices labelled by the value);
  - the slice follows the links: a mapped link shows the first, second and last of its to values, and for each of
    them the first, second and last from values mapping onto it, in map order (e.g. T1 planes 1, 2, …, 4; T0
    planes 1, 5 → 1; 2, 6 → 2; …; 4, 8 → 4); a keyed link without a map shows the same values on both ends;
  - lines run device to device: a from device pairs with the drawn to devices whose key value it maps to (`map`,
    else the same value; filters drop devices, `key.index` by the device's number in its set): all of them for
    mesh, the next in turn for round-robin;
  - beside each tier gap, the spec's rule: name and total links; how instances pair (`2 t0 planes → 1 t1 plane
    (map)`, `server su k → t0 su k`, `each t1 plane → all t2 ...`); the pattern with devices per pair (`mesh 4 x 4
    per pair`, `round-robin 4 over 6 x2`); ports each device uses on each side. Hover adds both ends and the map;
  - toolbar **Groups ▾**: Port pools on/off, and per group the split (any key, any ordered pair of keys, or
    none).

The YAML reader covers block maps / lists, flow `{}` / `[]` (may span lines), quoted and plain scalars and `#`
comments; anchors, tags and block scalars are not supported.

## Full example

```yaml
topology: example-backend
version: 1

device_set_groups:
  server:
    role: server
    count: 64
    partitions:
      - { key: su, count: 4, size: 16 }
    ports:
      nic: p{1-8}

  t0:
    role: tor
    count: 32
    partitions:
      - { key: su,    count: 4, size: 8 }
      - { key: plane, count: 8, size: 4 }
    ports:
      down:                       # 8 ports per server rack of the su, racks in member order
        - etp{1-4}{a,b}           # slot 1
        - etp{5-8}{a,b}           # slot 2
      up: etp{9-10}{a-d}

  t1:
    role: leaf
    count: 16
    partitions:
      - { key: plane, count: 4, size: 4 }
    ports:
      down: etp{1-8}
      up:   etp{9-10}

  t2:
    role: spine
    count: 8
    partitions:
      - { key: plane, count: 2, size: 4 }
    ports:
      down: etp{1-16}

topo:
  - name: server-t0               # in each su, every server to every T0
    from: { group: server, key: "${su}", ports: nic }
    to:   { group: t0,     key: "${su}", ports: down }
    pattern: { type: mesh, per_pair: 1 }

  - name: t0-t1                   # two T0 planes mesh with one T1 plane
    from: { group: t0, key: "${plane}", ports: up }
    to:   { group: t1, key: "${plane}", ports: down }
    map:
      - { from: ["1", "5"], to: "1" }
      - { from: ["2", "6"], to: "2" }
      - { from: ["3", "7"], to: "3" }
      - { from: ["4", "8"], to: "4" }
    pattern: { type: mesh, per_pair: 1 }

  - name: t1-t2                   # each T1 plane round-robins over T2 1-3 of each T2 plane
    from: { group: t1, key: "${plane}", ports: up }
    to:   { group: t2, filters: { plane.index: 1-3 }, ports: down }
    pattern: { type: round-robin, per_pair: 2 }

device_labels:
  - name: su                      # 2 server racks in slot order, then the T0 rack
    values:
      - { value: "su1", match: { location: ["R01-01", "R01-02", "R01-03"] } }
      - { value: "su2", match: { location: ["R02-01", "R02-02", "R02-03"] } }
      - { value: "su3", match: { location: ["R03-01", "R03-02", "R03-03"] } }
      - { value: "su4", match: { location: ["R04-01", "R04-02", "R04-03"] } }

  - name: row_dir
    values:
      - { value: asc,  match: { location: "R{r:01|03}-*" } }
      - { value: desc, match: { location: "R{r:02|04}-*" } }

  - name: t1_plane
    values:
      - { value: "1", match: { location: "R10-{01-02}" } }
      - { value: "2", match: { location: "R10-{03-04}" } }
      - { value: "3", match: { location: "R11-{01-02}" } }
      - { value: "4", match: { location: "R11-{03-04}" } }

  - name: t2_plane
    values:
      - { value: "1", match: { location: "R20-01" } }
      - { value: "2", match: { location: "R20-02" } }

mapping:
  - group: server                 # one su set per su label
    members:
      - { select: { su: "*" }, set_keys: { su: "${label.su}" } }
    order: [ { by: su }, { by: su.entry }, { by: u, dir: desc } ]

  - group: t0                     # plane = position in its su
    members:
      - { select: { su: "*" }, set_keys: { su: "${label.su}", plane: "${set.su.index}" } }
    order: [ { by: su }, { by: location, dir: "${label.row_dir}" }, { by: u, dir: desc } ]

  - group: t1
    members:
      - { select: { t1_plane: "*" }, set_keys: { plane: "${label.t1_plane}" } }
    order: [ { by: t1_plane }, { by: location }, { by: u, dir: desc } ]

  - group: t2
    members:
      - { select: { t2_plane: "*" }, set_keys: { plane: "${label.t2_plane}" } }
    order: [ { by: t2_plane }, { by: u, dir: desc } ]
```
